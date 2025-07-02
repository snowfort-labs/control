import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// Utility function to get terminal theme from CSS variables
const getTerminalTheme = () => {
  const computedStyle = getComputedStyle(document.documentElement);
  const getCSSVar = (name: string) => computedStyle.getPropertyValue(name).trim();
  
  return {
    background: getCSSVar('--bg-primary'),
    foreground: getCSSVar('--text-primary'),
    cursor: getCSSVar('--accent-color'),
    cursorAccent: getCSSVar('--bg-primary'), // Cursor text color when using block cursor
    selection: getCSSVar('--accent-color') + '30', // Add transparency
    selectionForeground: getCSSVar('--bg-primary'),
    
    // Map application colors to ANSI colors
    black: getCSSVar('--text-primary'),
    red: getCSSVar('--error-red'),
    green: getCSSVar('--success-green'),
    yellow: getCSSVar('--warning-yellow'),
    blue: getCSSVar('--accent-blue'),
    magenta: getCSSVar('--accent-color'),
    cyan: getCSSVar('--success-green'),
    white: getCSSVar('--text-secondary'),
    
    // Bright colors - slightly more vibrant versions
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
import { Session } from '../types/engine';

interface TerminalProps {
  session: Session;
  projectPath: string;
  engineType?: string;
  onStateChange?: (state: { status: string; message?: string }) => void;
}

// Terminal buffer storage for session persistence
const terminalBuffers = new Map<string, string>();

// Clean up old buffers to prevent memory leaks
const cleanupOldBuffers = () => {
  if (terminalBuffers.size > 10) { // Keep max 10 session buffers
    const oldestKey = terminalBuffers.keys().next().value;
    terminalBuffers.delete(oldestKey);
  }
};

// Clear terminal buffer for a specific session
export const clearTerminalBuffer = (sessionId: string) => {
  terminalBuffers.delete(sessionId);
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

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
      theme: getTerminalTheme(),
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Start the PTY process only if not already running
    const initializePty = async () => {
      const exists = await window.snowfortAPI.ptyExists(sessionId);
      if (!exists) {
        window.snowfortAPI.startPty(sessionId, projectPath);
        
        // Execute initial command if provided
        const initialCommand = session.config?.initialCommand;
        if (initialCommand) {
          // Wait a bit for the shell to initialize before sending the command
          setTimeout(() => {
            window.snowfortAPI.writePty(sessionId, initialCommand + '\r');
          }, 1000);
        }
      }
    };
    
    initializePty();

    // Clear existing listeners to prevent duplicates
    window.snowfortAPI.removePtyListeners(sessionId);
    
    // Restore terminal buffer if it exists
    const savedBuffer = terminalBuffers.get(sessionId);
    if (savedBuffer) {
      term.write(savedBuffer);
    }

    // Handle PTY data with buffer storage
    window.snowfortAPI.onPtyData(sessionId, (data) => {
      term.write(data);
      // Store data in buffer for session persistence
      const currentBuffer = terminalBuffers.get(sessionId) || '';
      const newBuffer = currentBuffer + data;
      // Keep buffer size reasonable (last 50KB)
      const maxBufferSize = 50000;
      if (newBuffer.length > maxBufferSize) {
        const trimmedBuffer = newBuffer.slice(-maxBufferSize);
        terminalBuffers.set(sessionId, trimmedBuffer);
      } else {
        terminalBuffers.set(sessionId, newBuffer);
      }
      cleanupOldBuffers();
    });

    // Handle PTY exit
    window.snowfortAPI.onPtyExit(sessionId, (exitCode) => {
      term.writeln(`\n\x1b[1;31mProcess exited with code: ${exitCode}\x1b[0m`);
    });

    // Handle user input
    term.onData((data) => {
      window.snowfortAPI.writePty(sessionId, data);
    });

    // Handle terminal resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const dimensions = fitAddonRef.current.proposeDimensions();
        if (dimensions) {
          const { cols, rows } = dimensions;
          window.snowfortAPI.resizePty(sessionId, cols, rows);
        }
      }
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
      window.removeEventListener('resize', handleResize);
      themeObserver.disconnect();
      // Store current terminal buffer before cleanup
      if (term && terminalBuffers.has(sessionId)) {
        // Buffer is already stored via onPtyData handler
      }
      // Don't kill PTY process - keep it alive for session switching
      // Only remove listeners for this specific terminal instance
      window.snowfortAPI.removePtyListeners(sessionId);
      term.dispose();
    };
  }, [sessionId, projectPath, engineType]);

  return (
    <div className="terminal-container" style={{ height: '100%', width: '100%' }}>
      <div 
        ref={terminalRef} 
        className="terminal-content"
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
};