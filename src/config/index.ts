// Configuration System for Snowfort Desktop

export interface AppConfig {
  // Terminal Configuration
  terminal: {
    maxBufferSize: number;
    maxBuffersInMemory: number;
    bufferCleanupInterval: number;
    defaultFontSize: number;
    defaultFontFamily: string;
  };
  
  // PTY Configuration
  pty: {
    processTimeout: number;
    maxConcurrentProcesses: number;
    killTimeout: number;
    resizeDebounce: number;
  };
  
  // Session Management
  session: {
    maxSessions: number;
    maxSessionsPerProject: number;
    sessionStateTimeout: number;
    animationTimeout: number;
    stateCheckInterval: number;
  };
  
  // Database Configuration
  database: {
    backupInterval: number;
    maxQueryTimeout: number;
    connectionPool: number;
  };
  
  // Engine Detection
  engine: {
    detectionTimeout: number;
    maxOutputFrequencyChecks: number;
    silentTimeout: number;
    workingStateTimeout: number;
  };
  
  // Resource Limits
  resources: {
    maxMemoryUsage: number; // in MB
    maxDiskUsage: number; // in MB
    cleanupThreshold: number; // percentage
  };
  
  // Security
  security: {
    maxPathLength: number;
    allowedPathPatterns: string[];
    maxInputLength: number;
    rateLimitWindow: number; // in ms
    rateLimitMax: number; // max requests per window
  };
}

// Default configuration
export const defaultConfig: AppConfig = {
  terminal: {
    maxBufferSize: 50000, // 50KB per buffer
    maxBuffersInMemory: 20, // Max 20 session buffers
    bufferCleanupInterval: 300000, // 5 minutes
    defaultFontSize: 14,
    defaultFontFamily: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
  },
  
  pty: {
    processTimeout: 30000, // 30 seconds
    maxConcurrentProcesses: 10,
    killTimeout: 5000, // 5 seconds
    resizeDebounce: 250, // 250ms
  },
  
  session: {
    maxSessions: 50,
    maxSessionsPerProject: 10,
    sessionStateTimeout: 30000, // 30 seconds
    animationTimeout: 1500, // 1.5 seconds
    stateCheckInterval: 500, // 500ms
  },
  
  database: {
    backupInterval: 3600000, // 1 hour
    maxQueryTimeout: 10000, // 10 seconds
    connectionPool: 5,
  },
  
  engine: {
    detectionTimeout: 5000, // 5 seconds
    maxOutputFrequencyChecks: 10,
    silentTimeout: 2000, // 2 seconds
    workingStateTimeout: 30000, // 30 seconds
  },
  
  resources: {
    maxMemoryUsage: 512, // 512MB
    maxDiskUsage: 1024, // 1GB
    cleanupThreshold: 80, // 80%
  },
  
  security: {
    maxPathLength: 1000,
    allowedPathPatterns: [
      '^/Users/[^/]+/.*',
      '^/home/[^/]+/.*',
      '^[A-Z]:\\\\Users\\\\[^\\\\]+\\\\.*',
      '^[A-Z]:\\\\Projects\\\\.*',
    ],
    maxInputLength: 10000,
    rateLimitWindow: 1000, // 1 second
    rateLimitMax: 100, // 100 requests per second
  },
};

// Configuration manager
class ConfigManager {
  private config: AppConfig;
  
  constructor() {
    this.config = { ...defaultConfig };
  }
  
  get(): AppConfig {
    return this.config;
  }
  
  update(updates: Partial<AppConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }
  
  reset(): void {
    this.config = { ...defaultConfig };
  }
  
  private mergeConfig(current: AppConfig, updates: Partial<AppConfig>): AppConfig {
    const merged = { ...current };
    
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        (merged as any)[key] = {
          ...(merged as any)[key],
          ...value,
        };
      } else {
        (merged as any)[key] = value;
      }
    }
    
    return merged;
  }
}

// Singleton instance
export const config = new ConfigManager();