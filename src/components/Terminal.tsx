import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
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
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
      theme: {
        background: '#000000',
        foreground: '#10b981', // Snowfort green
        cursor: '#10b981',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
      },
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

    setIsInitialized(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      // Store current terminal buffer before cleanup
      if (term && terminalBuffers.has(sessionId)) {
        // Buffer is already stored via onPtyData handler
      }
      // Don't kill PTY process - keep it alive for session switching
      // Only remove listeners for this specific terminal instance
      window.snowfortAPI.removePtyListeners(sessionId);
      term.dispose();
      setIsInitialized(false);
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