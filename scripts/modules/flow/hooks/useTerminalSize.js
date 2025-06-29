import { useState, useEffect } from 'react';

/**
 * Hook for responsive terminal layouts based on terminal dimensions
 * Inspired by Gemini CLI's useTerminalSize implementation
 */
export function useTerminalSize() {
  const [size, setSize] = useState(() => ({
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  }));

  const [layout, setLayout] = useState(() => getLayoutType(size.width));

  useEffect(() => {
    const handleResize = () => {
      const newSize = {
        width: process.stdout.columns || 80,
        height: process.stdout.rows || 24,
      };
      setSize(newSize);
      setLayout(getLayoutType(newSize.width));
    };

    // Listen for terminal resize events
    process.stdout.on('resize', handleResize);
    
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  return {
    width: size.width,
    height: size.height,
    layout,
    // Utility functions for responsive design
    isNarrow: size.width < 60,
    isWide: size.width >= 120,
    isTall: size.height >= 30,
    maxContentWidth: Math.min(size.width - 4, 120), // Account for padding
    availableHeight: size.height - 6, // Account for header/footer
  };
}

function getLayoutType(width) {
  if (width < 60) return 'narrow';
  if (width < 100) return 'medium';
  return 'wide';
} 