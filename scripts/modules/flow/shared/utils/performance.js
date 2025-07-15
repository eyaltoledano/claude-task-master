/**
 * Performance monitoring utilities
 */

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
  constructor(name) {
    this.name = name;
    this.metrics = new Map();
    this.enabled = process.env.NODE_ENV !== 'production';
  }

  /**
   * Start timing an operation
   */
  startTimer(operation) {
    if (!this.enabled) return;
    
    const key = `${this.name}:${operation}`;
    this.metrics.set(key, {
      startTime: performance.now(),
      operation,
      count: (this.metrics.get(key)?.count || 0) + 1
    });
  }

  /**
   * End timing an operation
   */
  endTimer(operation) {
    if (!this.enabled) return;
    
    const key = `${this.name}:${operation}`;
    const metric = this.metrics.get(key);
    
    if (metric && metric.startTime) {
      const duration = performance.now() - metric.startTime;
      metric.duration = duration;
      metric.avgDuration = ((metric.avgDuration || 0) * (metric.count - 1) + duration) / metric.count;
      metric.startTime = null;
      
      if (duration > 100) {
        console.warn(`[Performance] ${key} took ${duration.toFixed(2)}ms`);
      }
    }
  }

  /**
   * Measure a function's execution time
   */
  async measure(operation, fn) {
    this.startTimer(operation);
    try {
      const result = await fn();
      return result;
    } finally {
      this.endTimer(operation);
    }
  }

  /**
   * Get performance report
   */
  getReport() {
    const report = {};
    
    for (const [key, metric] of this.metrics) {
      if (metric.startTime === null || metric.startTime === undefined) {
        report[key] = {
          count: metric.count,
          avgDuration: metric.avgDuration?.toFixed(2) + 'ms',
          lastDuration: metric.duration?.toFixed(2) + 'ms'
        };
      }
    }
    
    return report;
  }

  /**
   * Clear metrics
   */
  clear() {
    this.metrics.clear();
  }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor('global');

/**
 * React component render tracker
 */
export class RenderTracker {
  constructor() {
    this.renders = new Map();
    this.enabled = process.env.NODE_ENV !== 'production';
  }

  /**
   * Track component render
   */
  trackRender(componentName, props) {
    if (!this.enabled) return;
    
    const key = componentName;
    const current = this.renders.get(key) || { count: 0, props: [] };
    
    current.count++;
    current.lastRender = Date.now();
    
    // Track prop changes
    if (current.lastProps) {
      const changes = this.detectPropChanges(current.lastProps, props);
      if (changes.length > 0) {
        current.propChanges = changes;
      }
    }
    
    current.lastProps = props;
    this.renders.set(key, current);
    
    // Warn about excessive renders
    if (current.count > 50) {
      console.warn(`[Performance] ${componentName} has rendered ${current.count} times`);
    }
  }

  /**
   * Detect prop changes
   */
  detectPropChanges(oldProps, newProps) {
    const changes = [];
    const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
    
    for (const key of allKeys) {
      if (oldProps[key] !== newProps[key]) {
        changes.push(key);
      }
    }
    
    return changes;
  }

  /**
   * Get render report
   */
  getReport() {
    const report = {};
    
    for (const [component, data] of this.renders) {
      report[component] = {
        renderCount: data.count,
        lastRender: new Date(data.lastRender).toISOString(),
        recentPropChanges: data.propChanges || []
      };
    }
    
    return report;
  }

  /**
   * Clear tracking data
   */
  clear() {
    this.renders.clear();
  }
}

/**
 * Global render tracker instance
 */
export const globalRenderTracker = new RenderTracker();

/**
 * Memory usage monitor
 */
export class MemoryMonitor {
  constructor() {
    this.baseline = null;
    this.measurements = [];
    this.enabled = process.env.NODE_ENV !== 'production';
  }

  /**
   * Take memory snapshot
   */
  snapshot(label) {
    if (!this.enabled || typeof process === 'undefined') return;
    
    const usage = process.memoryUsage();
    const measurement = {
      label,
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    };
    
    if (!this.baseline) {
      this.baseline = measurement;
    }
    
    this.measurements.push(measurement);
    
    // Calculate delta from baseline
    const delta = {
      heapUsed: measurement.heapUsed - this.baseline.heapUsed,
      heapTotal: measurement.heapTotal - this.baseline.heapTotal
    };
    
    // Warn about memory growth
    if (delta.heapUsed > 50 * 1024 * 1024) { // 50MB
      console.warn(`[Memory] Heap usage increased by ${(delta.heapUsed / 1024 / 1024).toFixed(2)}MB since baseline`);
    }
    
    return measurement;
  }

  /**
   * Get memory report
   */
  getReport() {
    if (!this.enabled || this.measurements.length === 0) {
      return { enabled: false };
    }
    
    const latest = this.measurements[this.measurements.length - 1];
    const baseline = this.baseline;
    
    return {
      baseline: {
        heapUsed: `${(baseline.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        timestamp: new Date(baseline.timestamp).toISOString()
      },
      current: {
        heapUsed: `${(latest.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(latest.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        rss: `${(latest.rss / 1024 / 1024).toFixed(2)}MB`,
        timestamp: new Date(latest.timestamp).toISOString()
      },
      delta: {
        heapUsed: `${((latest.heapUsed - baseline.heapUsed) / 1024 / 1024).toFixed(2)}MB`,
        measurements: this.measurements.length
      }
    };
  }

  /**
   * Clear measurements
   */
  clear() {
    this.baseline = null;
    this.measurements = [];
  }
}

/**
 * Global memory monitor instance
 */
export const globalMemoryMonitor = new MemoryMonitor(); 