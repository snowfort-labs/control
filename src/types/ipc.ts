// IPC Interface Types for Snowfort

import { EngineAvailability, Project, Organization, Session, EngineType } from './engine';

export interface SnowfortAPI {
  // Database operations
  getProjects(): Promise<Project[]>;
  getOrganizations(): Promise<Organization[]>;
  getSessions(projectId?: string): Promise<Session[]>;
  createProject(name: string, path: string, organizationId?: string): Promise<Project>;
  createSession(projectId: string, name: string, engineType: EngineType): Promise<Session>;

  // File system operations
  selectDirectory(): Promise<string | null>;

  // Engine operations
  detectAvailableEngines(): Promise<EngineAvailability>;
  createEngineSession(sessionId: string, engineType: EngineType, projectPath: string): Promise<{
    success: boolean;
    session?: any;
    error?: string;
  }>;
  sendCommand(sessionId: string, command: string): Promise<{
    success: boolean;
    error?: string;
  }>;
  
  // Engine event listeners
  onEngineOutput(callback: (sessionId: string, output: string) => void): void;
  onEngineStateChange(callback: (sessionId: string, state: string) => void): void;
  removeEngineListeners(): void;
  
  // PTY operations
  startPty(sessionId: string, projectPath: string): void;
  writePty(sessionId: string, data: string): void;
  resizePty(sessionId: string, cols: number, rows: number): void;
  killPty(sessionId: string): void;
  onPtyData(sessionId: string, callback: (data: string) => void): void;
  onPtyExit(sessionId: string, callback: (exitCode: number) => void): void;
  removePtyListeners(sessionId: string): void;
}

declare global {
  interface Window {
    snowfortAPI: SnowfortAPI;
  }
}