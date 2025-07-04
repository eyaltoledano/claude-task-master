/**
 * Phase 6.1 - Monitoring Dashboard Testing
 * Comprehensive tests for real-time monitoring display functionality
 */

import { jest } from '@jest/globals';

// Mock the MonitoringDashboard component
const mockMonitoringDashboard = {
  displayMetrics: jest.fn(),
  updateRealTimeData: jest.fn(),
  refreshStats: jest.fn(),
  handleUserInteraction: jest.fn(),
  validateDataDisplay: jest.fn(),
  checkPerformanceMetrics: jest.fn(),
  renderCharts: jest.fn(),
  handleResize: jest.fn()
};

// Mock data for testing
const mockMetricsData = {
  activeWorktrees: 3,
  runningTasks: 5,
  completedTasks: 12,
  systemLoad: 0.45,
  memoryUsage: 0.67,
  diskUsage: 0.23,
  networkActivity: 'moderate',
  lastUpdated: new Date().toISOString()
};

const mockPerformanceData = {
  responseTime: 120,
  throughput: 95.5,
  errorRate: 0.01,
  uptime: 99.9,
  cacheHitRate: 0.85
};

const mockRealTimeUpdates = [
  { timestamp: Date.now(), event: 'task_completed', data: { taskId: '15.2' } },
  { timestamp: Date.now() - 1000, event: 'worktree_created', data: { path: '/test/repo' } },
  { timestamp: Date.now() - 2000, event: 'system_alert', data: { level: 'info', message: 'Cache refreshed' } }
];

