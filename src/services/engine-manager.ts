// Engine Manager Service for Snowfort

import { spawn, ChildProcess } from 'child_process';
import { platform } from 'os';
import { EngineType, EngineConfig, SessionStatus } from '../types/engine';
import { EngineDetector } from './engine-detector';

export interface ManagedSession {
  id: string;
  engineType: EngineType;
  projectPath: string;
  process?: ChildProcess;
  status: SessionStatus;
  onOutput?: (data: string) => void;
  onStateChange?: (state: SessionStatus) => void;
}

export class EngineManager {
  private detector: EngineDetector;
  private sessions: Map<string, ManagedSession> = new Map();
  private pty: any; // Use 'any' for now to avoid complex node-pty types
  private currentPlatform: string;

  constructor(ptyInstance: any, currentPlatform: string) {
    this.detector = new EngineDetector();
    this.pty = ptyInstance;
    this.currentPlatform = currentPlatform;
  }

  async createSession(
    sessionId: string,
    engineType: EngineType,
    projectPath: string,
    onOutput?: (data: string) => void,
    onStateChange?: (state: SessionStatus) => void
  ): Promise<ManagedSession> {
    const config = this.detector.getEngineConfig(engineType);
    
    const session: ManagedSession = {
      id: sessionId,
      engineType,
      projectPath,
      status: 'idle',
      onOutput,
      onStateChange
    };

    // Store session
    this.sessions.set(sessionId, session);

    // Start the engine process
    await this.startEngineProcess(session, config);

    return session;
  }

  private async startEngineProcess(session: ManagedSession, config: EngineConfig): Promise<void> {
    try {
      console.log(`Starting ${config.name} with args:`, config.defaultArgs);
      
      // For Claude, start a real shell with Claude available
      if (config.type === 'claude') {
        this.spawnRealTerminal(session);
      } else {
        // Start the specific engine process
        this.spawnEngineProcess(session, config);
      }
      
      // Set initial state and wait for actual state detection from output
      session.status = 'idle';
      session.onStateChange?.('idle');
      
      // Set a timeout fallback in case no state patterns are detected
      setTimeout(() => {
        if (session.process && !session.process.killed && session.status === 'idle') {
          console.log(`${config.name} startup timeout, assuming ready`);
          session.status = 'ready';
          session.onStateChange?.('ready');
        }
      }, 3000);

    } catch (error) {
      console.error(`Failed to start ${config.name}:`, error);
      session.status = 'error';
      session.onStateChange?.('error');
    }
  }


  private spawnEngineProcess(session: ManagedSession, config: EngineConfig): void {
    const args = [...config.defaultArgs];
    
    // Customize args based on engine type
    switch (config.type) {
      case 'gemini':
        // For Gemini, we use npx to run the CLI
        break;
      case 'codex':
        // For Codex, might want to set a specific mode
        args.push('--suggest'); // Start in suggest mode
        break;
    }

    const childProcess = spawn(config.executable, args, {
      cwd: session.projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Add any specific environment variables
      }
    });

    session.process = childProcess;

