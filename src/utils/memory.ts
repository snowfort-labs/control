// Memory Management and Resource Cleanup for Snowfort Desktop

import { config } from '../config';
import { logger } from './logger';

export interface MemoryStats {
  totalBuffers: number;
  totalBufferSize: number;
  averageBufferSize: number;
  oldestBufferAge: number;
  memoryUsagePercent: number;
}

// Terminal buffer manager with proper cleanup
export class TerminalBufferManager {
  private buffers = new Map<string, {
    data: string;
    lastAccessed: number;
    createdAt: number;
  }>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    const appConfig = config.get();
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, appConfig.terminal.bufferCleanupInterval);
  }

  addBuffer(sessionId: string, data: string): void {
    const appConfig = config.get();
    const now = Date.now();
    
    try {
      const existing = this.buffers.get(sessionId);
      
      if (existing) {
        // Append new data
        let newData = existing.data + data;
        
        // Trim if exceeds max size
        if (newData.length > appConfig.terminal.maxBufferSize) {
          newData = newData.slice(-appConfig.terminal.maxBufferSize);
          logger.memory.debug('Buffer trimmed for session', { sessionId, originalSize: existing.data.length + data.length, newSize: newData.length });
        }
        
        this.buffers.set(sessionId, {
          data: newData,
          lastAccessed: now,
          createdAt: existing.createdAt,
        });
      } else {
        // Check if we've reached the buffer limit
        if (this.buffers.size >= appConfig.terminal.maxBuffersInMemory) {
          this.removeOldestBuffer();
        }
        
        // Create new buffer
        let trimmedData = data;
        if (data.length > appConfig.terminal.maxBufferSize) {
          trimmedData = data.slice(-appConfig.terminal.maxBufferSize);
          logger.memory.warn('Initial buffer data too large, trimmed', { sessionId, originalSize: data.length, newSize: trimmedData.length });
        }
        
        this.buffers.set(sessionId, {
          data: trimmedData,
          lastAccessed: now,
          createdAt: now,
        });
      }
    } catch (error) {
      logger.memory.error('Failed to add buffer data', error as Error, { sessionId, dataLength: data.length });
    }
  }

  getBuffer(sessionId: string): string | null {
    const buffer = this.buffers.get(sessionId);
    if (buffer) {
      buffer.lastAccessed = Date.now();
      return buffer.data;
    }
    return null;
  }

  removeBuffer(sessionId: string): void {
    const removed = this.buffers.delete(sessionId);
    if (removed) {
      logger.memory.debug('Buffer removed for session', { sessionId });
    }
  }

  private removeOldestBuffer(): void {
    let oldestSessionId: string | null = null;
    let oldestTime = Date.now();
    
    for (const [sessionId, buffer] of this.buffers.entries()) {
      if (buffer.lastAccessed < oldestTime) {
        oldestTime = buffer.lastAccessed;
        oldestSessionId = sessionId;
      }
    }
    
    if (oldestSessionId) {
      this.buffers.delete(oldestSessionId);
      logger.memory.info('Removed oldest buffer to free memory', { sessionId: oldestSessionId, age: Date.now() - oldestTime });
    }
  }

  private performCleanup(): void {
    const now = Date.now();
    const appConfig = config.get();
    const maxAge = appConfig.terminal.bufferCleanupInterval * 2; // Keep buffers for 2 cleanup cycles
    
    let removedCount = 0;
    
    for (const [sessionId, buffer] of this.buffers.entries()) {
      const age = now - buffer.lastAccessed;
      if (age > maxAge) {
        this.buffers.delete(sessionId);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      logger.memory.info('Cleaned up old terminal buffers', { removedCount, remainingBuffers: this.buffers.size });
    }
  }

  getStats(): MemoryStats {
    const now = Date.now();
    let totalSize = 0;
    let oldestAge = 0;
    
    for (const buffer of this.buffers.values()) {
      totalSize += buffer.data.length;
      const age = now - buffer.createdAt;
      if (age > oldestAge) {
        oldestAge = age;
      }
    }
    
    const appConfig = config.get();
    const maxTotalSize = appConfig.terminal.maxBuffersInMemory * appConfig.terminal.maxBufferSize;
    const memoryUsagePercent = maxTotalSize > 0 ? (totalSize / maxTotalSize) * 100 : 0;
    
    return {
      totalBuffers: this.buffers.size,
      totalBufferSize: totalSize,
      averageBufferSize: this.buffers.size > 0 ? totalSize / this.buffers.size : 0,
      oldestBufferAge: oldestAge,
      memoryUsagePercent,
    };
  }

  clearAll(): void {
    const count = this.buffers.size;
    this.buffers.clear();
    logger.memory.info('Cleared all terminal buffers', { count });
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clearAll();
  }
}

