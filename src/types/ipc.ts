// IPC Interface Types for Snowfort

import { Project, Organization, Session, EngineType } from './engine';

export interface SnowfortAPI {
  // Database operations
  getProjects(): Promise<Project[]>;
  getOrganizations(): Promise<Organization[]>;
  getSessions(projectId?: string): Promise<Session[]>;
  createProject(name: string, path: string, organizationId?: string): Promise<Project>;
  createSession(projectId: string, name: string, engineType?: EngineType): Promise<Session>;
  updateProject(projectId: string, updates: Partial<Project>): Promise<Project>;
  updateSession(sessionId: string, updates: Partial<Session>): Promise<Session>;
  deleteSession(sessionId: string): Promise<void>;

  // File system operations
  selectDirectory(): Promise<string | null>;

  
  // PTY operations
  startPty(sessionId: string, projectPath: string): void;
  writePty(sessionId: string, data: string): void;
  resizePty(sessionId: string, cols: number, rows: number): void;
  killPty(sessionId: string): void;
  ptyExists(sessionId: string): Promise<boolean>;
  clearPty(sessionId: string): void;
  onPtyData(sessionId: string, callback: (data: string) => void): void;
  onPtyExit(sessionId: string, callback: (exitCode: number) => void): void;
  removePtyListeners(sessionId: string): void;
  
  // Session update listener
  onSessionUpdate(callback: (session: Session) => void): () => void;
}

declare global {
  interface Window {
    snowfortAPI: SnowfortAPI;
  }
}