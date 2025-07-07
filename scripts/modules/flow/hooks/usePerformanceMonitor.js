import { useState, useEffect, useRef, useCallback } from 'react';

export function usePerformanceMonitor(componentName) {
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    avgRenderTime: 0,
    memoryUsage: 0,
    lastRender: null
  });
  
  const renderStartTime = useRef(null);
  const renderTimes = useRef([]);
  const memoryInterval = useRef(null);

  // Following VibeKit's StreamingBuffer pattern for performance data
  const updateMetrics = useCallback((newMetric) => {
    setMetrics(prev => {
      const updated = { ...prev, ...newMetric };
      
      // Send telemetry data following VibeKit patterns
      if (window.vibekitTelemetry) {
        window.vibekitTelemetry.track('performance_metric', {
          component: componentName,
          ...updated,
          timestamp: Date.now()
        });
      }
      
      return updated;
    });
  }, [componentName]);

  useEffect(() => {
    renderStartTime.current = performance.now();
    
    return () => {
      if (renderStartTime.current) {
        const renderTime = performance.now() - renderStartTime.current;
        renderTimes.current.push(renderTime);
        
        // Keep only last 50 render times for memory efficiency
        if (renderTimes.current.length > 50) {
          renderTimes.current = renderTimes.current.slice(-50);
        }
        
        const avgTime = renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length;
        
        updateMetrics({
          renderCount: renderTimes.current.length,
          avgRenderTime: Math.round(avgTime * 100) / 100,
          lastRender: new Date().toLocaleTimeString()
        });
      }
    };
  });

  useEffect(() => {
    // Memory monitoring following research best practices
    memoryInterval.current = setInterval(() => {
      if (process.memoryUsage) {
        const usage = process.memoryUsage();
        updateMetrics({
          memoryUsage: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100 // MB
        });
      }
    }, 5000);

    return () => {
      if (memoryInterval.current) {
        clearInterval(memoryInterval.current);
      }
    };
  }, [updateMetrics]);

  return metrics;
} 