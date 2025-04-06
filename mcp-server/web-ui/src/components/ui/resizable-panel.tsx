import React, { useState, useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";

interface ResizablePanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onResize' | 'onMove'> {
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  gridColumn?: string;
  gridRow?: string;
  children: React.ReactNode;
  onPanelResize?: (width: number, height: number) => void;
  onPanelMove?: (gridColumn: string, gridRow: string) => void;
}

export function ResizablePanel({
  className,
  defaultWidth = 300,
  defaultHeight = 200,
  minWidth = 200,
  minHeight = 150,
  gridColumn = "auto",
  gridRow = "auto",
  children,
  onPanelResize,
  onPanelMove,
  ...props
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle panel dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget.querySelector('.panel-header')) {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  // Handle panel resizing
  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsResizing(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - startPos.x;
        const newY = e.clientY - startPos.y;
        setPosition({ x: newX, y: newY });
      } else if (isResizing) {
        const dx = e.clientX - startPos.x;
        const dy = e.clientY - startPos.y;
        const newWidth = Math.max(minWidth, width + dx);
        const newHeight = Math.max(minHeight, height + dy);
        setWidth(newWidth);
        setHeight(newHeight);
        setStartPos({ x: e.clientX, y: e.clientY });
        
        if (onPanelResize) {
          onPanelResize(newWidth, newHeight);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, startPos, width, height, minWidth, minHeight, onPanelResize]);

  return (
    <div
      ref={panelRef}
      className={cn(
        "bg-gray-900 rounded-lg border border-gray-700 overflow-hidden shadow-md",
        "transition-shadow hover:shadow-lg",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className
      )}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        gridColumn,
        gridRow,
        transform: isDragging ? `translate(${position.x}px, ${position.y}px)` : undefined,
        position: isDragging ? 'absolute' : 'relative',
        zIndex: isDragging ? 10 : 1,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function ResizablePanelHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "panel-header border-b border-gray-800 p-3 bg-gray-950 flex justify-between items-center cursor-move",
        className
      )}
      {...props}
    />
  );
}

export function ResizablePanelContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "p-3 overflow-auto",
        className
      )}
      {...props}
    />
  );
}

export function ResizableGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid grid-cols-12 gap-4 relative",
        className
      )}
      {...props}
    />
  );
}