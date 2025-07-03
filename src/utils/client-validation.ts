// Client-side Input Validation (renderer process safe)

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// String input validation (client-safe)
export class StringValidator {
  static validate(input: string, maxLength = 1000, field?: string): string {
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
}

// Number validation (client-safe)
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

  static validateTerminalSize(cols: number, rows: number): { cols: number; rows: number } {
    const validCols = this.validate(cols, 1, 1000, 'cols');
    const validRows = this.validate(rows, 1, 1000, 'rows');
    
    return { cols: validCols, rows: validRows };
  }
}