import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { globalRenderTracker, globalPerformanceMonitor } from '../utils/performance.js';

/**
 * Hook to track component renders
 */
export function useRenderTracking(componentName) {
  const renderCount = useRef(0);
  const lastProps = useRef(null);

  useEffect(() => {
    renderCount.current++;
    globalRenderTracker.trackRender(componentName, lastProps.current || {});
  });

  return (props) => {
    lastProps.current = props;
  };
}

/**
 * Hook for debounced values
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for throttled callbacks
 */
export function useThrottle(callback, delay = 100) {
  const lastCall = useRef(0);
  const timeoutRef = useRef(null);

  const throttledCallback = useCallback((...args) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall.current;

    if (timeSinceLastCall >= delay) {
      lastCall.current = now;
      callback(...args);
    } else {
      // Schedule a call at the end of the delay period
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCall.current = Date.now();
        callback(...args);
      }, delay - timeSinceLastCall);
    }
  }, [callback, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * Hook for lazy loading with intersection observer
 */
export function useLazyLoad(ref, options = {}) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  useEffect(() => {
    if (!ref.current || hasLoaded) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          setHasLoaded(true);
          observer.disconnect();
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '50px'
      }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref, hasLoaded, options.threshold, options.rootMargin]);

  return { isIntersecting, hasLoaded };
}

/**
 * Hook for performance timing
 */
export function usePerformanceTiming(operationName) {
  const monitor = useMemo(
    () => globalPerformanceMonitor,
    []
  );

  const startTiming = useCallback(() => {
    monitor.startTimer(operationName);
  }, [monitor, operationName]);

  const endTiming = useCallback(() => {
    monitor.endTimer(operationName);
  }, [monitor, operationName]);

  const measureAsync = useCallback(async (fn) => {
    return monitor.measure(operationName, fn);
  }, [monitor, operationName]);

  return { startTiming, endTiming, measureAsync };
}

/**
 * Hook for memoizing expensive computations with cache
 */
export function useMemoWithCache(factory, deps, options = {}) {
  const { maxSize = 10, keyFn = JSON.stringify } = options;
  const cache = useRef(new Map());
  const depsRef = useRef(deps);
  depsRef.current = deps;

  return useMemo(() => {
    const key = keyFn(depsRef.current);
    
    if (cache.current.has(key)) {
      return cache.current.get(key);
    }

    const result = factory();
    
    // Maintain cache size
    if (cache.current.size >= maxSize) {
      const firstKey = cache.current.keys().next().value;
      cache.current.delete(firstKey);
    }
    
    cache.current.set(key, result);
    return result;
  }, [factory, maxSize, keyFn, ...deps]);
}

/**
 * Hook for virtual scrolling
 */
export function useVirtualScroll(items, containerHeight, itemHeight, overscan = 3) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { start, end };
  }, [scrollTop, items.length, containerHeight, itemHeight, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      ...item,
      index: visibleRange.start + index,
      style: {
        position: 'absolute',
        top: (visibleRange.start + index) * itemHeight,
        height: itemHeight
      }
    }));
  }, [items, visibleRange, itemHeight]);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    scrollTop
  };
}

/**
 * Hook for request animation frame
 */
export function useAnimationFrame(callback, enabled = true) {
  const requestRef = useRef();
  const previousTimeRef = useRef();

  const animate = useCallback((time) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    if (enabled) {
      requestRef.current = requestAnimationFrame(animate);
      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
      };
    }
  }, [enabled, animate]);
} 