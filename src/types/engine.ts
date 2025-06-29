// Engine Types and Interfaces for Snowfort

export type EngineType = 'gemini' | 'claude' | 'codex';

export type SessionStatus = 'idle' | 'ready' | 'working' | 'error' | 'completed';

export interface EngineConfig {
  type: EngineType;
  name: string;
  executable: string;
  defaultArgs: string[];
  authMethod: 'oauth' | 'api-key' | 'google-login';
  installCommand?: string;
  detectCommand: string;
  statePatterns: {
    ready: string[];
    working: string[];
    error: string[];
    completed: string[];
  };
}

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
  engineType: EngineType;
  status: SessionStatus;
  config?: Record<string, any>;
  orderIndex: number;
  createdAt: string;
  lastActive: string;
  turnCount?: number; // UI expects this for analytics
}

export interface SessionMetrics {
  turnCount: number;
  totalTime: number;
  avgResponseTime: number;
  successRate: number;
}

export type EngineStatus = 'available' | 'not-installed' | 'auth-required' | 'subscription-required' | 'credits-required';

export interface EngineAvailability {
  claude: EngineStatus;
  codex: EngineStatus;
  gemini: EngineStatus;
}