// Preload script for Snowfort - exposes IPC API to renderer

import { contextBridge, ipcRenderer } from 'electron';
import { SnowfortAPI } from './types/ipc';

const snowfortAPI: SnowfortAPI = {
  // Database operations
  getProjects: () => ipcRenderer.invoke('db:getProjects'),
  getOrganizations: () => ipcRenderer.invoke('db:getOrganizations'),
  getSessions: (projectId?: string) => ipcRenderer.invoke('db:getSessions', projectId),
  createProject: (name: string, path: string, organizationId?: string) => 
    ipcRenderer.invoke('db:createProject', name, path, organizationId),
  createSession: (projectId: string, name: string, engineType?: import('./types/engine').EngineType, initialCommand?: string) =>
    ipcRenderer.invoke('db:createSession', projectId, name, engineType, initialCommand),
  updateProject: (projectId: string, updates: any) =>
    ipcRenderer.invoke('db:updateProject', projectId, updates),
  updateSession: (sessionId: string, updates: any) =>
    ipcRenderer.invoke('db:updateSession', sessionId, updates),
  deleteSession: (sessionId: string) =>
    ipcRenderer.invoke('db:deleteSession', sessionId),

  // Task operations
  getTasks: (projectId: string) =>
    ipcRenderer.invoke('task:getTasks', projectId),
  createTask: (projectId: string, title: string, body: string, options?: any) =>
    ipcRenderer.invoke('task:createTask', projectId, title, body, options),
  updateTask: (taskId: string, updates: any) =>
    ipcRenderer.invoke('task:updateTask', taskId, updates),
  deleteTask: (taskId: string) =>
    ipcRenderer.invoke('task:deleteTask', taskId),

  // Task planning operations
  getTaskPlans: (projectId: string) =>
    ipcRenderer.invoke('task:getTaskPlans', projectId),
  createTaskPlan: (projectId: string, name: string, taskIds: string[]) =>
    ipcRenderer.invoke('task:createTaskPlan', projectId, name, taskIds),
  updateTaskPlan: (planId: string, updates: any) =>
    ipcRenderer.invoke('task:updateTaskPlan', planId, updates),
  analyzeTaskConflicts: (projectId: string, taskIds: string[]) =>
    ipcRenderer.invoke('task:analyzeTaskConflicts', projectId, taskIds),

  // GitHub integration
  importGitHubIssues: (projectId: string, owner: string, repo: string) =>
    ipcRenderer.invoke('task:importGitHubIssues', projectId, owner, repo),

  // File system operations
  selectDirectory: () => ipcRenderer.invoke('fs:selectDirectory'),

  
  // PTY operations
  startPty: (sessionId: string, projectPath: string) => ipcRenderer.send('pty:start', sessionId, projectPath),
  writePty: (sessionId: string, data: string) => ipcRenderer.send('pty:write', sessionId, data),
  resizePty: (sessionId: string, cols: number, rows: number) => ipcRenderer.send('pty:resize', sessionId, { cols, rows }),
  killPty: (sessionId: string) => ipcRenderer.send('pty:kill', sessionId),
  ptyExists: (sessionId: string) => ipcRenderer.invoke('pty:exists', sessionId),
  clearPty: (sessionId: string) => ipcRenderer.send('pty:clear', sessionId),
  onPtyData: (sessionId: string, callback: (data: string) => void) => {
    ipcRenderer.on(`pty:data:${sessionId}`, (_, data) => callback(data));
  },
  onPtyExit: (sessionId: string, callback: (exitCode: number) => void) => {
    ipcRenderer.on(`pty:exit:${sessionId}`, (_, exitCode) => callback(exitCode));
  },
  removePtyListeners: (sessionId: string) => {
    ipcRenderer.removeAllListeners(`pty:data:${sessionId}`);
    ipcRenderer.removeAllListeners(`pty:exit:${sessionId}`);
  },

  // Session update listener
  onSessionUpdate: (callback: (session: import('./types/engine').Session) => void) => {
    const channel = 'session:updated';
    const listener = (_: any, session: import('./types/engine').Session) => callback(session);
    ipcRenderer.on(channel, listener);
    // Return a function to remove the listener
    return () => ipcRenderer.removeListener(channel, listener);
  },

};

contextBridge.exposeInMainWorld('snowfortAPI', snowfortAPI);
