import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Session } from '../types/engine';
import { terminalBufferManager } from '../utils/memory';
import { logger } from '../utils/logger';
import { config } from '../config';
import { StringValidator, NumberValidator } from '../utils/client-validation';

// Utility function to get terminal theme from CSS variables
const getTerminalTheme = () => {
  const computedStyle = getComputedStyle(document.documentElement);
  const getCSSVar = (name: string) => computedStyle.getPropertyValue(name).trim();
  
  return {
    background: getCSSVar('--bg-primary'),
    foreground: getCSSVar('--text-primary'),
    cursor: getCSSVar('--accent-color'),
    cursorAccent: getCSSVar('--bg-primary'),
    selection: getCSSVar('--accent-color') + '30',
    selectionForeground: getCSSVar('--bg-primary'),
    
    black: getCSSVar('--text-primary'),
    red: getCSSVar('--error-red'),
    green: getCSSVar('--success-green'),
    yellow: getCSSVar('--warning-yellow'),
    blue: getCSSVar('--accent-blue'),
    magenta: getCSSVar('--accent-color'),
    cyan: getCSSVar('--success-green'),
    white: getCSSVar('--text-secondary'),
    
    brightBlack: getCSSVar('--text-muted'),
    brightRed: getCSSVar('--error-red'),
    brightGreen: getCSSVar('--success-green'),
    brightYellow: getCSSVar('--warning-yellow'),
    brightBlue: getCSSVar('--accent-blue'),
    brightMagenta: getCSSVar('--accent-color'),
    brightCyan: getCSSVar('--success-green'),
    brightWhite: getCSSVar('--text-primary'),
  };
};

interface TerminalProps {
  session: Session;
  projectPath: string;
  engineType?: string;
  onStateChange?: (state: { status: string; message?: string }) => void;
}

// Clear terminal buffer for a specific session
export const clearTerminalBuffer = (sessionId: string) => {
  try {
    terminalBufferManager.removeBuffer(sessionId);
    logger.terminal.info('Terminal buffer cleared', undefined, sessionId);
  } catch (error) {
    logger.terminal.error('Failed to clear terminal buffer', error as Error, undefined, sessionId);
  }
};

