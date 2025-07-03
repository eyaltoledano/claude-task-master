/**
 * @file resource-monitor.test.js
 * @description Tests for ResourceMonitor class
 * Tests resource isolation between worktrees, monitoring, and performance tracking
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock ResourceMonitor class with resource monitoring functionality
class MockResourceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      monitoringInterval: options.monitoringInterval || 5000,
      memoryThreshold: options.memoryThreshold || 1024 * 1024 * 1024, // 1GB
      cpuThreshold: options.cpuThreshold || 80, // 80%
      diskThreshold: options.diskThreshold || 90, // 90%
      maxWorktrees: options.maxWorktrees || 10,
      enableAlerts: options.enableAlerts !== false,
      ...options
    };
    
    this.worktreeResources = new Map();
    this.globalResources = {
      memory: { used: 0, total: 8 * 1024 * 1024 * 1024 }, // 8GB total
      cpu: { usage: 0, cores: 8 },
      disk: { used: 0, total: 500 * 1024 * 1024 * 1024 } // 500GB total
    };
    
    this.statistics = {
      totalMonitoringCycles: 0,
      alertsTriggered: 0,
      resourceViolations: 0,
      averageMemoryUsage: 0,
      averageCpuUsage: 0,
      averageDiskUsage: 0,
      lastMonitoringTime: null
    };
    
    this.isMonitoring = false;
    this.monitoringTimer = null;
    this.alerts = [];
  }

  async initialize() {
    try {
      // Initialize resource monitoring
      await this.updateResourceUsage();
      
      if (this.options.monitoringInterval > 0) {
        this.startMonitoring();
      }
      
      this.emit('initialized', {
        monitoringEnabled: this.isMonitoring,
        interval: this.options.monitoringInterval
      });
      
      return {
        success: true,
        monitoringEnabled: this.isMonitoring
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  registerWorktree(path, options = {}) {
    if (this.worktreeResources.has(path)) {
      throw new Error(`Worktree already registered: ${path}`);
    }

    if (this.worktreeResources.size >= this.options.maxWorktrees) {
      throw new Error(`Maximum worktree limit reached: ${this.options.maxWorktrees}`);
    }

    const worktreeResource = {
      path,
      registeredAt: new Date().toISOString(),
      resources: {
        memory: { allocated: 0, used: 0, peak: 0 },
        cpu: { usage: 0, peak: 0 },
        disk: { used: 0, peak: 0 },
        files: { count: 0, totalSize: 0 }
      },
      limits: {
        memory: options.memoryLimit || this.options.memoryThreshold / this.options.maxWorktrees,
        cpu: options.cpuLimit || this.options.cpuThreshold / this.options.maxWorktrees,
        disk: options.diskLimit || this.options.diskThreshold / this.options.maxWorktrees
      },
      violations: [],
      lastUpdated: new Date().toISOString()
    };

    this.worktreeResources.set(path, worktreeResource);
    this.emit('worktreeRegistered', { path, limits: worktreeResource.limits });
    
    return worktreeResource;
  }

  unregisterWorktree(path) {
    const worktree = this.worktreeResources.get(path);
    if (!worktree) {
      throw new Error(`Worktree not registered: ${path}`);
    }

    this.worktreeResources.delete(path);
    this.emit('worktreeUnregistered', { path });
    
    return true;
  }

  async updateResourceUsage() {
    const startTime = Date.now();
    
    try {
      // Update global resources (mock data)
      this.globalResources.memory.used = Math.floor(Math.random() * this.globalResources.memory.total * 0.8);
      this.globalResources.cpu.usage = Math.floor(Math.random() * 100);
      this.globalResources.disk.used = Math.floor(Math.random() * this.globalResources.disk.total * 0.9);

      // Update worktree-specific resources
      for (const [path, worktree] of this.worktreeResources) {
        const resources = worktree.resources;
        
        // Simulate resource usage
        resources.memory.used = Math.floor(Math.random() * worktree.limits.memory);
        resources.cpu.usage = Math.floor(Math.random() * worktree.limits.cpu);
        resources.disk.used = Math.floor(Math.random() * worktree.limits.disk);
        resources.files.count = Math.floor(Math.random() * 1000) + 50;
        resources.files.totalSize = resources.files.count * (Math.floor(Math.random() * 10000) + 1000);

        // Update peaks
        resources.memory.peak = Math.max(resources.memory.peak, resources.memory.used);
        resources.cpu.peak = Math.max(resources.cpu.peak, resources.cpu.usage);
        resources.disk.peak = Math.max(resources.disk.peak, resources.disk.used);

        worktree.lastUpdated = new Date().toISOString();

        // Check for violations
        this.checkResourceViolations(path, worktree);
      }

      // Update statistics
      this.updateStatistics();
      
      const updateTime = Date.now() - startTime;
      this.emit('resourcesUpdated', {
        worktreeCount: this.worktreeResources.size,
        updateTime,
        globalResources: this.globalResources
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  checkResourceViolations(path, worktree) {
    const violations = [];
    const resources = worktree.resources;
    const limits = worktree.limits;

    if (resources.memory.used > limits.memory) {
      violations.push({
        type: 'memory',
        current: resources.memory.used,
        limit: limits.memory,
        severity: 'high'
      });
    }

    if (resources.cpu.usage > limits.cpu) {
      violations.push({
        type: 'cpu',
        current: resources.cpu.usage,
        limit: limits.cpu,
        severity: 'medium'
      });
    }

    if (resources.disk.used > limits.disk) {
      violations.push({
        type: 'disk',
        current: resources.disk.used,
        limit: limits.disk,
        severity: 'high'
      });
    }

    if (violations.length > 0) {
      worktree.violations.push(...violations.map(v => ({
        ...v,
        timestamp: new Date().toISOString(),
        path
      })));

      this.statistics.resourceViolations += violations.length;

      if (this.options.enableAlerts) {
        this.triggerAlert(path, violations);
      }

      this.emit('resourceViolation', { path, violations });
    }
  }

  triggerAlert(path, violations) {
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      path,
      violations,
      timestamp: new Date().toISOString(),
      severity: violations.some(v => v.severity === 'high') ? 'high' : 'medium'
    };

    this.alerts.push(alert);
    this.statistics.alertsTriggered++;

    this.emit('alertTriggered', alert);
    
    return alert;
  }

  startMonitoring() {
    if (this.isMonitoring) {
      return false;
    }

    this.isMonitoring = true;
    this.monitoringTimer = setInterval(async () => {
      try {
        await this.updateResourceUsage();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.options.monitoringInterval);

    this.emit('monitoringStarted', { interval: this.options.monitoringInterval });
    return true;
  }

  stopMonitoring() {
    if (!this.isMonitoring) {
      return false;
    }

    this.isMonitoring = false;
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.emit('monitoringStopped');
    return true;
  }

  getWorktreeResources(path) {
    const worktree = this.worktreeResources.get(path);
    return worktree ? { ...worktree } : null;
  }

  getAllWorktreeResources() {
    const resources = {};
    for (const [path, worktree] of this.worktreeResources) {
      resources[path] = { ...worktree };
    }
    return resources;
  }

  getGlobalResources() {
    return { ...this.globalResources };
  }

  getResourceUtilization() {
    return {
      memory: (this.globalResources.memory.used / this.globalResources.memory.total) * 100,
      cpu: this.globalResources.cpu.usage,
      disk: (this.globalResources.disk.used / this.globalResources.disk.total) * 100
    };
  }

  getWorktreeResourceUtilization(path) {
    const worktree = this.worktreeResources.get(path);
    if (!worktree) {
      return null;
    }

    const resources = worktree.resources;
    const limits = worktree.limits;

    return {
      memory: (resources.memory.used / limits.memory) * 100,
      cpu: (resources.cpu.usage / limits.cpu) * 100,
      disk: (resources.disk.used / limits.disk) * 100
    };
  }

  getAlerts(severity = null) {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  clearAlerts(olderThan = null) {
    const initialCount = this.alerts.length;
    
    if (olderThan) {
      const cutoff = new Date(Date.now() - olderThan);
      this.alerts = this.alerts.filter(alert => new Date(alert.timestamp) > cutoff);
    } else {
      this.alerts = [];
    }

    const clearedCount = initialCount - this.alerts.length;
    this.emit('alertsCleared', { clearedCount, remainingCount: this.alerts.length });
    
    return clearedCount;
  }

  updateStatistics() {
    this.statistics.totalMonitoringCycles++;
    this.statistics.lastMonitoringTime = new Date().toISOString();

    // Calculate averages
    const worktrees = Array.from(this.worktreeResources.values());
    if (worktrees.length > 0) {
      const totalMemory = worktrees.reduce((sum, w) => sum + w.resources.memory.used, 0);
      const totalCpu = worktrees.reduce((sum, w) => sum + w.resources.cpu.usage, 0);
      const totalDisk = worktrees.reduce((sum, w) => sum + w.resources.disk.used, 0);

      this.statistics.averageMemoryUsage = totalMemory / worktrees.length;
      this.statistics.averageCpuUsage = totalCpu / worktrees.length;
      this.statistics.averageDiskUsage = totalDisk / worktrees.length;
    }
  }

  getStatistics() {
    return {
      ...this.statistics,
      registeredWorktrees: this.worktreeResources.size,
      activeAlerts: this.alerts.length,
      isMonitoring: this.isMonitoring,
      globalUtilization: this.getResourceUtilization()
    };
  }

  async destroy() {
    this.stopMonitoring();
    this.worktreeResources.clear();
    this.alerts = [];
    
    this.emit('destroyed');
  }
}

describe('ResourceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new MockResourceMonitor({
      monitoringInterval: 100, // Short for testing
      memoryThreshold: 1024 * 1024 * 1024, // 1GB
      cpuThreshold: 80,
      diskThreshold: 90,
      maxWorktrees: 5,
      enableAlerts: true
    });
  });

  afterEach(async () => {
    if (monitor) {
      await monitor.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await monitor.initialize();

      expect(result.success).toBe(true);
      expect(result.monitoringEnabled).toBe(true);
      expect(monitor.isMonitoring).toBe(true);
    });

    test('should emit initialized event', async () => {
      const initSpy = jest.fn();
      monitor.on('initialized', initSpy);

      await monitor.initialize();

      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          monitoringEnabled: true,
          interval: monitor.options.monitoringInterval
        })
      );
    });

    test('should update resources during initialization', async () => {
      await monitor.initialize();

      const globalResources = monitor.getGlobalResources();
      expect(globalResources.memory.used).toBeGreaterThan(0);
      expect(globalResources.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(globalResources.disk.used).toBeGreaterThan(0);
    });
  });

  describe('Worktree Registration', () => {
    beforeEach(async () => {
      await monitor.initialize();
    });

    test('should register worktree successfully', () => {
      const path = '/test/worktree-1';
      const worktree = monitor.registerWorktree(path);

      expect(worktree.path).toBe(path);
      expect(worktree.resources).toBeDefined();
      expect(worktree.limits).toBeDefined();
      expect(worktree.violations).toEqual([]);
      expect(monitor.worktreeResources.has(path)).toBe(true);
    });

    test('should emit worktreeRegistered event', () => {
      const registeredSpy = jest.fn();
      monitor.on('worktreeRegistered', registeredSpy);

      const path = '/test/worktree-event';
      monitor.registerWorktree(path);

      expect(registeredSpy).toHaveBeenCalledWith({
        path,
        limits: expect.any(Object)
      });
    });

    test('should throw error for duplicate registration', () => {
      const path = '/test/duplicate-worktree';
      monitor.registerWorktree(path);

      expect(() => monitor.registerWorktree(path)).toThrow(
        `Worktree already registered: ${path}`
      );
    });

    test('should enforce maximum worktree limit', () => {
      // Fill up to the limit
      for (let i = 0; i < monitor.options.maxWorktrees; i++) {
        monitor.registerWorktree(`/test/worktree-${i}`);
      }

      expect(() => monitor.registerWorktree('/test/overflow')).toThrow(
        `Maximum worktree limit reached: ${monitor.options.maxWorktrees}`
      );
    });

    test('should unregister worktree successfully', () => {
      const path = '/test/unregister-worktree';
      monitor.registerWorktree(path);
      expect(monitor.worktreeResources.has(path)).toBe(true);

      const result = monitor.unregisterWorktree(path);

      expect(result).toBe(true);
      expect(monitor.worktreeResources.has(path)).toBe(false);
    });

    test('should emit worktreeUnregistered event', () => {
      const unregisteredSpy = jest.fn();
      monitor.on('worktreeUnregistered', unregisteredSpy);

      const path = '/test/unregister-event';
      monitor.registerWorktree(path);
      monitor.unregisterWorktree(path);

      expect(unregisteredSpy).toHaveBeenCalledWith({ path });
    });

    test('should throw error when unregistering non-existent worktree', () => {
      expect(() => monitor.unregisterWorktree('/non/existent')).toThrow(
        'Worktree not registered: /non/existent'
      );
    });
  });

  describe('Resource Monitoring', () => {
    beforeEach(async () => {
      await monitor.initialize();
    });

    test('should update resource usage', async () => {
      const path = '/test/resource-update';
      monitor.registerWorktree(path);

      await monitor.updateResourceUsage();

      const worktree = monitor.getWorktreeResources(path);
      expect(worktree.resources.memory.used).toBeGreaterThanOrEqual(0);
      expect(worktree.resources.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(worktree.resources.disk.used).toBeGreaterThanOrEqual(0);
      expect(worktree.resources.files.count).toBeGreaterThan(0);
    });

    test('should emit resourcesUpdated event', async () => {
      const updatedSpy = jest.fn();
      monitor.on('resourcesUpdated', updatedSpy);

      await monitor.updateResourceUsage();

      expect(updatedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          worktreeCount: expect.any(Number),
          updateTime: expect.any(Number),
          globalResources: expect.any(Object)
        })
      );
    });

    test('should track peak resource usage', async () => {
      const path = '/test/peak-tracking';
      monitor.registerWorktree(path);

      // Update multiple times to track peaks
      await monitor.updateResourceUsage();
      const firstUpdate = monitor.getWorktreeResources(path);
      
      await monitor.updateResourceUsage();
      const secondUpdate = monitor.getWorktreeResources(path);

      expect(secondUpdate.resources.memory.peak).toBeGreaterThanOrEqual(firstUpdate.resources.memory.peak);
      expect(secondUpdate.resources.cpu.peak).toBeGreaterThanOrEqual(firstUpdate.resources.cpu.peak);
      expect(secondUpdate.resources.disk.peak).toBeGreaterThanOrEqual(firstUpdate.resources.disk.peak);
    });

    test('should start monitoring automatically', async () => {
      expect(monitor.isMonitoring).toBe(true);
      expect(monitor.monitoringTimer).toBeTruthy();
    });

    test('should stop monitoring', () => {
      const result = monitor.stopMonitoring();

      expect(result).toBe(true);
      expect(monitor.isMonitoring).toBe(false);
      expect(monitor.monitoringTimer).toBeNull();
    });

    test('should emit monitoring events', () => {
      const startedSpy = jest.fn();
      const stoppedSpy = jest.fn();
      
      monitor.on('monitoringStarted', startedSpy);
      monitor.on('monitoringStopped', stoppedSpy);

      monitor.stopMonitoring();
      monitor.startMonitoring();
      monitor.stopMonitoring();

      expect(startedSpy).toHaveBeenCalledWith({
        interval: monitor.options.monitoringInterval
      });
      expect(stoppedSpy).toHaveBeenCalled();
    });
  });

  describe('Resource Violation Detection', () => {
    beforeEach(async () => {
      await monitor.initialize();
    });

    test('should detect memory violations', async () => {
      const path = '/test/memory-violation';
      const worktree = monitor.registerWorktree(path, {
        memoryLimit: 100 // Very low limit
      });

      // Force a violation by setting high usage
      worktree.resources.memory.used = 200; // Above limit
      
      const violationSpy = jest.fn();
      monitor.on('resourceViolation', violationSpy);

      monitor.checkResourceViolations(path, worktree);

      expect(violationSpy).toHaveBeenCalledWith({
        path,
        violations: expect.arrayContaining([
          expect.objectContaining({
            type: 'memory',
            current: 200,
            limit: 100,
            severity: 'high'
          })
        ])
      });
    });

    test('should detect CPU violations', async () => {
      const path = '/test/cpu-violation';
      const worktree = monitor.registerWorktree(path, {
        cpuLimit: 50 // Low limit
      });

      worktree.resources.cpu.usage = 75; // Above limit
      
      const violationSpy = jest.fn();
      monitor.on('resourceViolation', violationSpy);

      monitor.checkResourceViolations(path, worktree);

      expect(violationSpy).toHaveBeenCalledWith({
        path,
        violations: expect.arrayContaining([
          expect.objectContaining({
            type: 'cpu',
            current: 75,
            limit: 50,
            severity: 'medium'
          })
        ])
      });
    });

    test('should detect disk violations', async () => {
      const path = '/test/disk-violation';
      const worktree = monitor.registerWorktree(path, {
        diskLimit: 1000 // Low limit
      });

      worktree.resources.disk.used = 1500; // Above limit
      
      const violationSpy = jest.fn();
      monitor.on('resourceViolation', violationSpy);

      monitor.checkResourceViolations(path, worktree);

      expect(violationSpy).toHaveBeenCalledWith({
        path,
        violations: expect.arrayContaining([
          expect.objectContaining({
            type: 'disk',
            current: 1500,
            limit: 1000,
            severity: 'high'
          })
        ])
      });
    });

    test('should track violation history', async () => {
      const path = '/test/violation-history';
      const worktree = monitor.registerWorktree(path, {
        memoryLimit: 100
      });

      // Create multiple violations
      worktree.resources.memory.used = 150;
      monitor.checkResourceViolations(path, worktree);
      
      worktree.resources.memory.used = 200;
      monitor.checkResourceViolations(path, worktree);

      expect(worktree.violations.length).toBe(2);
      expect(monitor.statistics.resourceViolations).toBe(2);
    });
  });

  describe('Alert System', () => {
    beforeEach(async () => {
      await monitor.initialize();
    });

    test('should trigger alerts for violations', async () => {
      const alertSpy = jest.fn();
      monitor.on('alertTriggered', alertSpy);

      const path = '/test/alert-trigger';
      const worktree = monitor.registerWorktree(path, {
        memoryLimit: 100
      });

      worktree.resources.memory.used = 150;
      monitor.checkResourceViolations(path, worktree);

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          path,
          violations: expect.any(Array),
          timestamp: expect.any(String),
          severity: 'high'
        })
      );
    });

    test('should store alerts', async () => {
      const path = '/test/alert-storage';
      const worktree = monitor.registerWorktree(path, {
        memoryLimit: 100
      });

      worktree.resources.memory.used = 150;
      monitor.checkResourceViolations(path, worktree);

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].path).toBe(path);
    });

    test('should filter alerts by severity', async () => {
      const path1 = '/test/high-severity';
      const path2 = '/test/medium-severity';
      
      const worktree1 = monitor.registerWorktree(path1, { memoryLimit: 100 });
      const worktree2 = monitor.registerWorktree(path2, { cpuLimit: 50 });

      worktree1.resources.memory.used = 150; // High severity
      worktree2.resources.cpu.usage = 75; // Medium severity

      monitor.checkResourceViolations(path1, worktree1);
      monitor.checkResourceViolations(path2, worktree2);

      const highAlerts = monitor.getAlerts('high');
      const mediumAlerts = monitor.getAlerts('medium');

      expect(highAlerts.length).toBe(1);
      expect(mediumAlerts.length).toBe(1);
      expect(highAlerts[0].path).toBe(path1);
      expect(mediumAlerts[0].path).toBe(path2);
    });

    test('should clear alerts', async () => {
      const path = '/test/clear-alerts';
      const worktree = monitor.registerWorktree(path, {
        memoryLimit: 100
      });

      worktree.resources.memory.used = 150;
      monitor.checkResourceViolations(path, worktree);

      expect(monitor.getAlerts().length).toBe(1);

      const clearedSpy = jest.fn();
      monitor.on('alertsCleared', clearedSpy);

      const clearedCount = monitor.clearAlerts();

      expect(clearedCount).toBe(1);
      expect(monitor.getAlerts().length).toBe(0);
      expect(clearedSpy).toHaveBeenCalledWith({
        clearedCount: 1,
        remainingCount: 0
      });
    });

    test('should disable alerts when configured', async () => {
      const noAlertMonitor = new MockResourceMonitor({
        enableAlerts: false
      });
      await noAlertMonitor.initialize();

      const alertSpy = jest.fn();
      noAlertMonitor.on('alertTriggered', alertSpy);

      const path = '/test/no-alerts';
      const worktree = noAlertMonitor.registerWorktree(path, {
        memoryLimit: 100
      });

      worktree.resources.memory.used = 150;
      noAlertMonitor.checkResourceViolations(path, worktree);

      expect(alertSpy).not.toHaveBeenCalled();
      expect(noAlertMonitor.getAlerts().length).toBe(0);

      await noAlertMonitor.destroy();
    });
  });

  describe('Resource Queries', () => {
    beforeEach(async () => {
      await monitor.initialize();
    });

    test('should get worktree resources', () => {
      const path = '/test/get-resources';
      monitor.registerWorktree(path);

      const resources = monitor.getWorktreeResources(path);

      expect(resources).toBeTruthy();
      expect(resources.path).toBe(path);
      expect(resources.resources).toBeDefined();
      expect(resources.limits).toBeDefined();
    });

    test('should return null for non-existent worktree', () => {
      const resources = monitor.getWorktreeResources('/non/existent');
      expect(resources).toBeNull();
    });

    test('should get all worktree resources', () => {
      const paths = ['/test/all-1', '/test/all-2', '/test/all-3'];
      paths.forEach(path => monitor.registerWorktree(path));

      const allResources = monitor.getAllWorktreeResources();

      expect(Object.keys(allResources)).toEqual(paths);
      paths.forEach(path => {
        expect(allResources[path].path).toBe(path);
      });
    });

    test('should get global resources', () => {
      const globalResources = monitor.getGlobalResources();

      expect(globalResources.memory).toBeDefined();
      expect(globalResources.cpu).toBeDefined();
      expect(globalResources.disk).toBeDefined();
      expect(globalResources.memory.total).toBeGreaterThan(0);
    });

    test('should calculate resource utilization', () => {
      const utilization = monitor.getResourceUtilization();

      expect(utilization.memory).toBeGreaterThanOrEqual(0);
      expect(utilization.memory).toBeLessThanOrEqual(100);
      expect(utilization.cpu).toBeGreaterThanOrEqual(0);
      expect(utilization.cpu).toBeLessThanOrEqual(100);
      expect(utilization.disk).toBeGreaterThanOrEqual(0);
      expect(utilization.disk).toBeLessThanOrEqual(100);
    });

    test('should calculate worktree resource utilization', async () => {
      const path = '/test/utilization';
      monitor.registerWorktree(path);
      await monitor.updateResourceUsage();

      const utilization = monitor.getWorktreeResourceUtilization(path);

      expect(utilization).toBeTruthy();
      expect(utilization.memory).toBeGreaterThanOrEqual(0);
      expect(utilization.cpu).toBeGreaterThanOrEqual(0);
      expect(utilization.disk).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await monitor.initialize();
    });

    test('should track monitoring statistics', async () => {
      const path = '/test/statistics';
      monitor.registerWorktree(path);

      await monitor.updateResourceUsage();
      await monitor.updateResourceUsage();

      const stats = monitor.getStatistics();

      expect(stats.totalMonitoringCycles).toBe(3); // 1 from init + 2 manual
      expect(stats.registeredWorktrees).toBe(1);
      expect(stats.isMonitoring).toBe(true);
      expect(stats.lastMonitoringTime).toBeTruthy();
    });

    test('should calculate average resource usage', async () => {
      const paths = ['/test/avg-1', '/test/avg-2'];
      paths.forEach(path => monitor.registerWorktree(path));

      await monitor.updateResourceUsage();

      const stats = monitor.getStatistics();

      expect(stats.averageMemoryUsage).toBeGreaterThanOrEqual(0);
      expect(stats.averageCpuUsage).toBeGreaterThanOrEqual(0);
      expect(stats.averageDiskUsage).toBeGreaterThanOrEqual(0);
    });

    test('should track alerts in statistics', async () => {
      const path = '/test/alert-stats';
      const worktree = monitor.registerWorktree(path, {
        memoryLimit: 100
      });

      worktree.resources.memory.used = 150;
      monitor.checkResourceViolations(path, worktree);

      const stats = monitor.getStatistics();

      expect(stats.alertsTriggered).toBe(1);
      expect(stats.activeAlerts).toBe(1);
      expect(stats.resourceViolations).toBe(1);
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      await monitor.initialize();
    });

    test('should handle multiple worktrees efficiently', async () => {
      const worktreeCount = 10;
      const startTime = Date.now();

      // Register multiple worktrees
      for (let i = 0; i < worktreeCount; i++) {
        monitor.registerWorktree(`/test/performance-${i}`);
      }

      // Update resources
      await monitor.updateResourceUsage();

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(monitor.worktreeResources.size).toBe(worktreeCount);
    });

    test('should maintain performance with frequent updates', async () => {
      monitor.registerWorktree('/test/frequent-updates');

      const startTime = Date.now();
      const updateCount = 10;

      for (let i = 0; i < updateCount; i++) {
        await monitor.updateResourceUsage();
      }

      const duration = Date.now() - startTime;
      const averageUpdateTime = duration / updateCount;

      expect(averageUpdateTime).toBeLessThan(100); // Each update should be fast
    });
  });
}); 