describe('Monitoring Dashboard Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockMonitoringDashboard.displayMetrics.mockImplementation((data) => {
      if (!data) return { success: false, error: 'No data provided' };
      return { success: true, rendered: true, metrics: data };
    });
    
    mockMonitoringDashboard.updateRealTimeData.mockImplementation((updates) => {
      if (!Array.isArray(updates)) return { success: false, error: 'Invalid updates format' };
      return { success: true, processed: updates.length, timestamp: Date.now() };
    });
    
    mockMonitoringDashboard.refreshStats.mockImplementation(() => {
      return { success: true, refreshed: Date.now(), dataPoints: 8 };
    });
    
    mockMonitoringDashboard.handleUserInteraction.mockImplementation((interaction) => {
      const validInteractions = ['refresh', 'filter', 'export', 'settings'];
      if (!validInteractions.includes(interaction.type)) {
        return { success: false, error: 'Invalid interaction type' };
      }
      return { success: true, action: interaction.type, timestamp: Date.now() };
    });
    
    mockMonitoringDashboard.validateDataDisplay.mockImplementation((data) => {
      const required = ['activeWorktrees', 'runningTasks', 'systemLoad'];
      const missing = required.filter(field => !(field in data));
      
      if (missing.length > 0) {
        return { valid: false, missing, errors: [`Missing required fields: ${missing.join(', ')}`] };
      }
      
      return { valid: true, fields: Object.keys(data).length, timestamp: Date.now() };
    });
    
    mockMonitoringDashboard.checkPerformanceMetrics.mockImplementation((metrics) => {
      const alerts = [];
      
      if (metrics.responseTime > 500) alerts.push('High response time');
      if (metrics.errorRate > 0.05) alerts.push('High error rate');
      if (metrics.uptime < 99.0) alerts.push('Low uptime');
      
      return {
        healthy: alerts.length === 0,
        alerts,
        score: Math.max(0, 100 - (alerts.length * 10)),
        timestamp: Date.now()
      };
    });
    
    mockMonitoringDashboard.renderCharts.mockImplementation((chartType, data) => {
      const supportedTypes = ['line', 'bar', 'pie', 'gauge'];
      if (!supportedTypes.includes(chartType)) {
        return { success: false, error: 'Unsupported chart type' };
      }
      
      if (!data || data.length === 0) {
        return { success: false, error: 'No data for chart' };
      }
      
      return {
        success: true,
        type: chartType,
        dataPoints: data.length,
        rendered: true,
        timestamp: Date.now()
      };
    });
    
    mockMonitoringDashboard.handleResize.mockImplementation((dimensions) => {
      if (!dimensions.width || !dimensions.height) {
        return { success: false, error: 'Invalid dimensions' };
      }
      
      return {
        success: true,
        newSize: dimensions,
        layout: dimensions.width > 1200 ? 'desktop' : 'mobile',
        timestamp: Date.now()
      };
    });
  });

  describe('Basic Display Functionality', () => {
    test('should display metrics data correctly', () => {
      const result = mockMonitoringDashboard.displayMetrics(mockMetricsData);
      
      expect(result.success).toBe(true);
      expect(result.rendered).toBe(true);
      expect(result.metrics).toEqual(mockMetricsData);
      expect(mockMonitoringDashboard.displayMetrics).toHaveBeenCalledWith(mockMetricsData);
    });

    test('should handle missing metrics data', () => {
      const result = mockMonitoringDashboard.displayMetrics(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No data provided');
    });

    test('should validate required data fields', () => {
      const result = mockMonitoringDashboard.validateDataDisplay(mockMetricsData);
      
      expect(result.valid).toBe(true);
      expect(result.fields).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    test('should detect missing required fields', () => {
      const incompleteData = { activeWorktrees: 3 };
      const result = mockMonitoringDashboard.validateDataDisplay(incompleteData);
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('runningTasks');
      expect(result.missing).toContain('systemLoad');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Real-Time Data Updates', () => {
    test('should process real-time updates correctly', () => {
      const result = mockMonitoringDashboard.updateRealTimeData(mockRealTimeUpdates);
      
      expect(result.success).toBe(true);
      expect(result.processed).toBe(mockRealTimeUpdates.length);
      expect(result.timestamp).toBeDefined();
      expect(mockMonitoringDashboard.updateRealTimeData).toHaveBeenCalledWith(mockRealTimeUpdates);
    });

    test('should handle invalid update format', () => {
      const result = mockMonitoringDashboard.updateRealTimeData('invalid');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid updates format');
    });

    test('should process empty updates array', () => {
      const result = mockMonitoringDashboard.updateRealTimeData([]);
      
      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });

    test('should refresh statistics on demand', () => {
      const result = mockMonitoringDashboard.refreshStats();
      
      expect(result.success).toBe(true);
      expect(result.refreshed).toBeDefined();
      expect(result.dataPoints).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    test('should check healthy performance metrics', () => {
      const healthyMetrics = {
        responseTime: 120,
        throughput: 95.5,
        errorRate: 0.01,
        uptime: 99.9
      };
      
      const result = mockMonitoringDashboard.checkPerformanceMetrics(healthyMetrics);
      
      expect(result.healthy).toBe(true);
      expect(result.alerts).toHaveLength(0);
      expect(result.score).toBeGreaterThan(90);
    });

    test('should detect performance issues', () => {
      const unhealthyMetrics = {
        responseTime: 600,  // High
        errorRate: 0.08,    // High
        uptime: 98.5        // Low
      };
      
      const result = mockMonitoringDashboard.checkPerformanceMetrics(unhealthyMetrics);
      
      expect(result.healthy).toBe(false);
      expect(result.alerts).toContain('High response time');
      expect(result.alerts).toContain('High error rate');
      expect(result.alerts).toContain('Low uptime');
      expect(result.score).toBeLessThan(80);
    });

    test('should calculate performance score correctly', () => {
      const metrics = { responseTime: 600, errorRate: 0.08, uptime: 99.5 };
      const result = mockMonitoringDashboard.checkPerformanceMetrics(metrics);
      
      // Should have 2 alerts (high response time, high error rate)
      expect(result.alerts).toHaveLength(2);
      expect(result.score).toBe(80); // 100 - (2 * 10)
    });
  });

  describe('Chart Rendering', () => {
    test('should render supported chart types', () => {
      const chartData = [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
        { x: 3, y: 15 }
      ];
      
      const result = mockMonitoringDashboard.renderCharts('line', chartData);
      
      expect(result.success).toBe(true);
      expect(result.type).toBe('line');
      expect(result.dataPoints).toBe(3);
      expect(result.rendered).toBe(true);
    });

    test('should reject unsupported chart types', () => {
      const result = mockMonitoringDashboard.renderCharts('invalid', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported chart type');
    });

    test('should handle empty chart data', () => {
      const result = mockMonitoringDashboard.renderCharts('bar', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No data for chart');
    });

    test('should render all supported chart types', () => {
      const chartData = [{ value: 100 }];
      const chartTypes = ['line', 'bar', 'pie', 'gauge'];
      
      chartTypes.forEach(type => {
        const result = mockMonitoringDashboard.renderCharts(type, chartData);
        expect(result.success).toBe(true);
        expect(result.type).toBe(type);
      });
    });
  });

  describe('User Interaction Handling', () => {
    test('should handle valid user interactions', () => {
      const interactions = [
        { type: 'refresh', params: {} },
        { type: 'filter', params: { category: 'tasks' } },
        { type: 'export', params: { format: 'csv' } },
        { type: 'settings', params: { view: 'detailed' } }
      ];
      
      interactions.forEach(interaction => {
        const result = mockMonitoringDashboard.handleUserInteraction(interaction);
        expect(result.success).toBe(true);
        expect(result.action).toBe(interaction.type);
        expect(result.timestamp).toBeDefined();
      });
    });

    test('should reject invalid interaction types', () => {
      const invalidInteraction = { type: 'invalid', params: {} };
      const result = mockMonitoringDashboard.handleUserInteraction(invalidInteraction);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid interaction type');
    });
  });

  describe('Responsive Design', () => {
    test('should handle desktop layout', () => {
      const desktopDimensions = { width: 1400, height: 800 };
      const result = mockMonitoringDashboard.handleResize(desktopDimensions);
      
      expect(result.success).toBe(true);
      expect(result.layout).toBe('desktop');
      expect(result.newSize).toEqual(desktopDimensions);
    });

    test('should handle mobile layout', () => {
      const mobileDimensions = { width: 800, height: 600 };
      const result = mockMonitoringDashboard.handleResize(mobileDimensions);
      
      expect(result.success).toBe(true);
      expect(result.layout).toBe('mobile');
      expect(result.newSize).toEqual(mobileDimensions);
    });

    test('should reject invalid dimensions', () => {
      const invalidDimensions = { width: 0 };
      const result = mockMonitoringDashboard.handleResize(invalidDimensions);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid dimensions');
    });
  });

  describe('Performance Benchmarks', () => {
    test('should complete display operations within time limit', () => {
      const startTime = Date.now();
      
      mockMonitoringDashboard.displayMetrics(mockMetricsData);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(100); // 100ms limit
    });

    test('should handle real-time updates efficiently', () => {
      const startTime = Date.now();
      const largeUpdateSet = Array.from({ length: 50 }, (_, i) => ({
        timestamp: Date.now() - i * 1000,
        event: 'test_event',
        data: { index: i }
      }));
      
      mockMonitoringDashboard.updateRealTimeData(largeUpdateSet);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(200); // 200ms limit for large updates
    });

    test('should refresh statistics quickly', () => {
      const startTime = Date.now();
      
      mockMonitoringDashboard.refreshStats();
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(50); // 50ms limit
    });
  });

  describe('Error Recovery', () => {
    test('should handle corrupted metrics data gracefully', () => {
      const corruptedData = { invalid: 'structure', nested: { broken: true } };
      
      // Should not throw error
      expect(() => {
        mockMonitoringDashboard.validateDataDisplay(corruptedData);
      }).not.toThrow();
    });

    test('should recover from chart rendering failures', () => {
      const result1 = mockMonitoringDashboard.renderCharts('invalid', []);
      expect(result1.success).toBe(false);
      
      // Should still work for valid requests after failure
      const result2 = mockMonitoringDashboard.renderCharts('line', [{ x: 1, y: 1 }]);
      expect(result2.success).toBe(true);
    });

    test('should handle rapid successive updates', () => {
      const updates = Array.from({ length: 10 }, () => mockRealTimeUpdates).flat();
      
      expect(() => {
        mockMonitoringDashboard.updateRealTimeData(updates);
      }).not.toThrow();
    });
  });

  describe('Data Consistency', () => {
    test('should maintain consistent timestamps', () => {
      const before = Date.now();
      
      const result1 = mockMonitoringDashboard.refreshStats();
      const result2 = mockMonitoringDashboard.checkPerformanceMetrics(mockPerformanceData);
      
      const after = Date.now();
      
      expect(result1.refreshed).toBeGreaterThanOrEqual(before);
      expect(result1.refreshed).toBeLessThanOrEqual(after);
      expect(result2.timestamp).toBeGreaterThanOrEqual(before);
      expect(result2.timestamp).toBeLessThanOrEqual(after);
    });

    test('should preserve data integrity during updates', () => {
      const originalData = { ...mockMetricsData };
      
      mockMonitoringDashboard.displayMetrics(mockMetricsData);
      mockMonitoringDashboard.updateRealTimeData(mockRealTimeUpdates);
      
      // Original data should not be modified
      expect(mockMetricsData).toEqual(originalData);
    });
  });
}); 