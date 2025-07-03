// Input Validation and Sanitization for Snowfort Desktop

import { config } from '../config';
import { logger } from './logger';
import path from 'path';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Path validation and sanitization
export class PathValidator {
  static validate(inputPath: string): string {
    const appConfig = config.get();
    
    if (!inputPath || typeof inputPath !== 'string') {
      throw new ValidationError('Path must be a non-empty string', 'path');
    }

    if (inputPath.length > appConfig.security.maxPathLength) {
      throw new ValidationError(`Path exceeds maximum length of ${appConfig.security.maxPathLength}`, 'path');
    }

    // Remove null bytes and other dangerous characters
    const sanitized = inputPath.replace(/\0/g, '');
    
    // Check for path traversal attempts
    if (sanitized.includes('..') || sanitized.includes('~')) {
      logger.security.warn('Path traversal attempt detected', { originalPath: inputPath, sanitized });
      throw new ValidationError('Path contains invalid traversal sequences', 'path');
    }

    // Normalize the path
    const normalized = path.normalize(sanitized);
    
    // Check against allowed patterns
    const isAllowed = appConfig.security.allowedPathPatterns.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(normalized);
    });

    if (!isAllowed) {
      logger.security.warn('Path not in allowed patterns', { path: normalized });
      throw new ValidationError('Path is not in allowed directories', 'path');
    }

    return normalized;
  }

  static validateProjectPath(projectPath: string): string {
    const validated = this.validate(projectPath);
    
    // Additional checks for project paths
    if (!path.isAbsolute(validated)) {
      throw new ValidationError('Project path must be absolute', 'projectPath');
    }

    return validated;
  }
}

// String input validation
export class StringValidator {
  static validate(input: string, maxLength: number = config.get().security.maxInputLength, field?: string): string {
    if (typeof input !== 'string') {
      throw new ValidationError(`${field || 'Input'} must be a string`, field);
    }

    if (input.length > maxLength) {
      throw new ValidationError(`${field || 'Input'} exceeds maximum length of ${maxLength}`, field);
    }

    // Remove null bytes and control characters except newlines and tabs
    const sanitized = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    
    return sanitized;
  }

  static validateSessionName(name: string): string {
    const sanitized = this.validate(name, 100, 'sessionName');
    
    if (sanitized.trim().length === 0) {
      throw new ValidationError('Session name cannot be empty', 'sessionName');
    }

    // Remove special characters that could cause issues
    return sanitized.replace(/[<>:"/\\|?*]/g, '').trim();
  }

  static validateProjectName(name: string): string {
    const sanitized = this.validate(name, 100, 'projectName');
    
    if (sanitized.trim().length === 0) {
      throw new ValidationError('Project name cannot be empty', 'projectName');
    }

    // Remove special characters that could cause issues
    return sanitized.replace(/[<>:"/\\|?*]/g, '').trim();
  }
}

// Number validation
export class NumberValidator {
  static validate(input: number, min?: number, max?: number, field?: string): number {
    if (typeof input !== 'number' || isNaN(input)) {
      throw new ValidationError(`${field || 'Input'} must be a valid number`, field);
    }

    if (min !== undefined && input < min) {
      throw new ValidationError(`${field || 'Input'} must be at least ${min}`, field);
    }

    if (max !== undefined && input > max) {
      throw new ValidationError(`${field || 'Input'} must be at most ${max}`, field);
    }

    return input;
  }

  static validateSessionCount(count: number): number {
    return this.validate(count, 0, config.get().session.maxSessions, 'sessionCount');
  }

  static validateTerminalSize(cols: number, rows: number): { cols: number; rows: number } {
    const validCols = this.validate(cols, 1, 1000, 'cols');
    const validRows = this.validate(rows, 1, 1000, 'rows');
    
    return { cols: validCols, rows: validRows };
  }
}

// Engine type validation
export class EngineValidator {
  private static validEngineTypes = ['claude', 'gemini', 'codex'] as const;
  
  static validate(engineType: string): string {
    if (!this.validEngineTypes.includes(engineType as any)) {
      throw new ValidationError(`Invalid engine type: ${engineType}. Must be one of: ${this.validEngineTypes.join(', ')}`, 'engineType');
    }
    
    return engineType;
  }

  static validateOptional(engineType?: string): string | undefined {
    if (engineType === undefined || engineType === null) {
      return undefined;
    }
    
    return this.validate(engineType);
  }
}

// Session status validation
export class StatusValidator {
  private static validStatuses = ['idle', 'ready', 'working', 'error', 'completed'] as const;
  
  static validate(status: string): string {
    if (!this.validStatuses.includes(status as any)) {
      throw new ValidationError(`Invalid status: ${status}. Must be one of: ${this.validStatuses.join(', ')}`, 'status');
    }
    
    return status;
  }
}

// Rate limiting for IPC calls
export class RateLimiter {
  private callCounts = new Map<string, { count: number; resetTime: number }>();
  
  checkLimit(identifier: string): boolean {
    const appConfig = config.get();
    const now = Date.now();
    const windowSize = appConfig.security.rateLimitWindow;
    const maxCalls = appConfig.security.rateLimitMax;
    
    const current = this.callCounts.get(identifier);
    
    if (!current || now > current.resetTime) {
      // Reset or initialize
      this.callCounts.set(identifier, {
        count: 1,
        resetTime: now + windowSize,
      });
      return true;
    }
    
    if (current.count >= maxCalls) {
      logger.security.warn('Rate limit exceeded', { identifier, count: current.count, maxCalls });
      return false;
    }
    
    current.count++;
    return true;
  }
  
  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.callCounts.entries()) {
      if (now > value.resetTime) {
        this.callCounts.delete(key);
      }
    }
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Cleanup old rate limit entries every minute
setInterval(() => rateLimiter.cleanup(), 60000);

// Object validation helper
export function validateObject<T>(
  obj: any,
  validators: { [K in keyof T]?: (value: any) => T[K] }
): T {
  const result = {} as T;
  
  for (const [key, validator] of Object.entries(validators)) {
    if (validator && Object.prototype.hasOwnProperty.call(obj, key)) {
      try {
        const typedValidator = validator as (value: any) => any;
        result[key as keyof T] = typedValidator((obj as any)[key]);
      } catch (error) {
        logger.security.error('Validation failed', error as Error, { key, value: (obj as any)[key] });
        throw error;
      }
    }
  }
  
  return result;
}

// Sanitize configuration object
export function sanitizeConfig(config: any): any {
  if (typeof config !== 'object' || config === null) {
    return {};
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(config)) {
    if (typeof key === 'string' && key.length <= 100) {
      const sanitizedKey = StringValidator.validate(key, 100);
      
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = StringValidator.validate(value, 1000);
      } else if (typeof value === 'number' && !isNaN(value)) {
        sanitized[sanitizedKey] = value;
      } else if (typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.filter(item => 
          typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
        );
      }
    }
  }
  
  return sanitized;
}