// PTY process manager with proper cleanup
export class PTYProcessManager {
  private processes = new Map<string, {
    process: any;
    startTime: number;
    lastActivity: number;
    projectPath: string;
  }>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 30000); // Check every 30 seconds
  }

  addProcess(sessionId: string, process: any, projectPath: string): void {
    const appConfig = config.get();
    
    // Check if we've reached the process limit
    if (this.processes.size >= appConfig.pty.maxConcurrentProcesses) {
      logger.pty.warn('Maximum PTY processes reached, cleaning up oldest');
      this.removeOldestProcess();
    }
    
    const now = Date.now();
    this.processes.set(sessionId, {
      process,
      startTime: now,
      lastActivity: now,
      projectPath,
    });
    
    logger.pty.info('PTY process added', { sessionId, projectPath, activeProcesses: this.processes.size });
  }

  getProcess(sessionId: string): any | null {
    const processInfo = this.processes.get(sessionId);
    if (processInfo) {
      processInfo.lastActivity = Date.now();
      return processInfo.process;
    }
    return null;
  }

  updateActivity(sessionId: string): void {
    const processInfo = this.processes.get(sessionId);
    if (processInfo) {
      processInfo.lastActivity = Date.now();
    }
  }

  removeProcess(sessionId: string): boolean {
    const processInfo = this.processes.get(sessionId);
    if (processInfo) {
      try {
        if (processInfo.process && processInfo.process.kill) {
          processInfo.process.kill();
        }
      } catch (error) {
        logger.pty.warn('Error killing PTY process', { error: (error as Error).message }, sessionId);
      }
      
      this.processes.delete(sessionId);
      logger.pty.info('PTY process removed', { sessionId, activeProcesses: this.processes.size });
      return true;
    }
    return false;
  }

  private removeOldestProcess(): void {
    let oldestSessionId: string | null = null;
    let oldestTime = Date.now();
    
    for (const [sessionId, processInfo] of this.processes.entries()) {
      if (processInfo.lastActivity < oldestTime) {
        oldestTime = processInfo.lastActivity;
        oldestSessionId = sessionId;
      }
    }
    
    if (oldestSessionId) {
      this.removeProcess(oldestSessionId);
      logger.pty.info('Removed oldest PTY process to free resources', { sessionId: oldestSessionId });
    }
  }

  private performCleanup(): void {
    const now = Date.now();
    const appConfig = config.get();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
    
    let removedCount = 0;
    
    for (const [sessionId, processInfo] of this.processes.entries()) {
      const inactiveTime = now - processInfo.lastActivity;
      
      // Remove processes that have been inactive for too long
      if (inactiveTime > inactiveThreshold) {
        this.removeProcess(sessionId);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      logger.pty.info('Cleaned up inactive PTY processes', { removedCount, activeProcesses: this.processes.size });
    }
  }

  getProcessCount(): number {
    return this.processes.size;
  }

  getAllProcesses(): string[] {
    return Array.from(this.processes.keys());
  }

  killAll(): void {
    const sessionIds = Array.from(this.processes.keys());
    for (const sessionId of sessionIds) {
      this.removeProcess(sessionId);
    }
    logger.pty.info('Killed all PTY processes');
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.killAll();
  }
}

// Global instances
export const terminalBufferManager = new TerminalBufferManager();
export const ptyProcessManager = new PTYProcessManager();

// Memory monitoring and alerts
export class MemoryMonitor {
  private monitorTimer: NodeJS.Timeout | null = null;

  start(): void {
    this.monitorTimer = setInterval(() => {
      this.checkMemoryUsage();
    }, 60000); // Check every minute
  }

  private checkMemoryUsage(): void {
    const stats = terminalBufferManager.getStats();
    const appConfig = config.get();
    
    if (stats.memoryUsagePercent > appConfig.resources.cleanupThreshold) {
      logger.memory.warn('High memory usage detected', {
        usage: stats.memoryUsagePercent,
        threshold: appConfig.resources.cleanupThreshold,
        stats,
      });
      
      // Force cleanup if usage is too high
      if (stats.memoryUsagePercent > 90) {
        logger.memory.error('Critical memory usage, forcing cleanup');
        this.forceCleanup();
      }
    }
  }

  private forceCleanup(): void {
    // Remove half of the oldest buffers
    const stats = terminalBufferManager.getStats();
    const targetsToRemove = Math.floor(stats.totalBuffers / 2);
    
    // This would require exposing more methods from TerminalBufferManager
    // For now, just log the need for cleanup
    logger.memory.error('Force cleanup needed but not implemented - consider restarting application');
  }

  stop(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }
}

export const memoryMonitor = new MemoryMonitor();

// Cleanup function for app shutdown
export function cleanupMemoryResources(): void {
  logger.memory.info('Cleaning up memory resources');
  
  terminalBufferManager.destroy();
  ptyProcessManager.destroy();
  memoryMonitor.stop();
  
  logger.memory.info('Memory cleanup completed');
}