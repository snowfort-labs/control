// Simple, Reliable Engine Detection
// Supports multiple engines through configurable patterns
// Two states: engine active (with name) or idle (null)

import { ENGINE_PATTERNS, SHELL_PATTERNS, EnginePatterns } from './engine-patterns';

export interface SimpleDetection {
  engine: string | null;
  status: 'ready' | 'busy';
}

export class SimpleEngineDetector {
  private sessionId: string;
  private currentEngine: string | null = null;
  private lastStatus: 'ready' | 'busy' = 'ready';
  private lastStateChange: number = 0;
  private readonly STATE_CHANGE_DEBOUNCE_MS = 100; // Prevent rapid flickering
  
  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  processOutput(data: string): SimpleDetection | null {
    // PRIORITY-BASED DETECTION: Check highest priority states first
    
    // PRIORITY 1: ENGINE EXIT (highest priority - overrides everything)
    if (this.detectShellPrompt(data)) {
      // Shell prompt detected - resetting to terminal
      this.currentEngine = null;
      this.lastStatus = 'ready';
      this.lastStateChange = Date.now();
      return {
        engine: null,
        status: 'ready'
      };
    }

    // PRIORITY 2: ENGINE STARTUP (detect any engine startup)
    if (!this.currentEngine) {
      const detectedEngine = this.detectEngineStartup(data);
      if (detectedEngine) {
        // Engine startup detected
        this.currentEngine = detectedEngine;
        this.lastStatus = 'ready';
        this.lastStateChange = Date.now();
        return {
          engine: detectedEngine,
          status: 'ready'
        };
      }
    }

    // PRIORITY 3: ENGINE BUSY (when engine is active and busy indicator present)
    if (this.currentEngine && this.detectEngineBusy(data)) {
      const now = Date.now();
      // Only transition to busy if we're not already busy or debounce period has passed
      if (this.lastStatus !== 'busy' || (now - this.lastStateChange) > this.STATE_CHANGE_DEBOUNCE_MS) {
        // Transitioning to busy state
        this.lastStatus = 'busy';
        this.lastStateChange = now;
        return {
          engine: this.currentEngine,
          status: 'busy'
        };
      }
    }

    // PRIORITY 4: ENGINE READY (when engine is active and ready prompt present)
    if (this.currentEngine && this.detectEngineReady(data)) {
      const now = Date.now();
      // Only transition to ready if we're not already ready or debounce period has passed
      if (this.lastStatus !== 'ready' || (now - this.lastStateChange) > this.STATE_CHANGE_DEBOUNCE_MS) {
        // Transitioning to ready state
        this.lastStatus = 'ready';
        this.lastStateChange = now;
        return {
          engine: this.currentEngine,
          status: 'ready'
        };
      }
    }

    // PRIORITY 5: IMPLICIT READY (if busy but no longer showing busy indicators)
    // This handles engines like Codex that might not show explicit ready prompts after completing
    if (this.currentEngine && this.lastStatus === 'busy') {
      const now = Date.now();
      // If we haven't seen busy indicators for a while, transition back to ready
      if (!this.detectEngineBusy(data) && (now - this.lastStateChange) > 500) {
        // No busy indicators detected and enough time has passed
        this.lastStatus = 'ready';
        this.lastStateChange = now;
        return {
          engine: this.currentEngine,
          status: 'ready'
        };
      }
    }

    // No state change
    return null;
  }

  private detectEngineStartup(data: string): string | null {
    // All three engines (Claude, Gemini, Codex) may use similar box UI patterns
    // So we need to check for unique identifiers first before falling back to generic patterns
    
    // Check for Gemini-specific patterns first
    if (/gemini-\d+(\.\d+)?(-\w+)?/i.test(data) || /GEMINI\.md/.test(data)) {
      return 'gemini';
    }
    
    // Check for Claude-specific patterns
    if (/Welcome to.*Claude Code/i.test(data) || /claude.*code/i.test(data) || /\? for shortcuts/.test(data)) {
      return 'claude';
    }
    
    // Check for Codex-specific patterns
    if (/codex/i.test(data) || /OpenAI\s+Codex/i.test(data)) {
      return 'codex';
    }
    
    // If we see the box UI but can't identify the specific engine, we might need more data
    // For now, if we see box UI alone, we'll wait for more specific patterns
    const hasBoxUI = /╭────.*───╮.*│.*│.*╰────.*───╯/s.test(data);
    if (hasBoxUI) {
      // Box UI detected but no specific engine markers yet
      // Could be any of the three engines - need to wait for more data
      return null;
    }
    
    return null;
  }

  private detectEngineBusy(data: string): boolean {
    if (!this.currentEngine) return false;
    
    const patterns = ENGINE_PATTERNS[this.currentEngine];
    if (!patterns) return false;
    
    return this.matchesAnyPattern(data, patterns.busy);
  }

  private detectEngineReady(data: string): boolean {
    if (!this.currentEngine) return false;
    
    const patterns = ENGINE_PATTERNS[this.currentEngine];
    if (!patterns) return false;
    
    // Check ready patterns and ensure we're not also busy
    return this.matchesAnyPattern(data, patterns.ready) && 
           !this.matchesAnyPattern(data, patterns.busy);
  }

  private detectShellPrompt(data: string): boolean {
    // Primary check: bracketed paste mode
    if (!SHELL_PATTERNS.bracketedPasteMode.test(data)) {
      return false;
    }
    
    // Secondary check: ensure it's actually a shell prompt
    // by looking for shell-specific patterns nearby
    return SHELL_PATTERNS.prompts.some(pattern => pattern.test(data));
  }

  private matchesAnyPattern(data: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(data));
  }

  getCurrentEngine(): string | null {
    return this.currentEngine;
  }

  reset(): void {
    this.currentEngine = null;
    this.lastStatus = 'ready';
    this.lastStateChange = 0;
  }
  
  // Method to set engine type when detected through other means (e.g., user command)
  setEngine(engine: string): void {
    this.currentEngine = engine;
    this.lastStatus = 'ready';
    this.lastStateChange = Date.now();
  }
}