    // Handle process output
    childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      session.onOutput?.(output);
      this.parseEngineState(session, output, config);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      session.onOutput?.(output);
      // Handle error patterns
      if (this.isErrorOutput(output, config)) {
        session.status = 'error';
        session.onStateChange?.('error');
      }
    });

    childProcess.on('exit', (code: number | null) => {
      if (code !== 0) {
        session.status = 'error';
        session.onStateChange?.('error');
      }
    });
  }

  private parseEngineState(session: ManagedSession, output: string, config: EngineConfig): void {
    // Normalize output for better pattern matching
    const normalizedOutput = output.toLowerCase().trim();
    
    // Check for error patterns first (highest priority)
    for (const pattern of config.statePatterns.error) {
      if (normalizedOutput.includes(pattern.toLowerCase())) {
        if (session.status !== 'error') {
          session.status = 'error';
          session.onStateChange?.('error');
          console.log(`Engine ${config.name} error detected: ${pattern}`);
        }
        return;
      }
    }

    // Check for completed patterns (transitions back to ready)
    for (const pattern of config.statePatterns.completed) {
      if (normalizedOutput.includes(pattern.toLowerCase())) {
        if (session.status !== 'ready') {
          session.status = 'ready';
          session.onStateChange?.('ready');
          console.log(`Engine ${config.name} task completed`);
        }
        return;
      }
    }

    // Check for working patterns
    for (const pattern of config.statePatterns.working) {
      if (normalizedOutput.includes(pattern.toLowerCase())) {
        if (session.status !== 'working') {
          session.status = 'working';
          session.onStateChange?.('working');
          console.log(`Engine ${config.name} is working`);
        }
        return;
      }
    }

    // Check for ready patterns (initial state)
    for (const pattern of config.statePatterns.ready) {
      if (normalizedOutput.includes(pattern.toLowerCase())) {
        if (session.status !== 'ready') {
          session.status = 'ready';
          session.onStateChange?.('ready');
          console.log(`Engine ${config.name} is ready`);
        }
        return;
      }
    }
  }

  private isErrorOutput(output: string, config: EngineConfig): boolean {
    return config.statePatterns.error.some(pattern => output.includes(pattern));
  }

  sendCommand(sessionId: string, command: string, retries = 3): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.engineType === 'claude') {
      this.sendCommandToRealTerminal(session, command);
    } else {
      this.sendCommandToEngineProcess(session, command, retries);
    }
  }

  private spawnRealTerminal(session: ManagedSession): void {
    console.log(`Starting real terminal for session ${session.id}`);
    
    // Optional node-pty import - fallback to null if not available
    let pty: any = null;
    try {
      pty = require('node-pty');
    } catch (error) {
      console.warn('[SNOWFORT-PTY] node-pty not available in EngineManager');
      session.onOutput?.('PTY terminal not available. Terminal functionality disabled.\r\n');
      session.status = 'error';
      session.onStateChange?.('error');
      return;
    }

    const shell = this.currentPlatform === 'win32' ? 'powershell.exe' :
                  this.currentPlatform === 'darwin' ? 'zsh' :
                  'bash';
    
    const args = this.currentPlatform === 'darwin' ? ['-l'] : (this.currentPlatform === 'linux' ? ['-l'] : []); // Use login shell for proper env

    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: session.projectPath,
      env: {
        ...process.env,
        PATH: this.currentPlatform === 'win32'
          ? `${process.env.PATH};${process.env.APPDATA}\npm`
          : `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` // Ensure common paths
      }
    });

    session.process = ptyProcess;

    ptyProcess.onData((data: string) => {
      session.onOutput?.(data);
      // No state parsing for real terminal, as it's interactive
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      session.onOutput?.(`\n\x1b[1;31mTerminal exited with code: ${exitCode}\x1b[0m\n`);
      session.status = 'error'; // Or 'exited'
      session.onStateChange?.('error');
    });

    ptyProcess.on('error', (error: Error) => {
      console.error(`PTY process error:`, error);
      session.onOutput?.(`Error: ${error.message}\n`);
      session.status = 'error';
      session.onStateChange?.('error');
    });

    session.status = 'ready';
    session.onStateChange?.('ready');
    session.onOutput?.(`Terminal ready. Type 'claude' to start Claude Code.\n`);
  }

  private sendCommandToRealTerminal(session: ManagedSession, command: string): void {
    if (session.process && 'write' in session.process) {
      (session.process as any).write(command + '\n');
    }
  }

  private sendCommandToEngineProcess(session: ManagedSession, command: string, retries = 3): void {
    const config = this.detector.getEngineConfig(session.engineType);

    // Check session health before sending command for other engines
    if (!this.checkSessionHealth(session.id)) {
      if (retries > 0) {
        console.log(`Session unhealthy, restarting and retrying command... (${retries} retries left)`);
        this.restartSession(session.id).then(() => {
          setTimeout(() => this.sendCommandToEngineProcess(session, command, retries - 1), 2000);
        }).catch(error => {
          console.error(`Failed to restart session: ${error.message}`);
        });
        return;
      } else {
        throw new Error(`Session ${session.id} is unhealthy and restart failed`);
      }
    }

    if (session.process) {
      // Real implementation for other engines
      try {
        session.process.stdin?.write(command + '\n');
        console.log(`Sent command to ${session.engineType}: ${command}`);
      } catch (error) {
        console.error(`Failed to send command: ${error}`);
        if (retries > 0) {
          setTimeout(() => this.sendCommandToEngineProcess(session, command, retries - 1), 1000);
        }
      }
    } else {
      console.warn(`No process available for session ${session.id}`);
      throw new Error(`Session ${session.id} has no active process`);
    }
  }


  terminateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.process) {
      session.process.kill();
    }
    this.sessions.delete(sessionId);
  }

  destroySession(sessionId: string): void {
    this.terminateSession(sessionId);
  }

  // Error recovery mechanism
  async restartSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    console.log(`Restarting session ${sessionId}...`);
    
    // Kill existing process
    if (session.process) {
      session.process.kill();
    }

    // Reset status
    session.status = 'idle';
    session.onStateChange?.('idle');

    // Restart the engine process
    const config = this.detector.getEngineConfig(session.engineType);
    await this.startEngineProcess(session, config);
  }

  // Health check for sessions
  checkSessionHealth(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if process is still alive
    if (session.process && session.process.killed) {
      console.log(`Session ${sessionId} process died, marking as error`);
      session.status = 'error';
      session.onStateChange?.('error');
      return false;
    }

    return true;
  }

  getSession(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): ManagedSession[] {
    return Array.from(this.sessions.values());
  }

  async detectAvailableEngines() {
    return this.detector.detectAvailableEngines();
  }
}