// Database-specific types and interfaces

export interface DatabaseRow {
  [key: string]: any;
}

export interface DatabaseColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

export interface ProjectRow extends DatabaseRow {
  id: string;
  org_id: string | null;
  name: string;
  path: string;
  order_index: number;
  created_at: string;
  last_active: string;
  current_branch?: string;
}

export interface SessionRow extends DatabaseRow {
  id: string;
  project_id: string;
  name: string;
  engine_type: string | null;
  status: string;
  config: string;
  order_index: number;
  active_engine: string | null;
  created_at: string;
  last_active: string;
}

export interface OrganizationRow extends DatabaseRow {
  id: string;
  name: string;
  order_index: number;
  created_at: string;
}

export interface TaskRow extends DatabaseRow {
  id: string;
  project_id: string;
  title: string;
  body: string;
  source: string;
  source_id: string | null;
  source_url: string | null;
  task_type: string | null;
  status: string;
  estimated_time: number | null;
  affected_files: string;
  conflict_risk: number | null;
  conflict_details: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TaskPlanRow extends DatabaseRow {
  id: string;
  project_id: string;
  name: string;
  task_ids: string;
  phases: string;
  created_at: string;
  updated_at: string;
}

// Type guards for database rows
export function isProjectRow(row: any): row is ProjectRow {
  return row && 
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.path === 'string' &&
    (typeof row.created_at === 'string' || typeof row.createdAt === 'string');
}

export function isSessionRow(row: any): row is SessionRow {
  return row && 
    typeof row.id === 'string' &&
    (typeof row.project_id === 'string' || typeof row.projectId === 'string') &&
    typeof row.name === 'string' &&
    typeof row.status === 'string';
}

export function isOrganizationRow(row: any): row is OrganizationRow {
  return row && 
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.created_at === 'string';
}

export function isTaskRow(row: any): row is TaskRow {
  return row && 
    typeof row.id === 'string' &&
    typeof row.project_id === 'string' &&
    typeof row.title === 'string' &&
    typeof row.body === 'string';
}

export function isTaskPlanRow(row: any): row is TaskPlanRow {
  return row && 
    typeof row.id === 'string' &&
    typeof row.project_id === 'string' &&
    typeof row.name === 'string';
}