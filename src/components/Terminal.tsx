import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  sessionId: string;
  projectPath: string;
  engineType: string;
  onStateChange?: (state: { status: string; message?: string }) => void;
}

export const TerminalComponent: React.FC<TerminalProps> = ({ sessionId, projectPath, engineType }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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

    // Start the PTY process
    window.snowfortAPI.startPty(sessionId, projectPath);

    // Handle PTY data
    window.snowfortAPI.onPtyData(sessionId, (data) => {
      term.write(data);
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

    return () => {
      window.removeEventListener('resize', handleResize);
      window.snowfortAPI.killPty(sessionId);
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