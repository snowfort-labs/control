import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  direction: 'left' | 'right';
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  direction,
  initialWidth,
  minWidth,
  maxWidth,
  className = ''
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();
  }, [width]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = direction === 'left' 
      ? e.clientX - startX.current 
      : startX.current - e.clientX;
    
    const newWidth = Math.min(
      maxWidth,
      Math.max(minWidth, startWidth.current + deltaX)
    );
    
    setWidth(newWidth);
  }, [isResizing, direction, minWidth, maxWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <>
      {direction === 'right' && (
        <div 
          className={`resizer ${isResizing ? 'dragging' : ''}`}
          onMouseDown={handleMouseDown}
          style={{ cursor: 'col-resize' }}
        />
      )}
      <div 
        className={`panel ${className}`} 
        style={{ width: `${width}px` }}
      >
        {children}
      </div>
      {direction === 'left' && (
        <div 
          className={`resizer ${isResizing ? 'dragging' : ''}`}
          onMouseDown={handleMouseDown}
          style={{ cursor: 'col-resize' }}
        />
      )}
    </>
  );
};