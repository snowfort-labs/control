// Structured Logging System for Snowfort Desktop

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  sessionId?: string;
  projectId?: string;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  maxFileSize: number; // in bytes
  maxFiles: number;
  categories: string[];
}

const defaultLoggerConfig: LoggerConfig = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  categories: ['PTY', 'DATABASE', 'ENGINE', 'TERMINAL', 'IPC', 'SECURITY', 'MEMORY'],
};

class Logger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private maxInMemoryLogs = 1000;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultLoggerConfig, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private createLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    data?: any,
    sessionId?: string,
    projectId?: string,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      sessionId,
      projectId,
      error,
    };
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const contextParts = [];
    
    if (entry.sessionId) contextParts.push(`Session:${entry.sessionId}`);
    if (entry.projectId) contextParts.push(`Project:${entry.projectId}`);
    
    const context = contextParts.length > 0 ? ` [${contextParts.join(', ')}]` : '';
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    const errorStr = entry.error ? ` ERROR: ${entry.error.message}\n${entry.error.stack}` : '';
    
    return `${entry.timestamp} [${levelName}] [${entry.category}]${context} ${entry.message}${dataStr}${errorStr}`;
  }

  private addLogEntry(entry: LogEntry): void {
    // Add to in-memory buffer
    this.logs.push(entry);
    if (this.logs.length > this.maxInMemoryLogs) {
      this.logs.shift(); // Remove oldest entry
    }

    // Console output
    if (this.config.enableConsole) {
      const formatted = this.formatLogEntry(entry);
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(formatted);
          break;
        case LogLevel.INFO:
          console.info(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(formatted);
          break;
      }
    }
  }

  debug(category: string, message: string, data?: any, sessionId?: string, projectId?: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.addLogEntry(this.createLogEntry(LogLevel.DEBUG, category, message, data, sessionId, projectId));
    }
  }

  info(category: string, message: string, data?: any, sessionId?: string, projectId?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.addLogEntry(this.createLogEntry(LogLevel.INFO, category, message, data, sessionId, projectId));
    }
  }

  warn(category: string, message: string, data?: any, sessionId?: string, projectId?: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.addLogEntry(this.createLogEntry(LogLevel.WARN, category, message, data, sessionId, projectId));
    }
  }

  error(category: string, message: string, error?: Error, data?: any, sessionId?: string, projectId?: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.addLogEntry(this.createLogEntry(LogLevel.ERROR, category, message, data, sessionId, projectId, error));
    }
  }

  fatal(category: string, message: string, error?: Error, data?: any, sessionId?: string, projectId?: string): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      this.addLogEntry(this.createLogEntry(LogLevel.FATAL, category, message, data, sessionId, projectId, error));
    }
  }

  // Convenience methods for specific categories
  pty = {
    debug: (message: string, data?: any, sessionId?: string) => this.debug('PTY', message, data, sessionId),
    info: (message: string, data?: any, sessionId?: string) => this.info('PTY', message, data, sessionId),
    warn: (message: string, data?: any, sessionId?: string) => this.warn('PTY', message, data, sessionId),
    error: (message: string, error?: Error, data?: any, sessionId?: string) => this.error('PTY', message, error, data, sessionId),
  };

  database = {
    debug: (message: string, data?: any) => this.debug('DATABASE', message, data),
    info: (message: string, data?: any) => this.info('DATABASE', message, data),
    warn: (message: string, data?: any) => this.warn('DATABASE', message, data),
    error: (message: string, error?: Error, data?: any) => this.error('DATABASE', message, error, data),
  };

  engine = {
    debug: (message: string, data?: any, sessionId?: string) => this.debug('ENGINE', message, data, sessionId),
    info: (message: string, data?: any, sessionId?: string) => this.info('ENGINE', message, data, sessionId),
    warn: (message: string, data?: any, sessionId?: string) => this.warn('ENGINE', message, data, sessionId),
    error: (message: string, error?: Error, data?: any, sessionId?: string) => this.error('ENGINE', message, error, data, sessionId),
  };

  terminal = {
    debug: (message: string, data?: any, sessionId?: string) => this.debug('TERMINAL', message, data, sessionId),
    info: (message: string, data?: any, sessionId?: string) => this.info('TERMINAL', message, data, sessionId),
    warn: (message: string, data?: any, sessionId?: string) => this.warn('TERMINAL', message, data, sessionId),
    error: (message: string, error?: Error, data?: any, sessionId?: string) => this.error('TERMINAL', message, error, data, sessionId),
  };

  ipc = {
    debug: (message: string, data?: any) => this.debug('IPC', message, data),
    info: (message: string, data?: any) => this.info('IPC', message, data),
    warn: (message: string, data?: any) => this.warn('IPC', message, data),
    error: (message: string, error?: Error, data?: any) => this.error('IPC', message, error, data),
  };

  security = {
    debug: (message: string, data?: any) => this.debug('SECURITY', message, data),
    info: (message: string, data?: any) => this.info('SECURITY', message, data),
    warn: (message: string, data?: any) => this.warn('SECURITY', message, data),
    error: (message: string, error?: Error, data?: any) => this.error('SECURITY', message, error, data),
  };

  memory = {
    debug: (message: string, data?: any) => this.debug('MEMORY', message, data),
    info: (message: string, data?: any) => this.info('MEMORY', message, data),
    warn: (message: string, data?: any) => this.warn('MEMORY', message, data),
    error: (message: string, error?: Error, data?: any) => this.error('MEMORY', message, error, data),
  };

  // Get recent logs for debugging
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Get logs by category
  getLogsByCategory(category: string, count: number = 100): LogEntry[] {
    return this.logs
      .filter(log => log.category === category)
      .slice(-count);
  }

  // Clear in-memory logs
  clearLogs(): void {
    this.logs = [];
  }

  // Update configuration
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton logger instance
export const logger = new Logger();

// Helper function for performance logging
export function logPerformance<T>(
  category: string,
  operation: string,
  fn: () => T,
  sessionId?: string,
  projectId?: string
): T {
  const start = Date.now();
  logger.debug(category, `Starting ${operation}`, undefined, sessionId, projectId);
  
  try {
    const result = fn();
    const duration = Date.now() - start;
    logger.debug(category, `Completed ${operation}`, { duration }, sessionId, projectId);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(category, `Failed ${operation}`, error as Error, { duration }, sessionId, projectId);
    throw error;
  }
}

// Helper function for async performance logging
export async function logAsyncPerformance<T>(
  category: string,
  operation: string,
  fn: () => Promise<T>,
  sessionId?: string,
  projectId?: string
): Promise<T> {
  const start = Date.now();
  logger.debug(category, `Starting ${operation}`, undefined, sessionId, projectId);
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.debug(category, `Completed ${operation}`, { duration }, sessionId, projectId);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(category, `Failed ${operation}`, error as Error, { duration }, sessionId, projectId);
    throw error;
  }
}