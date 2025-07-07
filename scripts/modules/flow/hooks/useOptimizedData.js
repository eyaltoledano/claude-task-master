import { useMemo, useCallback, useRef, useState, useEffect } from 'react';

/**
 * Optimized data transformation hook based on research best practices
 * Implements throttling, memoization, and performance monitoring
 */
export function useOptimizedData(data, dependencies = []) {
  const transformData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.map(item => ({
      ...item,
      // Optimized computed properties
      formattedDuration: item.duration ? formatDuration(item.duration) : 'N/A',
      formattedTime: item.startTime ? new Date(item.startTime).toLocaleTimeString() : '',
      statusColor: getStatusColor(item.status),
      progressPercent: Math.round(item.progress || 0),
      isActive: ['running', 'in-progress'].includes(item.status),
      isCompleted: ['completed', 'done'].includes(item.status),
      hasError: ['failed', 'error'].includes(item.status)
    }));
  }, [data, ...dependencies]);
  
  return transformData;
}

/**
 * Throttled callback hook for performance optimization
 */
export function useThrottledCallback(callback, delay = 100) {
  const timeoutRef = useRef(null);
  const lastExecRef = useRef(0);
  
  return useCallback((...args) => {
    const currentTime = Date.now();
    
    if (currentTime - lastExecRef.current >= delay) {
      callback(...args);
      lastExecRef.current = currentTime;
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
        lastExecRef.current = Date.now();
      }, delay - (currentTime - lastExecRef.current));
    }
  }, [callback, delay]);
}

/**
 * Debounced value hook for input handling
 */
export function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Performance monitoring hook for tracking render times
 */
export function usePerformanceMonitor(componentName) {
  const renderStartRef = useRef(null);
  const renderCountRef = useRef(0);
  
  useEffect(() => {
    renderStartRef.current = performance.now();
    renderCountRef.current += 1;
  });
  
  useEffect(() => {
    if (renderStartRef.current) {
      const renderTime = performance.now() - renderStartRef.current;
      if (renderTime > 16) { // Flag slow renders (>16ms for 60fps)
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms (render #${renderCountRef.current})`);
      }
    }
  });
  
  return {
    renderCount: renderCountRef.current,
    getRenderTime: () => renderStartRef.current ? performance.now() - renderStartRef.current : 0
  };
}

/**
 * Memory efficient array hook that limits size
 */
export function useLimitedArray(initialValue = [], maxSize = 100) {
  const [array, setArray] = useState(initialValue);
  
  const addItem = useCallback((item) => {
    setArray(prev => {
      const newArray = [...prev, item];
      return newArray.slice(-maxSize);
    });
  }, [maxSize]);
  
  const addItems = useCallback((items) => {
    setArray(prev => {
      const newArray = [...prev, ...items];
      return newArray.slice(-maxSize);
    });
  }, [maxSize]);
  
  const clearArray = useCallback(() => {
    setArray([]);
  }, []);
  
  return {
    array,
    addItem,
    addItems,
    clearArray,
    size: array.length,
    isFull: array.length >= maxSize
  };
}

/**
 * Stable reference hook to prevent unnecessary re-renders
 */
export function useStableCallback(callback, dependencies) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...dependencies]);
  
  return useCallback((...args) => {
    return callbackRef.current(...args);
  }, []);
}

// Helper functions
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getStatusColor(status) {
  const colorMap = {
    'pending': 'gray',
    'running': 'cyan',
    'in-progress': 'cyan', 
    'completed': 'green',
    'done': 'green',
    'failed': 'red',
    'error': 'red',
    'cancelled': 'yellow'
  };
  return colorMap[status] || 'white';
}

/**
 * Hook for managing async operations with loading states
 */
export function useAsyncOperation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const execute = useCallback(async (asyncFunction) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await asyncFunction();
      
      if (isMountedRef.current) {
        setData(result);
      }
      
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err);
      }
      throw err;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);
  
  return {
    isLoading,
    error,
    data,
    execute
  };
} 