// Engine-specific patterns for detection
// This file makes it easy to add support for new engines

export interface EnginePatterns {
  name: string;
  startup: RegExp[];
  busy: RegExp[];
  ready: RegExp[];
  exit?: RegExp[]; // Optional engine-specific exit patterns
}

export const ENGINE_PATTERNS: Record<string, EnginePatterns> = {
  claude: {
    name: 'claude',
    startup: [
      // The distinctive box UI that only appears when Claude starts
      /╭────.*───╮.*│.*│.*╰────.*───╯/s,
      // Welcome message
      /Welcome to.*Claude Code/i,
      // Help text that appears when Claude is ready
      /\? for shortcuts/,
    ],
    busy: [
      // Look for "esc to interrupt" - the definitive busy indicator
      /esc.*to.*interrupt/i,
    ],
    ready: [
      // The input box that appears when ready for input
      /╭────.*───╮.*│.*>\s.*│.*╰────.*───╯/s,
      // Help text indicating ready for input
      /\? for shortcuts/,
    ],
  },
  
  gemini: {
    name: 'gemini',
    startup: [
      // Look for Gemini references in the box UI (more flexible than specific versions)
      /╭────.*───╮.*│.*gemini.*│.*╰────.*───╯/is,
      // Any version of gemini model reference
      /gemini-\d+(\.\d+)?(-\w+)?/i,  // Matches gemini-2, gemini-2.5, gemini-2.5-pro, etc.
      // GEMINI.md reference is stable
      /GEMINI\.md/,
      // Common Gemini CLI startup patterns
      /Gemini\s+CLI/i,
      /Welcome\s+to\s+Gemini/i,
      /Google\s+(AI\s+)?Gemini/i
    ],
    busy: [
      // "esc to interrupt" pattern
      /esc.*to.*interrupt/i,
      // Spinner characters used by Gemini
      /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/,
    ],
    ready: [
      // Box UI input prompt (same as Claude)
      /╭────.*───╮.*│.*>\s.*│.*╰────.*───╯/s,
      // Common prompt patterns
      /gemini\s*>/i,
      /gemini\s*❯/
    ],
  },
  
  codex: {
    name: 'codex',
    startup: [
      // We've only seen the box UI pattern in the logs for Codex
      /╭────.*───╮.*│.*│.*╰────.*───╯/s,
      // Codex-specific references
      /codex/i,
      /OpenAI\s+Codex/i,
    ],
    busy: [
      // Codex shows a bouncing dot animation with "Thinking.."
      /\(\s*●\s*\)/,  // Dot in various positions
      /\(●\s+\)/,     // Dot on left
      /\(\s+●\)/,     // Dot on right
      /\(\s+●\s+\)/,  // Dot in middle
      /Thinking\.\./,  // The "Thinking.." text
      /press\s+Esc\s+twice\s+to\s+interrupt/i,  // Interrupt instruction
      /\d+s/,  // Time counter (e.g., "5s")
    ],
    ready: [
      // The box UI input prompt (same as other engines)
      /╭────.*───╮.*│.*>\s.*│.*╰────.*───╯/s,
      // After response, Codex might just show a simple prompt
      />\s*$/m,
      // Or might clear the busy indicator without showing full box
      /\u001b\[2K.*(?!Thinking|●)/,
    ],
  },
};

// Shell patterns that work across different shells
export const SHELL_PATTERNS = {
  // Primary indicator: bracketed paste mode is enabled
  bracketedPasteMode: /\u001b\[\?2004h/,
  
  // Shell prompt patterns
  prompts: [
    /%\s*(?:\u001b\[[^m]*m)*\s*(?:\u001b\[K)?\s*$/,  // zsh/bash with %
    /\$\s*(?:\u001b\[[^m]*m)*\s*(?:\u001b\[K)?\s*$/,  // bash/sh with $
    /\([^)]+\)\s+[\w@.-]+/,  // (env) user@host pattern
    />\s*$/,  // PowerShell
  ],
};