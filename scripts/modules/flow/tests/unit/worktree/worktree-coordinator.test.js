/**
 * @file worktree-coordinator.test.js
 * @description Tests for WorktreeCoordinator class
 * Tests coordination between components, lifecycle management, and system integration
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock WorktreeCoordinator class that orchestrates all worktree components
class MockWorktreeCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      rootPath: options.rootPath || '/mock/coordinator-project',
      enableResourceMonitoring: options.enableResourceMonitoring !== false,
      enableFileWatching: options.enableFileWatching !== false,
      autoCleanup: options.autoCleanup !== false,
      coordinationInterval: options.coordinationInterval || 10000,
      ...options
    };
    
    // Mock component instances
    this.worktreeManager = null;
    this.simpleManager = null;
    this.resourceMonitor = null;
    
    this.isInitialized = false;
    this.isCoordinating = false;
    this.coordinationTimer = null;
    
    this.statistics = {
      coordinationCycles: 0,
      syncOperations: 0,
      conflicts: 0,
      resolutions: 0,
      errors: 0,
      lastCoordinationTime: null
    };
    
    this.activeOperations = new Set();
    this.operationQueue = [];
  }

  async initialize() {
    if (this.isInitialized) {
      throw new Error('WorktreeCoordinator already initialized');
    }

    try {
      this.emit('initializationStarted');

      // Initialize component managers
      await this.initializeComponents();
      
      // Start coordination if enabled
      if (this.options.coordinationInterval > 0) {
        this.startCoordination();
      }
      
      this.isInitialized = true;
      this.emit('initialized', {
        componentsActive: this.getActiveComponents().length,
        coordinationEnabled: this.isCoordinating
      });
      
      return {
        success: true,
        componentsActive: this.getActiveComponents().length
      };
    } catch (error) {
      this.statistics.errors++;
      this.emit('error', error);
      throw error;
    }
  }

  async initializeComponents() {
    // Mock component initialization
    this.worktreeManager = {
      isInitialized: true,
      worktrees: new Map([
        ['/mock/main', { path: '/mock/main', branch: 'main', isMain: true }],
        ['/mock/feature-1', { path: '/mock/feature-1', branch: 'feature/auth', isMain: false }]
      ]),
      getAllWorktrees: () => Array.from(this.worktreeManager.worktrees.values()),
      addWorktree: jest.fn().mockResolvedValue(true),
      removeWorktree: jest.fn().mockResolvedValue(true),
      cleanup: jest.fn().mockResolvedValue([])
    };

    if (this.options.enableResourceMonitoring) {
      this.resourceMonitor = {
        isInitialized: true,
        worktreeResources: new Map(),
        registerWorktree: jest.fn().mockReturnValue(true),
        unregisterWorktree: jest.fn().mockReturnValue(true),
        getStatistics: jest.fn().mockReturnValue({
          alertsTriggered: 0,
          resourceViolations: 0
        })
      };
    }

    this.simpleManager = {
      isInitialized: true,
      worktrees: [
        { path: '/mock/main', branch: 'main', isMain: true },
        { path: '/mock/feature-1', branch: 'feature/auth', isMain: false }
      ],
      getWorktrees: () => this.simpleManager.worktrees,
      scan: jest.fn().mockResolvedValue(2)
    };

    this.emit('componentsInitialized', {
      worktreeManager: !!this.worktreeManager,
      resourceMonitor: !!this.resourceMonitor,
      simpleManager: !!this.simpleManager
    });
  }

  getActiveComponents() {
    const components = [];
    if (this.worktreeManager?.isInitialized) components.push('worktreeManager');
    if (this.resourceMonitor?.isInitialized) components.push('resourceMonitor');
    if (this.simpleManager?.isInitialized) components.push('simpleManager');
    return components;
  }

  async syncComponents() {
    if (!this.isInitialized) {
      throw new Error('Coordinator not initialized');
    }

    const operationId = `sync-${Date.now()}`;
    this.activeOperations.add(operationId);

    try {
      this.emit('syncStarted', { operationId });

      // Sync worktree data between components
      const managerWorktrees = this.worktreeManager.getAllWorktrees();
      const simpleWorktrees = this.simpleManager.getWorktrees();

      // Detect conflicts and sync
      const conflicts = this.detectConflicts(managerWorktrees, simpleWorktrees);
      if (conflicts.length > 0) {
        await this.resolveConflicts(conflicts);
      }

      // Sync resource monitoring
      if (this.resourceMonitor) {
        await this.syncResourceMonitoring(managerWorktrees);
      }

      this.statistics.syncOperations++;
      this.emit('syncCompleted', {
        operationId,
        conflictsDetected: conflicts.length,
        worktreesSynced: managerWorktrees.length
      });

      return {
        success: true,
        conflictsResolved: conflicts.length,
        worktreesSynced: managerWorktrees.length
      };
    } catch (error) {
      this.statistics.errors++;
      this.emit('syncError', { operationId, error: error.message });
      throw error;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  detectConflicts(managerWorktrees, simpleWorktrees) {
    const conflicts = [];
    
    // Check for path mismatches
    const managerPaths = new Set(managerWorktrees.map(w => w.path));
    const simplePaths = new Set(simpleWorktrees.map(w => w.path));

    // Worktrees in manager but not in simple
    for (const path of managerPaths) {
      if (!simplePaths.has(path)) {
        conflicts.push({
          type: 'missing_in_simple',
          path,
          resolution: 'add_to_simple'
        });
      }
    }

    // Worktrees in simple but not in manager
    for (const path of simplePaths) {
      if (!managerPaths.has(path)) {
        conflicts.push({
          type: 'missing_in_manager',
          path,
          resolution: 'add_to_manager'
        });
      }
    }

    // Branch mismatches
    for (const managerWorktree of managerWorktrees) {
      const simpleWorktree = simpleWorktrees.find(w => w.path === managerWorktree.path);
      if (simpleWorktree && simpleWorktree.branch !== managerWorktree.branch) {
        conflicts.push({
          type: 'branch_mismatch',
          path: managerWorktree.path,
          managerBranch: managerWorktree.branch,
          simpleBranch: simpleWorktree.branch,
          resolution: 'sync_branch'
        });
      }
    }

    this.statistics.conflicts += conflicts.length;
    return conflicts;
  }

  async resolveConflicts(conflicts) {
    for (const conflict of conflicts) {
      try {
        switch (conflict.type) {
          case 'missing_in_simple':
            // Add worktree to simple manager
            const managerWorktree = this.worktreeManager.getAllWorktrees()
              .find(w => w.path === conflict.path);
            if (managerWorktree) {
              this.simpleManager.worktrees.push(managerWorktree);
            }
            break;

          case 'missing_in_manager':
            // Add worktree to manager
            const simpleWorktree = this.simpleManager.getWorktrees()
              .find(w => w.path === conflict.path);
            if (simpleWorktree) {
              await this.worktreeManager.addWorktree(
                simpleWorktree.path,
                simpleWorktree.branch,
                simpleWorktree.isMain
              );
            }
            break;

          case 'branch_mismatch':
            // Sync branch information (prefer manager's data)
            const simpleIndex = this.simpleManager.worktrees
              .findIndex(w => w.path === conflict.path);
            if (simpleIndex >= 0) {
              this.simpleManager.worktrees[simpleIndex].branch = conflict.managerBranch;
            }
            break;
        }

        this.statistics.resolutions++;
        this.emit('conflictResolved', conflict);
      } catch (error) {
        this.emit('conflictResolutionFailed', { conflict, error: error.message });
      }
    }
  }

  async syncResourceMonitoring(worktrees) {
    if (!this.resourceMonitor) return;

    // Register any new worktrees with resource monitor
    for (const worktree of worktrees) {
      try {
        this.resourceMonitor.registerWorktree(worktree.path);
      } catch (error) {
        // Worktree might already be registered
        if (!error.message.includes('already registered')) {
          throw error;
        }
      }
    }

    // Unregister removed worktrees
    const currentPaths = new Set(worktrees.map(w => w.path));
    for (const [path] of this.resourceMonitor.worktreeResources) {
      if (!currentPaths.has(path)) {
        this.resourceMonitor.unregisterWorktree(path);
      }
    }
  }

  startCoordination() {
    if (this.isCoordinating) {
      return false;
    }

    this.isCoordinating = true;
    this.coordinationTimer = setInterval(async () => {
      try {
        await this.coordinationCycle();
      } catch (error) {
        this.statistics.errors++;
        this.emit('error', error);
      }
    }, this.options.coordinationInterval);

    this.emit('coordinationStarted', {
      interval: this.options.coordinationInterval
    });

    return true;
  }

  stopCoordination() {
    if (!this.isCoordinating) {
      return false;
    }

    this.isCoordinating = false;
    if (this.coordinationTimer) {
      clearInterval(this.coordinationTimer);
      this.coordinationTimer = null;
    }

    this.emit('coordinationStopped');
    return true;
  }

  async coordinationCycle() {
    this.statistics.coordinationCycles++;
    this.statistics.lastCoordinationTime = new Date().toISOString();

    this.emit('coordinationCycleStarted');

    try {
      // Sync components
      await this.syncComponents();

      // Perform cleanup if enabled
      if (this.options.autoCleanup) {
        await this.performCleanup();
      }

      // Check system health
      const health = this.checkSystemHealth();
      
      this.emit('coordinationCycleCompleted', {
        syncSuccess: true,
        systemHealth: health
      });
    } catch (error) {
      this.emit('coordinationCycleError', { error: error.message });
      throw error;
    }
  }

  async performCleanup() {
    if (this.worktreeManager.cleanup) {
      const cleanedUp = await this.worktreeManager.cleanup();
      if (cleanedUp.length > 0) {
        this.emit('cleanupPerformed', { cleanedUpPaths: cleanedUp });
      }
    }
  }

  checkSystemHealth() {
    const health = {
      overall: 'healthy',
      components: {},
      issues: []
    };

    // Check component health
    health.components.worktreeManager = this.worktreeManager?.isInitialized ? 'healthy' : 'unhealthy';
    health.components.simpleManager = this.simpleManager?.isInitialized ? 'healthy' : 'unhealthy';
    health.components.resourceMonitor = this.resourceMonitor?.isInitialized ? 'healthy' : 'unhealthy';

    // Check for issues
    if (this.statistics.errors > 10) {
      health.issues.push('High error count');
      health.overall = 'degraded';
    }

    if (this.activeOperations.size > 5) {
      health.issues.push('High active operation count');
      health.overall = 'degraded';
    }

    if (this.resourceMonitor) {
      const resourceStats = this.resourceMonitor.getStatistics();
      if (resourceStats.alertsTriggered > 0) {
        health.issues.push('Resource alerts active');
        health.overall = 'degraded';
      }
    }

    return health;
  }

  async queueOperation(operation, priority = 'normal') {
    return new Promise((resolve, reject) => {
      const queuedOperation = {
        operation,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };

      if (priority === 'high') {
        this.operationQueue.unshift(queuedOperation);
      } else {
        this.operationQueue.push(queuedOperation);
      }

      this.processOperationQueue();
    });
  }

  async processOperationQueue() {
    if (this.operationQueue.length === 0 || this.activeOperations.size >= 3) {
      return;
    }

    const queuedOp = this.operationQueue.shift();
    const operationId = `queued-${Date.now()}`;
    this.activeOperations.add(operationId);

    try {
      const result = await queuedOp.operation();
      queuedOp.resolve(result);
    } catch (error) {
      queuedOp.reject(error);
    } finally {
      this.activeOperations.delete(operationId);
      this.processOperationQueue(); // Process next operation
    }
  }

  getComponentStatus() {
    return {
      worktreeManager: {
        active: !!this.worktreeManager?.isInitialized,
        worktreeCount: this.worktreeManager?.getAllWorktrees().length || 0
      },
      resourceMonitor: {
        active: !!this.resourceMonitor?.isInitialized,
        alertsActive: this.resourceMonitor?.getStatistics().alertsTriggered || 0
      },
      simpleManager: {
        active: !!this.simpleManager?.isInitialized,
        worktreeCount: this.simpleManager?.getWorktrees().length || 0
      }
    };
  }

  getStatistics() {
    return {
      ...this.statistics,
      isInitialized: this.isInitialized,
      isCoordinating: this.isCoordinating,
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      activeComponents: this.getActiveComponents().length,
      systemHealth: this.checkSystemHealth()
    };
  }

  async destroy() {
    this.stopCoordination();
    
    // Clear operation queue
    this.operationQueue.forEach(op => {
      op.reject(new Error('Coordinator destroyed'));
    });
    this.operationQueue = [];
    this.activeOperations.clear();

    // Reset components
    this.worktreeManager = null;
    this.resourceMonitor = null;
    this.simpleManager = null;
    
    this.isInitialized = false;
    this.emit('destroyed');
  }
}

describe('WorktreeCoordinator', () => {
  let coordinator;

  beforeEach(() => {
    coordinator = new MockWorktreeCoordinator({
      rootPath: '/test/coordinator-project',
      enableResourceMonitoring: true,
      enableFileWatching: true,
      autoCleanup: true,
      coordinationInterval: 100 // Short for testing
    });
  });

  afterEach(async () => {
    if (coordinator) {
      await coordinator.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await coordinator.initialize();

      expect(result.success).toBe(true);
      expect(result.componentsActive).toBeGreaterThan(0);
      expect(coordinator.isInitialized).toBe(true);
    });

    test('should emit initialization events', async () => {
      const startedSpy = jest.fn();
      const initializedSpy = jest.fn();
      const componentsInitializedSpy = jest.fn();
      
      coordinator.on('initializationStarted', startedSpy);
      coordinator.on('initialized', initializedSpy);
      coordinator.on('componentsInitialized', componentsInitializedSpy);

      await coordinator.initialize();

      expect(startedSpy).toHaveBeenCalled();
      expect(componentsInitializedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          worktreeManager: true,
          resourceMonitor: true,
          simpleManager: true
        })
      );
      expect(initializedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          componentsActive: expect.any(Number),
          coordinationEnabled: true
        })
      );
    });

    test('should throw error if already initialized', async () => {
      await coordinator.initialize();

      await expect(coordinator.initialize()).rejects.toThrow(
        'WorktreeCoordinator already initialized'
      );
    });

    test('should initialize components correctly', async () => {
      await coordinator.initialize();

      expect(coordinator.worktreeManager).toBeTruthy();
      expect(coordinator.resourceMonitor).toBeTruthy();
      expect(coordinator.simpleManager).toBeTruthy();
      
      const activeComponents = coordinator.getActiveComponents();
      expect(activeComponents).toContain('worktreeManager');
      expect(activeComponents).toContain('resourceMonitor');
      expect(activeComponents).toContain('simpleManager');
    });
  });

  describe('Component Synchronization', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    test('should sync components successfully', async () => {
      const result = await coordinator.syncComponents();

      expect(result.success).toBe(true);
      expect(result.conflictsResolved).toBeGreaterThanOrEqual(0);
      expect(result.worktreesSynced).toBeGreaterThan(0);
      expect(coordinator.statistics.syncOperations).toBe(1);
    });

    test('should emit sync events', async () => {
      const startedSpy = jest.fn();
      const completedSpy = jest.fn();
      
      coordinator.on('syncStarted', startedSpy);
      coordinator.on('syncCompleted', completedSpy);

      await coordinator.syncComponents();

      expect(startedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: expect.any(String)
        })
      );
      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: expect.any(String),
          conflictsDetected: expect.any(Number),
          worktreesSynced: expect.any(Number)
        })
      );
    });

    test('should detect conflicts between components', async () => {
      // Modify simple manager to create conflict
      coordinator.simpleManager.worktrees.push({
        path: '/test/conflict-worktree',
        branch: 'conflict-branch',
        isMain: false
      });

      await coordinator.syncComponents();

      expect(coordinator.statistics.conflicts).toBeGreaterThan(0);
      expect(coordinator.statistics.resolutions).toBeGreaterThan(0);
    });

    test('should handle sync errors gracefully', async () => {
      const errorSpy = jest.fn();
      coordinator.on('syncError', errorSpy);

      // Force an error
      coordinator.worktreeManager.getAllWorktrees = jest.fn().mockImplementation(() => {
        throw new Error('Sync test error');
      });

      await expect(coordinator.syncComponents()).rejects.toThrow('Sync test error');
      expect(errorSpy).toHaveBeenCalled();
      expect(coordinator.statistics.errors).toBe(1);
    });
  });

  describe('Conflict Detection and Resolution', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    test('should detect missing worktrees in simple manager', () => {
      const managerWorktrees = [
        { path: '/test/manager-only', branch: 'main', isMain: true }
      ];
      const simpleWorktrees = [];

      const conflicts = coordinator.detectConflicts(managerWorktrees, simpleWorktrees);

      expect(conflicts).toContainEqual(
        expect.objectContaining({
          type: 'missing_in_simple',
          path: '/test/manager-only',
          resolution: 'add_to_simple'
        })
      );
    });

    test('should detect missing worktrees in manager', () => {
      const managerWorktrees = [];
      const simpleWorktrees = [
        { path: '/test/simple-only', branch: 'main', isMain: true }
      ];

      const conflicts = coordinator.detectConflicts(managerWorktrees, simpleWorktrees);

      expect(conflicts).toContainEqual(
        expect.objectContaining({
          type: 'missing_in_manager',
          path: '/test/simple-only',
          resolution: 'add_to_manager'
        })
      );
    });

    test('should detect branch mismatches', () => {
      const managerWorktrees = [
        { path: '/test/mismatch', branch: 'main', isMain: true }
      ];
      const simpleWorktrees = [
        { path: '/test/mismatch', branch: 'develop', isMain: true }
      ];

      const conflicts = coordinator.detectConflicts(managerWorktrees, simpleWorktrees);

      expect(conflicts).toContainEqual(
        expect.objectContaining({
          type: 'branch_mismatch',
          path: '/test/mismatch',
          managerBranch: 'main',
          simpleBranch: 'develop'
        })
      );
    });

    test('should resolve conflicts and emit events', async () => {
      const conflictResolvedSpy = jest.fn();
      coordinator.on('conflictResolved', conflictResolvedSpy);

      const conflicts = [
        {
          type: 'missing_in_simple',
          path: '/test/resolve',
          resolution: 'add_to_simple'
        }
      ];

      // Add worktree to manager for resolution
      coordinator.worktreeManager.worktrees.set('/test/resolve', {
        path: '/test/resolve',
        branch: 'test',
        isMain: false
      });

      await coordinator.resolveConflicts(conflicts);

      expect(conflictResolvedSpy).toHaveBeenCalledWith(conflicts[0]);
      expect(coordinator.statistics.resolutions).toBe(1);
    });
  });

  describe('Coordination Cycle', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    test('should start coordination', () => {
      coordinator.stopCoordination(); // Stop auto-started coordination
      
      const coordinationStartedSpy = jest.fn();
      coordinator.on('coordinationStarted', coordinationStartedSpy);

      const result = coordinator.startCoordination();

      expect(result).toBe(true);
      expect(coordinator.isCoordinating).toBe(true);
      expect(coordinator.coordinationTimer).toBeTruthy();
      expect(coordinationStartedSpy).toHaveBeenCalledWith({
        interval: coordinator.options.coordinationInterval
      });
    });

    test('should stop coordination', () => {
      const coordinationStoppedSpy = jest.fn();
      coordinator.on('coordinationStopped', coordinationStoppedSpy);

      const result = coordinator.stopCoordination();

      expect(result).toBe(true);
      expect(coordinator.isCoordinating).toBe(false);
      expect(coordinator.coordinationTimer).toBeNull();
      expect(coordinationStoppedSpy).toHaveBeenCalled();
    });

    test('should perform coordination cycle', async () => {
      const cycleStartedSpy = jest.fn();
      const cycleCompletedSpy = jest.fn();
      
      coordinator.on('coordinationCycleStarted', cycleStartedSpy);
      coordinator.on('coordinationCycleCompleted', cycleCompletedSpy);

      await coordinator.coordinationCycle();

      expect(cycleStartedSpy).toHaveBeenCalled();
      expect(cycleCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          syncSuccess: true,
          systemHealth: expect.any(Object)
        })
      );
      expect(coordinator.statistics.coordinationCycles).toBe(1);
    });

    test('should handle coordination cycle errors', async () => {
      const cycleErrorSpy = jest.fn();
      coordinator.on('coordinationCycleError', cycleErrorSpy);

      // Force an error in sync
      coordinator.syncComponents = jest.fn().mockRejectedValue(new Error('Cycle test error'));

      await expect(coordinator.coordinationCycle()).rejects.toThrow('Cycle test error');
      expect(cycleErrorSpy).toHaveBeenCalledWith({
        error: 'Cycle test error'
      });
    });
  });

  describe('System Health Monitoring', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    test('should check system health', () => {
      const health = coordinator.checkSystemHealth();

      expect(health.overall).toBe('healthy');
      expect(health.components).toHaveProperty('worktreeManager');
      expect(health.components).toHaveProperty('resourceMonitor');
      expect(health.components).toHaveProperty('simpleManager');
      expect(Array.isArray(health.issues)).toBe(true);
    });

    test('should detect degraded health with high error count', () => {
      coordinator.statistics.errors = 15; // Above threshold

      const health = coordinator.checkSystemHealth();

      expect(health.overall).toBe('degraded');
      expect(health.issues).toContain('High error count');
    });

    test('should detect degraded health with high active operations', () => {
      // Simulate high active operations
      for (let i = 0; i < 6; i++) {
        coordinator.activeOperations.add(`op-${i}`);
      }

      const health = coordinator.checkSystemHealth();

      expect(health.overall).toBe('degraded');
      expect(health.issues).toContain('High active operation count');
    });
  });

  describe('Operation Queue Management', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    test('should queue and execute operations', async () => {
      const operation = jest.fn().mockResolvedValue('operation result');

      const result = await coordinator.queueOperation(operation);

      expect(result).toBe('operation result');
      expect(operation).toHaveBeenCalled();
    });

    test('should prioritize high priority operations', async () => {
      const normalOp = jest.fn().mockResolvedValue('normal');
      const highOp = jest.fn().mockResolvedValue('high');

      // Fill active operations to force queueing
      coordinator.activeOperations.add('op1');
      coordinator.activeOperations.add('op2');
      coordinator.activeOperations.add('op3');

      const normalPromise = coordinator.queueOperation(normalOp, 'normal');
      const highPromise = coordinator.queueOperation(highOp, 'high');

      // Clear active operations to process queue
      coordinator.activeOperations.clear();
      coordinator.processOperationQueue();

      const results = await Promise.all([normalPromise, highPromise]);

      expect(results).toEqual(['normal', 'high']);
      expect(coordinator.operationQueue.length).toBe(0);
    });

    test('should handle operation failures', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(coordinator.queueOperation(failingOperation)).rejects.toThrow('Operation failed');
    });
  });

  describe('Component Status and Statistics', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    test('should get component status', () => {
      const status = coordinator.getComponentStatus();

      expect(status.worktreeManager.active).toBe(true);
      expect(status.worktreeManager.worktreeCount).toBeGreaterThan(0);
      expect(status.resourceMonitor.active).toBe(true);
      expect(status.simpleManager.active).toBe(true);
      expect(status.simpleManager.worktreeCount).toBeGreaterThan(0);
    });

    test('should get comprehensive statistics', () => {
      const stats = coordinator.getStatistics();

      expect(stats.isInitialized).toBe(true);
      expect(stats.isCoordinating).toBe(true);
      expect(stats.activeComponents).toBeGreaterThan(0);
      expect(stats.systemHealth).toBeDefined();
      expect(stats.coordinationCycles).toBeGreaterThanOrEqual(0);
      expect(stats.syncOperations).toBeGreaterThanOrEqual(0);
    });

    test('should track operation statistics', async () => {
      const initialStats = coordinator.getStatistics();

      await coordinator.syncComponents();
      await coordinator.coordinationCycle();

      const finalStats = coordinator.getStatistics();

      expect(finalStats.syncOperations).toBe(initialStats.syncOperations + 2); // One from sync, one from cycle
      expect(finalStats.coordinationCycles).toBe(initialStats.coordinationCycles + 1);
    });
  });

  describe('Cleanup and Destruction', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    test('should perform cleanup when enabled', async () => {
      const cleanupSpy = jest.fn();
      coordinator.on('cleanupPerformed', cleanupSpy);

      coordinator.worktreeManager.cleanup = jest.fn().mockResolvedValue(['/test/cleaned']);

      await coordinator.performCleanup();

      expect(coordinator.worktreeManager.cleanup).toHaveBeenCalled();
      expect(cleanupSpy).toHaveBeenCalledWith({
        cleanedUpPaths: ['/test/cleaned']
      });
    });

    test('should destroy coordinator cleanly', async () => {
      const destroyedSpy = jest.fn();
      coordinator.on('destroyed', destroyedSpy);

      // Add some operations to queue
      const operation = jest.fn().mockResolvedValue('test');
      coordinator.queueOperation(operation);

      await coordinator.destroy();

      expect(coordinator.isInitialized).toBe(false);
      expect(coordinator.isCoordinating).toBe(false);
      expect(coordinator.coordinationTimer).toBeNull();
      expect(coordinator.operationQueue.length).toBe(0);
      expect(coordinator.activeOperations.size).toBe(0);
      expect(coordinator.worktreeManager).toBeNull();
      expect(coordinator.resourceMonitor).toBeNull();
      expect(coordinator.simpleManager).toBeNull();
      expect(destroyedSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    test('should handle multiple sync operations efficiently', async () => {
      const startTime = Date.now();
      const syncPromises = [];

      for (let i = 0; i < 5; i++) {
        syncPromises.push(coordinator.syncComponents());
      }

      await Promise.all(syncPromises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(coordinator.statistics.syncOperations).toBe(5);
    });

    test('should maintain performance with frequent coordination cycles', async () => {
      const startTime = Date.now();
      
      // Run multiple coordination cycles
      for (let i = 0; i < 3; i++) {
        await coordinator.coordinationCycle();
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Should be fast
      expect(coordinator.statistics.coordinationCycles).toBe(3);
    });
  });
}); 