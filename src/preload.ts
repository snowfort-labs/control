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
  createSession: (projectId: string, name: string, engineType: string) =>
    ipcRenderer.invoke('db:createSession', projectId, name, engineType),

  // File system operations
  selectDirectory: () => ipcRenderer.invoke('fs:selectDirectory'),

  // Engine operations
  detectAvailableEngines: () => ipcRenderer.invoke('engine:detectAvailable'),
  createEngineSession: (sessionId: string, engineType: string, projectPath: string) =>
    ipcRenderer.invoke('engine:createSession', sessionId, engineType, projectPath),
  sendCommand: (sessionId: string, command: string) =>
    ipcRenderer.invoke('engine:sendCommand', sessionId, command),
  
  // Engine event listeners
  onEngineOutput: (callback: (sessionId: string, output: string) => void) => {
    ipcRenderer.on('engine:output', (_, sessionId, output) => callback(sessionId, output));
  },
  onEngineStateChange: (callback: (sessionId: string, state: string) => void) => {
    ipcRenderer.on('engine:stateChange', (_, sessionId, state) => callback(sessionId, state));
  },
  removeEngineListeners: () => {
    ipcRenderer.removeAllListeners('engine:output');
    ipcRenderer.removeAllListeners('engine:stateChange');
  },
  
  // PTY operations
  startPty: (sessionId: string, projectPath: string) => ipcRenderer.send('pty:start', sessionId, projectPath),
  writePty: (sessionId: string, data: string) => ipcRenderer.send('pty:write', sessionId, data),
  resizePty: (sessionId: string, cols: number, rows: number) => ipcRenderer.send('pty:resize', sessionId, { cols, rows }),
  killPty: (sessionId: string) => ipcRenderer.send('pty:kill', sessionId),
  onPtyData: (sessionId: string, callback: (data: string) => void) => {
    ipcRenderer.on(`pty:data:${sessionId}`, (_, data) => callback(data));
  },
  onPtyExit: (sessionId: string, callback: (exitCode: number) => void) => {
    ipcRenderer.on(`pty:exit:${sessionId}`, (_, exitCode) => callback(exitCode));
  },
  removePtyListeners: (sessionId: string) => {
    ipcRenderer.removeAllListeners(`pty:data:${sessionId}`);
    ipcRenderer.removeAllListeners(`pty:exit:${sessionId}`);
  }
};

contextBridge.exposeInMainWorld('snowfortAPI', snowfortAPI);
