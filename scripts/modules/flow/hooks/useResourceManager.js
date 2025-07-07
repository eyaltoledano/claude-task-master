import { useEffect, useRef, useCallback } from 'react';

export function useResourceManager(options = {}) {
  const {
    memoryThreshold = 100, // MB
    cleanupInterval = 30000, // 30 seconds
    maxLogMessages = 50,
    maxTelemetryEvents = 100
  } = options;

  const cleanupTasks = useRef([]);
  const memoryCheckInterval = useRef(null);

  // Register cleanup task following VibeKit patterns
  const registerCleanup = useCallback((task) => {
    cleanupTasks.current.push(task);
    return () => {
      cleanupTasks.current = cleanupTasks.current.filter(t => t !== task);
    };
  }, []);

  // Memory monitoring and cleanup
  useEffect(() => {
    const performCleanup = () => {
      // Run all registered cleanup tasks
      cleanupTasks.current.forEach(task => {
        try {
          task();
        } catch (error) {
          console.warn('Cleanup task failed:', error);
        }
      });

      // Force garbage collection if available (development)
      if (global.gc && process.env.NODE_ENV === 'development') {
        global.gc();
      }
    };

    const checkMemory = () => {
      if (process.memoryUsage) {
        const usage = process.memoryUsage();
        const heapUsedMB = usage.heapUsed / 1024 / 1024;
        
        if (heapUsedMB > memoryThreshold) {
          console.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB`);
          performCleanup();
        }
      }
    };

    // Set up periodic memory checks
    memoryCheckInterval.current = setInterval(() => {
      checkMemory();
      performCleanup();
    }, cleanupInterval);

    return () => {
      if (memoryCheckInterval.current) {
        clearInterval(memoryCheckInterval.current);
      }
      performCleanup();
    };
  }, [memoryThreshold, cleanupInterval]);

  return { registerCleanup };
} 