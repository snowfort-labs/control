// Engine Types and Interfaces for Snowfort

export type EngineType = 'gemini' | 'claude' | 'codex';

export type SessionStatus = 'idle' | 'ready' | 'working' | 'error' | 'completed';


export interface Project {
  id: string;
  name: string;
  path: string;
  organizationId?: string;
  orgId?: string; // Legacy compatibility
  createdAt: string;
  lastActive: string;
  currentBranch?: string; // UI expects this
}

export interface Organization {
  id: string;
  name: string;
  orderIndex: number;
  createdAt: string;
}

export interface Session {
  id: string;
  projectId: string;
  name: string;
  engineType?: EngineType; // Optional - generic terminal sessions don't have a specific engine
  status: SessionStatus;
  config?: Record<string, any>;
  orderIndex: number;
  createdAt: string;
  lastActive: string;
  turnCount?: number; // UI expects this for analytics
  activeEngine?: EngineType; // The currently running engine (if any) - updated via terminal monitoring
}

export interface SessionMetrics {
  turnCount: number;
  totalTime: number;
  avgResponseTime: number;
  successRate: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  body: string;
  source: 'manual' | 'github';
  sourceId?: string;
  sourceUrl?: string;
  taskType?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  estimatedTime?: number;
  affectedFiles?: string[];
  conflictRisk?: number;
  conflictDetails?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TaskGroup {
  id: string;
  taskIds: string[];
  conflictRisk: number;
  canRunInParallel: boolean;
}

export interface TaskPhase {
  id: string;
  name: string;
  parallelGroups: TaskGroup[];
  order: number;
}

export interface TaskPlan {
  id: string;
  projectId: string;
  name: string;
  taskIds: string[];
  phases: TaskPhase[];
  createdAt: string;
  updatedAt: string;
}

