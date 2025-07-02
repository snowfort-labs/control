// SQLite Database Service for Snowfort

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - better-sqlite3 types not fully compatible
import Database from 'better-sqlite3';
import { Project, Organization, Session, Task, TaskPlan } from '../types/engine';
import path from 'path';
import { app } from 'electron';

export class DatabaseService {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // Store database in user data directory
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'snowfort.db');
    
    this.db = (Database as any)(this.dbPath);
    this.initializeSchema();
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  private initializeSchema(): void {
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

    // Run migrations
    this.runMigrations();
  }

  private runMigrations(): void {
    // Migration: Rename agent_type to engine_type in sessions table
    try {
      // Check if agent_type column exists
      const columns = this.db.prepare("PRAGMA table_info(sessions)").all() as any[];
      const hasAgentType = columns.some(col => col.name === 'agent_type');
      const hasEngineType = columns.some(col => col.name === 'engine_type');
      const hasActiveEngine = columns.some(col => col.name === 'active_engine');

      if (hasAgentType && !hasEngineType) {
        console.log('Migrating agent_type to engine_type...');
        
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
        
        console.log('Migration completed successfully');
      }
    } catch (error) {
      console.error('Migration failed:', error);
      // Don't throw - let the app continue with the current schema
    }

    // Migration: Make engine_type nullable for generic terminal sessions
    try {
      const columns = this.db.prepare("PRAGMA table_info(sessions)").all() as any[];
      const engineTypeColumn = columns.find(col => col.name === 'engine_type');
      
      // Check if engine_type is currently NOT NULL
      if (engineTypeColumn && engineTypeColumn.notnull === 1) {
        console.log('Making engine_type nullable for generic terminal sessions...');
        
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
        
        console.log('Engine type nullable migration completed successfully');
      }
    } catch (error) {
      console.error('Engine type nullable migration failed:', error);
      // Don't throw - let the app continue with the current schema
    }

    // Migration: Add active_engine column for engine detection
    try {
      const columns = this.db.prepare("PRAGMA table_info(sessions)").all() as any[];
      const hasActiveEngine = columns.some(col => col.name === 'active_engine');
      
      if (!hasActiveEngine) {
        console.log('Adding active_engine column for real-time engine detection...');
        this.db.prepare('ALTER TABLE sessions ADD COLUMN active_engine TEXT').run();
        console.log('Active engine migration completed successfully');
      }
    } catch (error) {
      console.error('Active engine migration failed:', error);
      // Don't throw - let the app continue with the current schema
    }
  }

  // Organizations
  createOrganization(name: string): Organization {
    const id = this.generateId();
    const orderIndex = this.getNextOrderIndex('organizations');
    
    const stmt = this.db.prepare(`
      INSERT INTO organizations (id, name, order_index)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(id, name, orderIndex);
    
    return {
      id,
      name,
      orderIndex,
      createdAt: new Date().toISOString()
    };
  }

  getOrganizations(): Organization[] {
    const stmt = this.db.prepare(`
      SELECT id, name, order_index as orderIndex, created_at as createdAt
      FROM organizations
      ORDER BY order_index ASC
    `);
    
    return stmt.all() as unknown as Organization[];
  }

  // Projects
  createProject(name: string, path: string, organizationId?: string): Project {
    const id = this.generateId();
    const orderIndex = organizationId 
      ? this.getNextOrderIndex('projects', 'org_id = ?', organizationId)
      : this.getNextOrderIndex('projects', 'org_id IS NULL');
    
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, org_id, name, path, order_index)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, organizationId || null, name, path, orderIndex);
    
    return {
      id,
      name,
      path,
      organizationId,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
  }

  getProjects(): Project[] {
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
    
    return stmt.all() as unknown as Project[];
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
    
    const sessions = projectId ? stmt.all(projectId) : stmt.all() as any[];
    
    return sessions.map((session: any) => ({
      ...session,
      config: JSON.parse(session.config || '{}')
    }));
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
    const result = getStmt.get(projectId) as any;
    
    return {
      id: result.id,
      name: result.name,
      path: result.path,
      currentBranch: result.current_branch,
      orgId: result.org_id,
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
    const result = getStmt.get(sessionId) as any;
    
    return {
      id: result.id,
      projectId: result.project_id,
      name: result.name,
      engineType: result.engine_type,
      status: result.status,
      config: JSON.parse(result.config || '{}'),
      activeEngine: result.active_engine,
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
    
    const tasks = stmt.all(projectId) as any[];
    
    return tasks.map((task: any) => ({
      ...task,
      affectedFiles: JSON.parse(task.affectedFiles || '[]')
    }));
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
    const result = getStmt.get(taskId) as any;
    
    return {
      id: result.id,
      projectId: result.project_id,
      title: result.title,
      body: result.body,
      source: result.source,
      sourceId: result.source_id,
      sourceUrl: result.source_url,
      taskType: result.task_type,
      status: result.status,
      estimatedTime: result.estimated_time,
      affectedFiles: JSON.parse(result.affected_files || '[]'),
      conflictRisk: result.conflict_risk,
      conflictDetails: result.conflict_details,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      completedAt: result.completed_at
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
    
    const plans = stmt.all(projectId) as any[];
    
    return plans.map((plan: any) => ({
      ...plan,
      taskIds: JSON.parse(plan.taskIds || '[]'),
      phases: JSON.parse(plan.phases || '[]')
    }));
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
    const result = getStmt.get(planId) as any;
    
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
    let query = `SELECT COALESCE(MAX(order_index), -1) + 1 as nextIndex FROM ${table}`;
    
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    
    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as unknown as { nextIndex: number };
    
    return result.nextIndex;
  }

  close(): void {
    this.db.close();
  }
}