export const TerminalComponent: React.FC<TerminalProps> = ({ session, projectPath, engineType }) => {
  const sessionId = session.id;
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  // Theme change handler
  const updateTerminalTheme = () => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = getTerminalTheme();
    }
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const appConfig = config.get();
    
    let term: XTerm | null = null;
    let fitAddon: FitAddon | null = null;
    
    try {
      term = new XTerm({
        cursorBlink: true,
        fontSize: appConfig.terminal.defaultFontSize,
        fontFamily: appConfig.terminal.defaultFontFamily,
        theme: getTerminalTheme(),
        convertEol: true,
        scrollback: 1000,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(terminalRef.current);
      fitAddon.fit();
      term.focus();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
      
      logger.terminal.info('Terminal initialized', { sessionId, fontSize: appConfig.terminal.defaultFontSize }, sessionId);

      // Start the PTY process only if not already running
      const initializePty = async () => {
        try {
          const validatedProjectPath = StringValidator.validate(projectPath, 1000, 'projectPath');
          const exists = await window.snowfortAPI.ptyExists(sessionId);
          
          if (!exists) {
            window.snowfortAPI.startPty(sessionId, validatedProjectPath);
            logger.pty.info('PTY process started', { projectPath: validatedProjectPath }, sessionId);
            
            // Execute initial command if provided
            const initialCommand = session.config?.initialCommand;
            if (initialCommand) {
              const validatedCommand = StringValidator.validate(initialCommand, 1000, 'initialCommand');
              setTimeout(() => {
                window.snowfortAPI.writePty(sessionId, validatedCommand + '\r');
                logger.pty.debug('Initial command executed', { command: validatedCommand }, sessionId);
              }, 1000);
            }
          } else {
            logger.pty.debug('PTY process already exists', undefined, sessionId);
          }
        } catch (error) {
          logger.pty.error('Failed to initialize PTY', error as Error, { projectPath }, sessionId);
        }
      };
      
      initializePty();

      // Clear existing listeners to prevent duplicates
      window.snowfortAPI.removePtyListeners(sessionId);
      
      // Restore terminal buffer if it exists
      const savedBuffer = terminalBufferManager.getBuffer(sessionId);
      if (savedBuffer) {
        term.write(savedBuffer);
        logger.terminal.debug('Terminal buffer restored', { bufferSize: savedBuffer.length }, sessionId);
      }

      // Handle PTY data with buffer storage
      window.snowfortAPI.onPtyData(sessionId, (data) => {
        try {
          if (term) {
            term.write(data);
            
            // Store data in buffer manager for session persistence
            terminalBufferManager.addBuffer(sessionId, data);
          }
        } catch (error) {
          logger.terminal.error('Failed to handle PTY data', error as Error, { dataLength: data.length }, sessionId);
        }
      });

      // Handle PTY exit
      window.snowfortAPI.onPtyExit(sessionId, (exitCode) => {
        try {
          if (term) {
            const validatedExitCode = NumberValidator.validate(exitCode, -2147483648, 2147483647, 'exitCode');
            term.writeln(`\n\x1b[1;31mProcess exited with code: ${validatedExitCode}\x1b[0m`);
            logger.pty.info('PTY process exited', { exitCode: validatedExitCode }, sessionId);
          }
        } catch (error) {
          logger.terminal.error('Failed to handle PTY exit', error as Error, { exitCode }, sessionId);
        }
      });

      // Handle user input - pass data through unchanged
      term.onData((data) => {
        try {
          // CRITICAL: Pass raw data directly without any processing or validation
          // Do NOT validate, sanitize, or modify the data as it will break escape sequences
          // Arrow keys send sequences like \x1b[D which must be preserved exactly
          window.snowfortAPI.writePty(sessionId, data);
        } catch (error) {
          logger.terminal.error('Failed to handle user input', error as Error, { dataLength: data.length }, sessionId);
        }
      });

      // Handle terminal resize with debouncing
      let resizeTimeout: NodeJS.Timeout | null = null;
      const handleResize = () => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        
        resizeTimeout = setTimeout(() => {
          try {
            if (fitAddon) {
              fitAddon.fit();
              const dimensions = fitAddon.proposeDimensions();
              if (dimensions) {
                const validated = NumberValidator.validateTerminalSize(dimensions.cols, dimensions.rows);
                window.snowfortAPI.resizePty(sessionId, validated.cols, validated.rows);
                logger.terminal.debug('Terminal resized', validated, sessionId);
              }
            }
          } catch (error) {
            logger.terminal.error('Failed to handle terminal resize', error as Error, undefined, sessionId);
          }
        }, appConfig.pty.resizeDebounce);
      };

    window.addEventListener('resize', handleResize);

    // Initial resize
    handleResize();

    // Listen for theme changes
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateTerminalTheme();
        }
      });
    });
    
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });


      return () => {
        try {
          window.removeEventListener('resize', handleResize);
          themeObserver.disconnect();
          
          if (resizeTimeout) {
            clearTimeout(resizeTimeout);
          }
          
          // Clean up listeners
          window.snowfortAPI.removePtyListeners(sessionId);
          
          // Dispose of terminal
          if (term) {
            term.dispose();
          }
          
          logger.terminal.info('Terminal component cleaned up', undefined, sessionId);
        } catch (error) {
          logger.terminal.error('Error during terminal cleanup', error as Error, undefined, sessionId);
        }
      };
    } catch (error) {
      logger.terminal.error('Failed to initialize terminal', error as Error, { projectPath }, sessionId);
      
      // Cleanup on error
      if (term) {
        try {
          term.dispose();
        } catch (disposeError) {
          logger.terminal.error('Error disposing terminal after init failure', disposeError as Error, undefined, sessionId);
        }
      }
    }
  }, [sessionId, projectPath, engineType]);

  return (
    <div className="terminal-container" style={{ height: '100%', width: '100%' }}>
      <div 
        ref={terminalRef} 
        className="terminal-content"
        style={{ height: '100%', width: '100%' }}
        tabIndex={0}
        onFocus={() => {
          if (xtermRef.current) {
            xtermRef.current.focus();
          }
        }}
      />
    </div>
  );
};