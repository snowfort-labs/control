// Engine Detection Service for Snowfort

import { exec } from 'child_process';
import { promisify } from 'util';
import { EngineAvailability, EngineConfig, EngineType, EngineStatus } from '../types/engine';

const execAsync = promisify(exec);

export class EngineDetector {
  private getEngineConfigs(): Record<EngineType, EngineConfig> {
    return {
    gemini: {
      type: 'gemini',
      name: 'Gemini CLI',
      executable: 'gemini',
      defaultArgs: [],
      authMethod: 'google-login',
      detectCommand: 'gemini --version',
      statePatterns: {
        ready: ['How can I help you?', 'What would you like', 'I can see that', 'Looking at'],
        working: ['Thinking...', 'Generating...', 'Processing your request', 'Let me'],
        error: ['Error:', 'Failed:', 'Authentication required', 'API key', 'permission denied'],
        completed: ['I can help', 'Here\'s what', 'I\'ve completed', 'Done', 'I hope this helps']
      }
    },
    claude: {
      type: 'claude',
      name: 'Claude Code',
      executable: 'claude',
      defaultArgs: [],
      authMethod: 'oauth',
      installCommand: 'npm install -g claude-code',
      detectCommand: 'claude --version',
      statePatterns: {
        ready: ['ready to help', 'what would you like', 'how can I help', 'what would you like to work on', 'How can I assist you'],
        working: ['thinking', 'analyzing', 'processing', 'working on', 'let me', 'I\'ll help', 'examining'],
        error: ['error:', 'failed:', 'authentication required', 'could not determine', 'permission denied', 'not found'],
        completed: ['task completed', 'done', 'finished', 'completed successfully', 'I hope this helps', 'successfully']
      }
    },
    codex: {
      type: 'codex',
      name: 'OpenAI Codex CLI',
      executable: 'codex',
      defaultArgs: [],
      authMethod: 'api-key',
      installCommand: 'npm install -g @openai/codex',
      detectCommand: 'codex --version',
      statePatterns: {
        ready: ['❯', 'Select an option', '[use arrows to move', 'Mode:'],
        working: ['Loading...', 'Generating completion', 'Processing...', 'Executing'],
        error: ['ERROR', 'Error:', 'Sign in with ChatGPT', 'API key', 'not supported'],
        completed: ['✓', 'Complete', 'Done', 'Success']
      }
    }
    };
  }

  async detectAvailableEngines(): Promise<EngineAvailability> {
    const availability: EngineAvailability = {
      claude: 'not-installed',
      codex: 'not-installed',
      gemini: 'not-installed'
    };

    // Check each engine
    const engineConfigs = this.getEngineConfigs();
    for (const [engineType, config] of Object.entries(engineConfigs)) {
      try {
        const status = await this.checkEngineStatus(config);
        availability[engineType as EngineType] = status;
      } catch (error) {
        console.error(`Error checking ${engineType}:`, error);
        availability[engineType as EngineType] = 'not-installed';
      }
    }

    return availability;
  }

  private async checkEngineStatus(config: EngineConfig): Promise<EngineStatus> {
    try {
      // Check if the command exists by running version check
      const { stdout, stderr } = await execAsync(config.detectCommand);
      
      if (stderr && stderr.includes('command not found')) {
        return 'not-installed';
      }

      // If version command succeeds, consider it available
      // We skip slow authentication checks for better UX
      if (stdout) {
        return 'available';
      }

      return 'available';
    } catch (error: any) {
      if (error.message.includes('command not found') || error.code === 127) {
        return 'not-installed';
      }
      
      return 'not-installed';
    }
  }


  getEngineConfig(engineType: EngineType): EngineConfig {
    return this.getEngineConfigs()[engineType];
  }

  getAllEngineConfigs(): Record<EngineType, EngineConfig> {
    return this.getEngineConfigs();
  }
}