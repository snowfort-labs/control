// SQLite Database Service for Snowfort

import Database from 'better-sqlite3';
import { Project, Organization, Session, Task, TaskPlan } from '../types/engine';
import { 
  ProjectRow, 
  SessionRow, 
  OrganizationRow, 
  TaskRow, 
  TaskPlanRow,
  DatabaseColumn,
  isProjectRow,
  isSessionRow,
  isOrganizationRow,
  isTaskRow,
  isTaskPlanRow
} from '../types/database';
import { logger } from '../utils/logger';
import { config } from '../config';
import path from 'path';
import { app } from 'electron';

export class DatabaseService {
  private db: Database;
  private dbPath: string;
  private isInitialized = false;

  constructor() {
    // Store database in user data directory
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'snowfort.db');
    
    try {
      logger.database.info('Initializing database', { path: this.dbPath });
      this.db = new (Database as any)(this.dbPath);
      this.initializeSchema();
      this.isInitialized = true;
      logger.database.info('Database initialized successfully');
    } catch (error) {
      logger.database.error('Failed to initialize database', error as Error, { path: this.dbPath });
      throw error;
    }
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  private initializeSchema(): void {
    try {
      logger.database.debug('Initializing database schema');
      
      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Create tables
      this.db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        order_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        engine_type TEXT,
        status TEXT DEFAULT 'idle',
        config TEXT DEFAULT '{}',
        order_index INTEGER DEFAULT 0,
        active_engine TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        messages TEXT DEFAULT '[]',
        turn_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS analytics (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        metric_type TEXT NOT NULL,
        value REAL NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        source TEXT DEFAULT 'manual',
        source_id TEXT,
        source_url TEXT,
        task_type TEXT,
        status TEXT DEFAULT 'planned',
        estimated_time INTEGER,
        affected_files TEXT DEFAULT '[]',
        conflict_risk INTEGER,
        conflict_details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS task_plans (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        task_ids TEXT DEFAULT '[]',
        phases TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_task_plans_project_id ON task_plans(project_id);
    `);

      logger.database.debug('Database schema created successfully');
      
      // Run migrations
      this.runMigrations();
    } catch (error) {
      logger.database.error('Failed to initialize database schema', error as Error);
      throw error;
    }
  }

  private runMigrations(): void {
    logger.database.debug('Starting database migrations');
    
    // Migration: Rename agent_type to engine_type in sessions table
    try {
      // Check if agent_type column exists
      const columns = this.db.prepare("PRAGMA table_info(sessions)").all() as unknown as DatabaseColumn[];
      const hasAgentType = columns.some(col => col.name === 'agent_type');
      const hasEngineType = columns.some(col => col.name === 'engine_type');
      const hasActiveEngine = columns.some(col => col.name === 'active_engine');

      if (hasAgentType && !hasEngineType) {
        logger.database.info('Migrating agent_type to engine_type');
        
        // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
        this.db.exec(`
          BEGIN TRANSACTION;
          
          -- Create new sessions table with engine_type
          CREATE TABLE sessions_new (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            engine_type TEXT,
            status TEXT DEFAULT 'idle',
            config TEXT DEFAULT '{}',
            order_index INTEGER DEFAULT 0,
            active_engine TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          
          -- Copy data from old table to new table
          INSERT INTO sessions_new (id, project_id, name, engine_type, status, config, order_index, created_at, last_active)
          SELECT id, project_id, name, agent_type, status, config, order_index, created_at, last_active
          FROM sessions;
          
          -- Drop old table and rename new one
          DROP TABLE sessions;
          ALTER TABLE sessions_new RENAME TO sessions;
          
          -- Recreate index
          CREATE INDEX idx_sessions_project_id ON sessions(project_id);
          
          COMMIT;
        `);
        
        logger.database.info('agent_type to engine_type migration completed successfully');
      }
    } catch (error) {
      logger.database.error('Migration failed', error as Error);
      // Don't throw - let the app continue with the current schema
    }

    // Migration: Make engine_type nullable for generic terminal sessions
    try {
      const columns = this.db.prepare("PRAGMA table_info(sessions)").all() as unknown as DatabaseColumn[];
      const engineTypeColumn = columns.find(col => col.name === 'engine_type');
      
      // Check if engine_type is currently NOT NULL
      if (engineTypeColumn && engineTypeColumn.notnull === 1) {
        logger.database.info('Making engine_type nullable for generic terminal sessions');
        
        // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
        this.db.exec(`
          BEGIN TRANSACTION;
          
          -- Create new sessions table with nullable engine_type
          CREATE TABLE sessions_new (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            engine_type TEXT,
            status TEXT DEFAULT 'idle',
            config TEXT DEFAULT '{}',
            order_index INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          
          -- Copy data from old table to new table
          INSERT INTO sessions_new (id, project_id, name, engine_type, status, config, order_index, created_at, last_active)
          SELECT id, project_id, name, engine_type, status, config, order_index, created_at, last_active
          FROM sessions;
          
          -- Drop old table and rename new one
          DROP TABLE sessions;
          ALTER TABLE sessions_new RENAME TO sessions;
          
          -- Recreate index
          CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
          
          COMMIT;
        `);
        
        logger.database.info('Engine type nullable migration completed successfully');
      }
    } catch (error) {
      logger.database.error('Engine type nullable migration failed', error as Error);
      // Don't throw - let the app continue with the current schema
    }

    // Migration: Add active_engine column for engine detection
    try {
      const columns = this.db.prepare("PRAGMA table_info(sessions)").all() as unknown as DatabaseColumn[];
      const hasActiveEngine = columns.some(col => col.name === 'active_engine');
      
      if (!hasActiveEngine) {
        logger.database.info('Adding active_engine column for real-time engine detection');
        this.db.prepare('ALTER TABLE sessions ADD COLUMN active_engine TEXT').run();
        logger.database.info('Active engine migration completed successfully');
      }
    } catch (error) {
      logger.database.error('Active engine migration failed', error as Error);
      // Don't throw - let the app continue with the current schema
    }
    
    logger.database.debug('Database migrations completed');
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }
  }

  // Organizations
  createOrganization(name: string): Organization {
    this.ensureInitialized();
    
    try {
      const id = this.generateId();
      const orderIndex = this.getNextOrderIndex('organizations');
      
      const stmt = this.db.prepare(`
        INSERT INTO organizations (id, name, order_index)
        VALUES (?, ?, ?)
      `);
      
      stmt.run(id, name, orderIndex);
      
      const organization = {
        id,
        name,
        orderIndex,
        createdAt: new Date().toISOString()
      };
      
      logger.database.info('Organization created', { id, name });
      return organization;
    } catch (error) {
      logger.database.error('Failed to create organization', error as Error, { name });
      throw error;
    }
  }

  getOrganizations(): Organization[] {
    this.ensureInitialized();
    
    try {
      const stmt = this.db.prepare(`
        SELECT id, name, order_index as orderIndex, created_at as createdAt
        FROM organizations
        ORDER BY order_index ASC
      `);
      
      const rows = stmt.all();
      const organizations: Organization[] = [];
      
      for (const row of rows) {
        if (isOrganizationRow(row)) {
          organizations.push({
            id: row.id,
            name: row.name,
            orderIndex: row.order_index,
            createdAt: row.created_at
          });
        }
      }
      
      logger.database.debug('Retrieved organizations', { count: organizations.length });
      return organizations;
    } catch (error) {
      logger.database.error('Failed to get organizations', error as Error);
      throw error;
    }
  }

  // Projects
  createProject(name: string, path: string, organizationId?: string): Project {
    this.ensureInitialized();
    
    try {
      const id = this.generateId();
      const orderIndex = organizationId 
        ? this.getNextOrderIndex('projects', 'org_id = ?', organizationId)
        : this.getNextOrderIndex('projects', 'org_id IS NULL');
      
      const stmt = this.db.prepare(`
        INSERT INTO projects (id, org_id, name, path, order_index)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, organizationId || null, name, path, orderIndex);
      
      const project = {
        id,
        name,
        path,
        organizationId,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
      
      logger.database.info('Project created', { id, name, path, organizationId });
      return project;
    } catch (error) {
      logger.database.error('Failed to create project', error as Error, { name, path, organizationId });
      throw error;
    }
  }

  getProjects(): Project[] {
    this.ensureInitialized();
    
    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, 
          org_id as organizationId, 
          name, 
          path, 
          created_at as createdAt,
          last_active as lastActive
        FROM projects
        ORDER BY order_index ASC
      `);
      
      const rows = stmt.all();
      const projects: Project[] = [];
      
      for (const row of rows) {
        if (isProjectRow(row)) {
          projects.push({
            id: row.id,
            name: row.name,
            path: row.path,
            organizationId: (row as any).organizationId || (row as any).org_id || undefined,
            createdAt: (row as any).createdAt || (row as any).created_at,
            lastActive: (row as any).lastActive || (row as any).last_active,
            currentBranch: (row as any).current_branch || undefined
          });
        }
      }
      
      logger.database.debug('Retrieved projects', { count: projects.length });
      return projects;
    } catch (error) {
      logger.database.error('Failed to get projects', error as Error);
      throw error;
    }
  }

  updateProjectLastActive(projectId: string): void {
    const stmt = this.db.prepare(`
      UPDATE projects 
      SET last_active = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    stmt.run(projectId);
  }

  // Sessions
  createSession(projectId: string, name: string, engineType?: string, initialCommand?: string, config: any = {}): Session {
    const id = this.generateId();
    const orderIndex = this.getNextOrderIndex('sessions', 'project_id = ?', projectId);
    
    // Add initial command to config if provided
    const sessionConfig = { ...config };
    if (initialCommand) {
      sessionConfig.initialCommand = initialCommand;
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, project_id, name, engine_type, config, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, projectId, name, engineType || null, JSON.stringify(sessionConfig), orderIndex);
    
    return {
      id,
      projectId,
      name,
      engineType: engineType as any,
      status: 'idle',
      config: sessionConfig,
      orderIndex,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
  }

  getSessions(projectId?: string): Session[] {
    const stmt = projectId 
      ? this.db.prepare(`
          SELECT 
            id, 
            project_id as projectId, 
            name, 
            engine_type as engineType, 
            status,
            config,
            order_index as orderIndex,
            active_engine as activeEngine,
            created_at as createdAt,
            last_active as lastActive
          FROM sessions 
          WHERE project_id = ?
          ORDER BY order_index ASC
        `)
      : this.db.prepare(`
          SELECT 
            id, 
            project_id as projectId, 
            name, 
            engine_type as engineType, 
            status,
            config,
            order_index as orderIndex,
            active_engine as activeEngine,
            created_at as createdAt,
            last_active as lastActive
          FROM sessions 
          ORDER BY last_active DESC
        `);
    
    const rows = projectId ? stmt.all(projectId) : stmt.all();
    const sessions: Session[] = [];
    
    for (const row of rows) {
      if (isSessionRow(row)) {
        sessions.push({
          id: row.id,
          projectId: (row as any).projectId || (row as any).project_id,
          name: row.name,
          engineType: (row as any).engineType || (row as any).engine_type || undefined,
          status: row.status as any,
          config: JSON.parse(row.config || '{}'),
          orderIndex: (row as any).orderIndex || (row as any).order_index,
          activeEngine: (row as any).activeEngine || (row as any).active_engine || undefined,
          createdAt: (row as any).createdAt || (row as any).created_at,
          lastActive: (row as any).lastActive || (row as any).last_active
        });
      }
    }
    
    logger.database.debug('Retrieved sessions', { count: sessions.length });
    return sessions;
  }

  updateSessionStatus(sessionId: string, status: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = ?, last_active = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    stmt.run(status, sessionId);
  }

  updateProject(projectId: string, updates: Partial<Project>): Project {
    const validFields = ['name', 'path', 'current_branch', 'org_id'];
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key === 'currentBranch' ? 'current_branch' : 
                    key === 'orgId' ? 'org_id' : key;
      
      if (validFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    setClauses.push('last_active = CURRENT_TIMESTAMP');
    values.push(projectId);

    const stmt = this.db.prepare(`
      UPDATE projects 
      SET ${setClauses.join(', ')} 
      WHERE id = ?
    `);
    
    stmt.run(...values);

    // Return the updated project
    const getStmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const result = getStmt.get(projectId);
    
    if (!isProjectRow(result)) {
      throw new Error(`Project with id ${projectId} not found or invalid`);
    }
    
    return {
      id: result.id,
      name: result.name,
      path: result.path,
      currentBranch: result.current_branch,
      organizationId: result.org_id || undefined,
      lastActive: result.last_active,
      createdAt: result.created_at
    };
  }

  updateSession(sessionId: string, updates: Partial<Session>): Session {
    const validFields = ['name', 'status', 'engine_type', 'config', 'active_engine'];
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key === 'engineType' ? 'engine_type' : key === 'activeEngine' ? 'active_engine' : key;
      
      if (validFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        values.push(dbKey === 'config' ? JSON.stringify(value) : value);
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    setClauses.push('last_active = CURRENT_TIMESTAMP');
    values.push(sessionId);

    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET ${setClauses.join(', ')} 
      WHERE id = ?
    `);
    
    stmt.run(...values);

    // Return the updated session
    const getStmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const result = getStmt.get(sessionId);
    
    if (!isSessionRow(result)) {
      throw new Error(`Session with id ${sessionId} not found or invalid`);
    }
    
    return {
      id: result.id,
      projectId: result.project_id,
      name: result.name,
      engineType: result.engine_type as any,
      status: result.status as any,
      config: JSON.parse(result.config || '{}'),
      activeEngine: result.active_engine as any,
      lastActive: result.last_active,
      createdAt: result.created_at,
      orderIndex: result.order_index
    };
  }

  deleteSession(sessionId: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(sessionId);
    
    if (result.changes === 0) {
      throw new Error(`Session with id ${sessionId} not found`);
    }
  }

  // Tasks
  createTask(projectId: string, title: string, body: string, options: {
    source?: 'manual' | 'github';
    sourceId?: string;
    sourceUrl?: string;
    taskType?: string;
  } = {}): Task {
    const id = this.generateId();
    
    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, project_id, title, body, source, source_id, source_url, task_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, 
      projectId, 
      title, 
      body, 
      options.source || 'manual',
      options.sourceId || null,
      options.sourceUrl || null,
      options.taskType || null
    );
    
    return {
      id,
      projectId,
      title,
      body,
      source: options.source || 'manual',
      sourceId: options.sourceId,
      sourceUrl: options.sourceUrl,
      taskType: options.taskType,
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  getTasks(projectId: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT 
        id,
        project_id as projectId,
        title,
        body,
        source,
        source_id as sourceId,
        source_url as sourceUrl,
        task_type as taskType,
        status,
        estimated_time as estimatedTime,
        affected_files as affectedFiles,
        conflict_risk as conflictRisk,
        conflict_details as conflictDetails,
        created_at as createdAt,
        updated_at as updatedAt,
        completed_at as completedAt
      FROM tasks 
      WHERE project_id = ?
      ORDER BY created_at DESC
    `);
    
    const rows = stmt.all(projectId);
    const tasks: Task[] = [];
    
    for (const row of rows) {
      if (isTaskRow(row)) {
        tasks.push({
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          body: row.body,
          source: row.source as any,
          sourceId: row.source_id || undefined,
          sourceUrl: row.source_url || undefined,
          taskType: row.task_type || undefined,
          status: row.status as any,
          estimatedTime: row.estimated_time || undefined,
          affectedFiles: JSON.parse(row.affected_files || '[]'),
          conflictRisk: row.conflict_risk || undefined,
          conflictDetails: row.conflict_details || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          completedAt: row.completed_at || undefined
        });
      }
    }
    
    return tasks;
  }

  updateTask(taskId: string, updates: Partial<Task>): Task {
    const validFields = [
      'title', 'body', 'status', 'task_type', 'estimated_time', 
      'affected_files', 'conflict_risk', 'conflict_details', 'completed_at'
    ];
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key === 'taskType' ? 'task_type' : 
                    key === 'estimatedTime' ? 'estimated_time' :
                    key === 'affectedFiles' ? 'affected_files' :
                    key === 'conflictRisk' ? 'conflict_risk' :
                    key === 'conflictDetails' ? 'conflict_details' :
                    key === 'completedAt' ? 'completed_at' : key;
      
      if (validFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        if (dbKey === 'affected_files') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(taskId);

    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET ${setClauses.join(', ')} 
      WHERE id = ?
    `);
    
    stmt.run(...values);

    // Return the updated task
    const getStmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const result = getStmt.get(taskId);
    
    if (!isTaskRow(result)) {
      throw new Error(`Task with id ${taskId} not found or invalid`);
    }
    
    return {
      id: result.id,
      projectId: result.project_id,
      title: result.title,
      body: result.body,
      source: result.source as any,
      sourceId: result.source_id || undefined,
      sourceUrl: result.source_url || undefined,
      taskType: result.task_type || undefined,
      status: result.status as any,
      estimatedTime: result.estimated_time || undefined,
      affectedFiles: JSON.parse(result.affected_files || '[]'),
      conflictRisk: result.conflict_risk || undefined,
      conflictDetails: result.conflict_details || undefined,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      completedAt: result.completed_at || undefined
    };
  }

  deleteTask(taskId: string): void {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(taskId);
    
    if (result.changes === 0) {
      throw new Error(`Task with id ${taskId} not found`);
    }
  }

  // Task Plans
  createTaskPlan(projectId: string, name: string, taskIds: string[]): TaskPlan {
    const id = this.generateId();
    
    const stmt = this.db.prepare(`
      INSERT INTO task_plans (id, project_id, name, task_ids)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, projectId, name, JSON.stringify(taskIds));
    
    return {
      id,
      projectId,
      name,
      taskIds,
      phases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  getTaskPlans(projectId: string): TaskPlan[] {
    const stmt = this.db.prepare(`
      SELECT 
        id,
        project_id as projectId,
        name,
        task_ids as taskIds,
        phases,
        created_at as createdAt,
        updated_at as updatedAt
      FROM task_plans 
      WHERE project_id = ?
      ORDER BY updated_at DESC
    `);
    
    const rows = stmt.all(projectId);
    const plans: TaskPlan[] = [];
    
    for (const row of rows) {
      if (isTaskPlanRow(row)) {
        plans.push({
          id: row.id,
          projectId: row.project_id,
          name: row.name,
          taskIds: JSON.parse(row.task_ids || '[]'),
          phases: JSON.parse(row.phases || '[]'),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        });
      }
    }
    
    return plans;
  }

  updateTaskPlan(planId: string, updates: Partial<TaskPlan>): TaskPlan {
    const validFields = ['name', 'task_ids', 'phases'];
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key === 'taskIds' ? 'task_ids' : key;
      
      if (validFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        if (dbKey === 'task_ids' || dbKey === 'phases') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(planId);

    const stmt = this.db.prepare(`
      UPDATE task_plans 
      SET ${setClauses.join(', ')} 
      WHERE id = ?
    `);
    
    stmt.run(...values);

    // Return the updated plan
    const getStmt = this.db.prepare('SELECT * FROM task_plans WHERE id = ?');
    const result = getStmt.get(planId);
    
    if (!isTaskPlanRow(result)) {
      throw new Error(`Task plan with id ${planId} not found or invalid`);
    }
    
    return {
      id: result.id,
      projectId: result.project_id,
      name: result.name,
      taskIds: JSON.parse(result.task_ids || '[]'),
      phases: JSON.parse(result.phases || '[]'),
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getNextOrderIndex(table: string, whereClause?: string, ...params: any[]): number {
    try {
      let query = `SELECT COALESCE(MAX(order_index), -1) + 1 as nextIndex FROM ${table}`;
      
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }
      
      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as unknown as { nextIndex: number };
      
      return result.nextIndex;
    } catch (error) {
      logger.database.error('Failed to get next order index', error as Error, { table, whereClause, params });
      throw error;
    }
  }

  close(): void {
    if (this.isInitialized && this.db) {
      try {
        this.db.close();
        this.isInitialized = false;
        logger.database.info('Database connection closed');
      } catch (error) {
        logger.database.error('Failed to close database', error as Error);
        throw error;
      }
    }
  }
}