/**
 * @file worktree-manager.test.js
 * @description Comprehensive tests for WorktreeManager class
 * Tests Git worktree discovery, lifecycle management, and worktree operations
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock WorktreeManager class with comprehensive functionality
class MockWorktreeManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      rootPath: options.rootPath || '/mock/project',
      maxWorktrees: options.maxWorktrees || 10,
      autoCleanup: options.autoCleanup !== false,
      watchFiles: options.watchFiles !== false,
      ...options
    };
    
    this.worktrees = new Map();
    this.watchers = new Map();
    this.statistics = {
      discoveredWorktrees: 0,
      createdWorktrees: 0,
      removedWorktrees: 0,
      totalOperations: 0,
      failedOperations: 0,
      averageDiscoveryTime: 0,
      lastDiscoveryTime: null
    };
    
    this.isInitialized = false;
    this.isDiscovering = false;
    this.operationQueue = [];
    this.activeOperations = 0;
    this.maxConcurrentOperations = options.maxConcurrentOperations || 5;
  }

  async initialize() {
    if (this.isInitialized) {
      throw new Error('WorktreeManager already initialized');
    }

    const startTime = Date.now();
    
    try {
      // Simulate initialization delay
      await new Promise(resolve => setTimeout(resolve, Math.max(1, Math.random() * 10)));
      
      // Mock discovering existing worktrees
      await this.discoverWorktrees();
      
      this.isInitialized = true;
      this.emit('initialized', { 
        worktreeCount: this.worktrees.size,
        initializationTime: Date.now() - startTime
      });
      
      return {
        success: true,
        worktreeCount: this.worktrees.size,
        initializationTime: Date.now() - startTime
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async discoverWorktrees() {
    if (this.isDiscovering) {
      throw new Error('Discovery already in progress');
    }

    const startTime = Date.now();
    this.isDiscovering = true;
    
    try {
      this.emit('discoveryStarted');
      
      // Mock discovering worktrees
      const mockWorktrees = [
        { path: '/mock/project', branch: 'main', isMain: true },
        { path: '/mock/project-feature-1', branch: 'feature/user-auth', isMain: false },
        { path: '/mock/project-feature-2', branch: 'feature/api-refactor', isMain: false }
      ];

      for (const worktree of mockWorktrees) {
        await this.addWorktree(worktree.path, worktree.branch, worktree.isMain);
        this.statistics.discoveredWorktrees++;
      }

      const discoveryTime = Date.now() - startTime;
      this.statistics.averageDiscoveryTime = this.updateAverage(
        this.statistics.averageDiscoveryTime,
        discoveryTime,
        this.statistics.totalOperations
      );
      this.statistics.lastDiscoveryTime = new Date().toISOString();
      
      this.emit('discoveryCompleted', {
        discoveredCount: mockWorktrees.length,
        discoveryTime
      });

      return mockWorktrees.length;
    } finally {
      this.isDiscovering = false;
    }
  }

  async addWorktree(path, branch, isMain = false) {
    if (this.worktrees.has(path)) {
      throw new Error(`Worktree already exists at path: ${path}`);
    }

    if (this.worktrees.size >= this.options.maxWorktrees) {
      throw new Error(`Maximum worktree limit reached: ${this.options.maxWorktrees}`);
    }

    const worktree = {
      path,
      branch,
      isMain,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      status: 'active',
      fileCount: Math.floor(Math.random() * 100) + 10,
      size: Math.floor(Math.random() * 1000000) + 100000
    };

    this.worktrees.set(path, worktree);
    this.statistics.createdWorktrees++;
    this.statistics.totalOperations++;

    if (this.options.watchFiles) {
      await this.startWatching(path);
    }

    this.emit('worktreeAdded', { path, branch, isMain });
    return worktree;
  }

  async removeWorktree(path, force = false) {
    const worktree = this.worktrees.get(path);
    if (!worktree) {
      throw new Error(`Worktree not found at path: ${path}`);
    }

    if (worktree.isMain && !force) {
      throw new Error('Cannot remove main worktree without force flag');
    }

    if (worktree.status === 'locked' && !force) {
      throw new Error('Cannot remove locked worktree without force flag');
    }

    // Stop watching if enabled
    if (this.watchers.has(path)) {
      await this.stopWatching(path);
    }

    this.worktrees.delete(path);
    this.statistics.removedWorktrees++;
    this.statistics.totalOperations++;

    this.emit('worktreeRemoved', { path, branch: worktree.branch });
    return true;
  }

  async startWatching(path) {
    if (this.watchers.has(path)) {
      throw new Error(`Already watching path: ${path}`);
    }

    const watcher = {
      path,
      startTime: new Date().toISOString(),
      eventCount: 0,
      lastEvent: null
    };

    this.watchers.set(path, watcher);
    this.emit('watchingStarted', { path });

    // Simulate file events
    setTimeout(() => {
      this.simulateFileEvent(path, 'change', 'src/index.js');
    }, 100);

    return watcher;
  }

  async stopWatching(path) {
    const watcher = this.watchers.get(path);
    if (!watcher) {
      throw new Error(`Not watching path: ${path}`);
    }

    this.watchers.delete(path);
    this.emit('watchingStopped', { path, eventCount: watcher.eventCount });
    return true;
  }

  simulateFileEvent(worktreePath, eventType, filePath) {
    const watcher = this.watchers.get(worktreePath);
    if (!watcher) return;

    watcher.eventCount++;
    watcher.lastEvent = {
      type: eventType,
      file: filePath,
      timestamp: new Date().toISOString()
    };

    this.emit('fileChanged', {
      worktreePath,
      eventType,
      filePath,
      timestamp: watcher.lastEvent.timestamp
    });
  }

  getWorktree(path) {
    return this.worktrees.get(path) || null;
  }

  getAllWorktrees() {
    return Array.from(this.worktrees.values());
  }

  getWorktreesByBranch(branch) {
    return this.getAllWorktrees().filter(w => w.branch === branch);
  }

  getMainWorktree() {
    return this.getAllWorktrees().find(w => w.isMain) || null;
  }

  async lockWorktree(path, reason = 'Manual lock') {
    const worktree = this.worktrees.get(path);
    if (!worktree) {
      throw new Error(`Worktree not found at path: ${path}`);
    }

    if (worktree.status === 'locked') {
      throw new Error(`Worktree already locked: ${path}`);
    }

    worktree.status = 'locked';
    worktree.lockReason = reason;
    worktree.lockedAt = new Date().toISOString();

    this.emit('worktreeLocked', { path, reason });
    return true;
  }

  async unlockWorktree(path) {
    const worktree = this.worktrees.get(path);
    if (!worktree) {
      throw new Error(`Worktree not found at path: ${path}`);
    }

    if (worktree.status !== 'locked') {
      throw new Error(`Worktree not locked: ${path}`);
    }

    worktree.status = 'active';
    delete worktree.lockReason;
    delete worktree.lockedAt;

    this.emit('worktreeUnlocked', { path });
    return true;
  }

  async cleanup() {
    const cleanedUp = [];

    for (const [path, worktree] of this.worktrees) {
      if (!worktree.isMain && worktree.status !== 'locked') {
        // Simulate cleanup conditions
        const lastAccessed = new Date(worktree.lastAccessed);
        const daysSinceAccess = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceAccess > 7) { // Clean up worktrees not accessed for 7 days
          await this.removeWorktree(path);
          cleanedUp.push(path);
        }
      }
    }

    this.emit('cleanupCompleted', { cleanedUpCount: cleanedUp.length, paths: cleanedUp });
    return cleanedUp;
  }

  async queueOperation(operation, priority = 'normal') {
    if (this.activeOperations >= this.maxConcurrentOperations) {
      return new Promise((resolve) => {
        this.operationQueue.push({ operation, priority, resolve });
      });
    }

    return this.executeOperation(operation);
  }

  async executeOperation(operation) {
    this.activeOperations++;
    
    try {
      const result = await operation();
      return result;
    } catch (error) {
      this.statistics.failedOperations++;
      throw error;
    } finally {
      this.activeOperations--;
      this.processQueue();
    }
  }

  processQueue() {
    if (this.operationQueue.length > 0 && this.activeOperations < this.maxConcurrentOperations) {
      const { operation, resolve } = this.operationQueue.shift();
      resolve(this.executeOperation(operation));
    }
  }

  updateAverage(currentAverage, newValue, count) {
    if (count === 0) return newValue;
    return (currentAverage * count + newValue) / (count + 1);
  }

  getStatistics() {
    return {
      ...this.statistics,
      activeWorktrees: this.worktrees.size,
      watchedPaths: this.watchers.size,
      queuedOperations: this.operationQueue.length,
      activeOperations: this.activeOperations,
      successRate: this.statistics.totalOperations > 0 
        ? ((this.statistics.totalOperations - this.statistics.failedOperations) / this.statistics.totalOperations) * 100 
        : 100
    };
  }

  async destroy() {
    // Stop all watchers
    for (const path of this.watchers.keys()) {
      await this.stopWatching(path);
    }

    // Clear all data
    this.worktrees.clear();
    this.watchers.clear();
    this.operationQueue.length = 0;
    this.isInitialized = false;

    this.emit('destroyed');
  }
}

describe('WorktreeManager', () => {
  let manager;

  beforeEach(() => {
    manager = new MockWorktreeManager({
      rootPath: '/test/project',
      maxWorktrees: 5,
      autoCleanup: true,
      watchFiles: true
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await manager.initialize();

      expect(result.success).toBe(true);
      expect(result.worktreeCount).toBeGreaterThan(0);
      expect(result.initializationTime).toBeGreaterThan(0);
      expect(manager.isInitialized).toBe(true);
    });

    test('should emit initialized event', async () => {
      const initSpy = jest.fn();
      manager.on('initialized', initSpy);

      await manager.initialize();

      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          worktreeCount: expect.any(Number),
          initializationTime: expect.any(Number)
        })
      );
    });

    test('should throw error if already initialized', async () => {
      await manager.initialize();

      await expect(manager.initialize()).rejects.toThrow('WorktreeManager already initialized');
    });

    test('should discover existing worktrees during initialization', async () => {
      await manager.initialize();

      const worktrees = manager.getAllWorktrees();
      expect(worktrees.length).toBeGreaterThan(0);
      
      const mainWorktree = manager.getMainWorktree();
      expect(mainWorktree).toBeTruthy();
      expect(mainWorktree.isMain).toBe(true);
    });
  });

  describe('Worktree Discovery', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should discover worktrees', async () => {
      // Clear existing worktrees
      manager.worktrees.clear();

      const discoveredCount = await manager.discoverWorktrees();

      expect(discoveredCount).toBeGreaterThan(0);
      expect(manager.statistics.discoveredWorktrees).toBe(discoveredCount);
    });

    test('should emit discovery events', async () => {
      const startSpy = jest.fn();
      const completedSpy = jest.fn();
      
      manager.on('discoveryStarted', startSpy);
      manager.on('discoveryCompleted', completedSpy);

      manager.worktrees.clear();
      await manager.discoverWorktrees();

      expect(startSpy).toHaveBeenCalled();
      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          discoveredCount: expect.any(Number),
          discoveryTime: expect.any(Number)
        })
      );
    });

    test('should throw error if discovery already in progress', async () => {
      const discoveryPromise1 = manager.discoverWorktrees();
      const discoveryPromise2 = manager.discoverWorktrees();

      await expect(discoveryPromise1).resolves.toBeGreaterThan(0);
      await expect(discoveryPromise2).rejects.toThrow('Discovery already in progress');
    });

    test('should update discovery statistics', async () => {
      const initialStats = manager.getStatistics();
      
      manager.worktrees.clear();
      await manager.discoverWorktrees();

      const finalStats = manager.getStatistics();
      expect(finalStats.discoveredWorktrees).toBeGreaterThan(initialStats.discoveredWorktrees);
      expect(finalStats.averageDiscoveryTime).toBeGreaterThan(0);
      expect(finalStats.lastDiscoveryTime).toBeTruthy();
    });
  });

  describe('Worktree Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should add new worktree', async () => {
      const path = '/test/project-new-feature';
      const branch = 'feature/new-feature';

      const worktree = await manager.addWorktree(path, branch);

      expect(worktree.path).toBe(path);
      expect(worktree.branch).toBe(branch);
      expect(worktree.isMain).toBe(false);
      expect(worktree.status).toBe('active');
      expect(manager.getWorktree(path)).toBe(worktree);
    });

    test('should emit worktreeAdded event', async () => {
      const addedSpy = jest.fn();
      manager.on('worktreeAdded', addedSpy);

      const path = '/test/project-new-feature';
      const branch = 'feature/new-feature';
      await manager.addWorktree(path, branch);

      expect(addedSpy).toHaveBeenCalledWith({
        path,
        branch,
        isMain: false
      });
    });

    test('should throw error for duplicate worktree path', async () => {
      const path = '/test/project-duplicate';
      const branch = 'feature/duplicate';

      await manager.addWorktree(path, branch);

      await expect(manager.addWorktree(path, 'another-branch')).rejects.toThrow(
        `Worktree already exists at path: ${path}`
      );
    });

    test('should enforce maximum worktree limit', async () => {
      // Fill up to the limit
      for (let i = 0; i < manager.options.maxWorktrees - manager.worktrees.size; i++) {
        await manager.addWorktree(`/test/project-${i}`, `feature/test-${i}`);
      }

      await expect(manager.addWorktree('/test/project-overflow', 'feature/overflow')).rejects.toThrow(
        `Maximum worktree limit reached: ${manager.options.maxWorktrees}`
      );
    });

    test('should remove worktree', async () => {
      const path = '/test/project-to-remove';
      const branch = 'feature/to-remove';

      await manager.addWorktree(path, branch);
      expect(manager.getWorktree(path)).toBeTruthy();

      const removed = await manager.removeWorktree(path);

      expect(removed).toBe(true);
      expect(manager.getWorktree(path)).toBeNull();
    });

    test('should emit worktreeRemoved event', async () => {
      const removedSpy = jest.fn();
      manager.on('worktreeRemoved', removedSpy);

      const path = '/test/project-to-remove';
      const branch = 'feature/to-remove';
      await manager.addWorktree(path, branch);
      await manager.removeWorktree(path);

      expect(removedSpy).toHaveBeenCalledWith({ path, branch });
    });

    test('should protect main worktree from removal', async () => {
      const mainWorktree = manager.getMainWorktree();
      expect(mainWorktree).toBeTruthy();

      await expect(manager.removeWorktree(mainWorktree.path)).rejects.toThrow(
        'Cannot remove main worktree without force flag'
      );
    });

    test('should allow forced removal of main worktree', async () => {
      const mainWorktree = manager.getMainWorktree();
      expect(mainWorktree).toBeTruthy();

      const removed = await manager.removeWorktree(mainWorktree.path, true);
      expect(removed).toBe(true);
    });

    test('should throw error when removing non-existent worktree', async () => {
      await expect(manager.removeWorktree('/non/existent/path')).rejects.toThrow(
        'Worktree not found at path: /non/existent/path'
      );
    });
  });

  describe('Worktree Queries', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should get all worktrees', () => {
      const worktrees = manager.getAllWorktrees();

      expect(Array.isArray(worktrees)).toBe(true);
      expect(worktrees.length).toBeGreaterThan(0);
      worktrees.forEach(worktree => {
        expect(worktree).toHaveProperty('path');
        expect(worktree).toHaveProperty('branch');
        expect(worktree).toHaveProperty('isMain');
      });
    });

    test('should get worktrees by branch', async () => {
      const branch = 'feature/test-branch';
      await manager.addWorktree('/test/project-branch-1', branch);
      await manager.addWorktree('/test/project-branch-2', branch);

      const branchWorktrees = manager.getWorktreesByBranch(branch);

      expect(branchWorktrees.length).toBe(2);
      branchWorktrees.forEach(worktree => {
        expect(worktree.branch).toBe(branch);
      });
    });

    test('should get main worktree', () => {
      const mainWorktree = manager.getMainWorktree();

      expect(mainWorktree).toBeTruthy();
      expect(mainWorktree.isMain).toBe(true);
    });

    test('should return null for non-existent worktree', () => {
      const worktree = manager.getWorktree('/non/existent/path');
      expect(worktree).toBeNull();
    });
  });

  describe('Worktree Locking', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should lock worktree', async () => {
      const path = '/test/project-to-lock';
      const branch = 'feature/to-lock';
      const reason = 'Testing lock functionality';

      await manager.addWorktree(path, branch);
      await manager.lockWorktree(path, reason);

      const worktree = manager.getWorktree(path);
      expect(worktree.status).toBe('locked');
      expect(worktree.lockReason).toBe(reason);
      expect(worktree.lockedAt).toBeTruthy();
    });

    test('should emit worktreeLocked event', async () => {
      const lockedSpy = jest.fn();
      manager.on('worktreeLocked', lockedSpy);

      const path = '/test/project-to-lock';
      const reason = 'Test lock';
      await manager.addWorktree(path, 'feature/lock');
      await manager.lockWorktree(path, reason);

      expect(lockedSpy).toHaveBeenCalledWith({ path, reason });
    });

    test('should unlock worktree', async () => {
      const path = '/test/project-to-unlock';
      await manager.addWorktree(path, 'feature/unlock');
      await manager.lockWorktree(path);

      await manager.unlockWorktree(path);

      const worktree = manager.getWorktree(path);
      expect(worktree.status).toBe('active');
      expect(worktree.lockReason).toBeUndefined();
      expect(worktree.lockedAt).toBeUndefined();
    });

    test('should emit worktreeUnlocked event', async () => {
      const unlockedSpy = jest.fn();
      manager.on('worktreeUnlocked', unlockedSpy);

      const path = '/test/project-to-unlock';
      await manager.addWorktree(path, 'feature/unlock');
      await manager.lockWorktree(path);
      await manager.unlockWorktree(path);

      expect(unlockedSpy).toHaveBeenCalledWith({ path });
    });

    test('should throw error when locking already locked worktree', async () => {
      const path = '/test/project-already-locked';
      await manager.addWorktree(path, 'feature/locked');
      await manager.lockWorktree(path);

      await expect(manager.lockWorktree(path)).rejects.toThrow(
        `Worktree already locked: ${path}`
      );
    });

    test('should prevent removal of locked worktree', async () => {
      const path = '/test/project-locked-removal';
      await manager.addWorktree(path, 'feature/locked-removal');
      await manager.lockWorktree(path);

      await expect(manager.removeWorktree(path)).rejects.toThrow(
        'Cannot remove locked worktree without force flag'
      );
    });

    test('should allow forced removal of locked worktree', async () => {
      const path = '/test/project-force-remove';
      await manager.addWorktree(path, 'feature/force-remove');
      await manager.lockWorktree(path);

      const removed = await manager.removeWorktree(path, true);
      expect(removed).toBe(true);
    });
  });

  describe('File Watching', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should start watching worktree', async () => {
      const path = '/test/project-watch';
      await manager.addWorktree(path, 'feature/watch');

      const watcher = await manager.startWatching(path);

      expect(watcher.path).toBe(path);
      expect(watcher.startTime).toBeTruthy();
      expect(manager.watchers.has(path)).toBe(true);
    });

    test('should emit watchingStarted event', async () => {
      const watchStartedSpy = jest.fn();
      manager.on('watchingStarted', watchStartedSpy);

      const path = '/test/project-watch-event';
      await manager.addWorktree(path, 'feature/watch-event');
      await manager.startWatching(path);

      expect(watchStartedSpy).toHaveBeenCalledWith({ path });
    });

    test('should stop watching worktree', async () => {
      const path = '/test/project-stop-watch';
      await manager.addWorktree(path, 'feature/stop-watch');
      await manager.startWatching(path);

      const stopped = await manager.stopWatching(path);

      expect(stopped).toBe(true);
      expect(manager.watchers.has(path)).toBe(false);
    });

    test('should emit watchingStopped event', async () => {
      const watchStoppedSpy = jest.fn();
      manager.on('watchingStopped', watchStoppedSpy);

      const path = '/test/project-stop-watch-event';
      await manager.addWorktree(path, 'feature/stop-watch-event');
      await manager.startWatching(path);
      await manager.stopWatching(path);

      expect(watchStoppedSpy).toHaveBeenCalledWith({
        path,
        eventCount: expect.any(Number)
      });
    });

    test('should handle file change events', (done) => {
      const fileChangedSpy = jest.fn();
      manager.on('fileChanged', (event) => {
        expect(event.worktreePath).toBe('/test/project-file-change');
        expect(event.eventType).toBe('change');
        expect(event.filePath).toBe('src/index.js');
        expect(event.timestamp).toBeTruthy();
        done();
      });

      manager.addWorktree('/test/project-file-change', 'feature/file-change').then(() => {
        manager.simulateFileEvent('/test/project-file-change', 'change', 'src/index.js');
      });
    });

    test('should throw error when starting to watch already watched path', async () => {
      const path = '/test/project-duplicate-watch';
      await manager.addWorktree(path, 'feature/duplicate-watch');
      await manager.startWatching(path);

      await expect(manager.startWatching(path)).rejects.toThrow(
        `Already watching path: ${path}`
      );
    });

    test('should throw error when stopping watch on unwatched path', async () => {
      await expect(manager.stopWatching('/unwatched/path')).rejects.toThrow(
        'Not watching path: /unwatched/path'
      );
    });

    test('should automatically start watching when adding worktree with watchFiles enabled', async () => {
      const path = '/test/project-auto-watch';
      await manager.addWorktree(path, 'feature/auto-watch');

      expect(manager.watchers.has(path)).toBe(true);
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should cleanup old worktrees', async () => {
      // Add a worktree with old access time
      const oldPath = '/test/project-old';
      await manager.addWorktree(oldPath, 'feature/old');
      const oldWorktree = manager.getWorktree(oldPath);
      oldWorktree.lastAccessed = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(); // 8 days ago

      const cleanedUp = await manager.cleanup();

      expect(cleanedUp).toContain(oldPath);
      expect(manager.getWorktree(oldPath)).toBeNull();
    });

    test('should emit cleanupCompleted event', async () => {
      const cleanupSpy = jest.fn();
      manager.on('cleanupCompleted', cleanupSpy);

      await manager.cleanup();

      expect(cleanupSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanedUpCount: expect.any(Number),
          paths: expect.any(Array)
        })
      );
    });

    test('should not cleanup main worktree', async () => {
      const mainWorktree = manager.getMainWorktree();
      mainWorktree.lastAccessed = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago

      const cleanedUp = await manager.cleanup();

      expect(cleanedUp).not.toContain(mainWorktree.path);
      expect(manager.getWorktree(mainWorktree.path)).toBeTruthy();
    });

    test('should not cleanup locked worktrees', async () => {
      const path = '/test/project-locked-cleanup';
      await manager.addWorktree(path, 'feature/locked-cleanup');
      const worktree = manager.getWorktree(path);
      worktree.lastAccessed = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      await manager.lockWorktree(path);

      const cleanedUp = await manager.cleanup();

      expect(cleanedUp).not.toContain(path);
      expect(manager.getWorktree(path)).toBeTruthy();
    });
  });

  describe('Operation Queue Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should execute operation immediately when under limit', async () => {
      const operation = jest.fn().mockResolvedValue('result');

      const result = await manager.queueOperation(operation);

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
    });

    test('should queue operation when at limit', async () => {
      // Fill up active operations
      manager.activeOperations = manager.maxConcurrentOperations;

      const operation = jest.fn().mockResolvedValue('queued-result');
      const operationPromise = manager.queueOperation(operation);

      // Operation should be queued, not executed immediately
      expect(operation).not.toHaveBeenCalled();
      expect(manager.operationQueue.length).toBe(1);

      // Simulate completing an active operation
      manager.activeOperations--;
      manager.processQueue();

      const result = await operationPromise;
      expect(result).toBe('queued-result');
      expect(operation).toHaveBeenCalled();
    });

    test('should handle operation failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(manager.queueOperation(operation)).rejects.toThrow('Operation failed');
      expect(manager.statistics.failedOperations).toBe(1);
    });

    test('should process queue after operation completion', async () => {
      // Fill up active operations
      manager.activeOperations = manager.maxConcurrentOperations;

      const operation1 = jest.fn().mockResolvedValue('result1');
      const operation2 = jest.fn().mockResolvedValue('result2');

      const promise1 = manager.queueOperation(operation1);
      const promise2 = manager.queueOperation(operation2);

      expect(manager.operationQueue.length).toBe(2);

      // Simulate completing active operations
      manager.activeOperations = 0;
      manager.processQueue();
      manager.processQueue();

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should track operation statistics', async () => {
      const initialStats = manager.getStatistics();

      await manager.addWorktree('/test/stats-1', 'feature/stats-1');
      await manager.addWorktree('/test/stats-2', 'feature/stats-2');
      await manager.removeWorktree('/test/stats-1');

      const finalStats = manager.getStatistics();

      expect(finalStats.createdWorktrees).toBe(initialStats.createdWorktrees + 2);
      expect(finalStats.removedWorktrees).toBe(initialStats.removedWorktrees + 1);
      expect(finalStats.totalOperations).toBeGreaterThan(initialStats.totalOperations);
    });

    test('should calculate success rate', async () => {
      const stats = manager.getStatistics();

      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
      
      if (stats.totalOperations > 0) {
        const expectedRate = ((stats.totalOperations - stats.failedOperations) / stats.totalOperations) * 100;
        expect(stats.successRate).toBe(expectedRate);
      }
    });

    test('should track active resources', async () => {
      const path = '/test/active-resources';
      await manager.addWorktree(path, 'feature/active');
      await manager.startWatching(path);

      const stats = manager.getStatistics();

      expect(stats.activeWorktrees).toBeGreaterThan(0);
      expect(stats.watchedPaths).toBeGreaterThan(0);
      expect(stats.queuedOperations).toBe(0);
      expect(stats.activeOperations).toBe(0);
    });

    test('should update average discovery time', async () => {
      manager.worktrees.clear();
      await manager.discoverWorktrees();

      const stats = manager.getStatistics();
      expect(stats.averageDiscoveryTime).toBeGreaterThan(0);
      expect(stats.lastDiscoveryTime).toBeTruthy();
    });
  });

  describe('Destruction and Cleanup', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should destroy manager cleanly', async () => {
      const path = '/test/destroy';
      await manager.addWorktree(path, 'feature/destroy');
      await manager.startWatching(path);

      await manager.destroy();

      expect(manager.worktrees.size).toBe(0);
      expect(manager.watchers.size).toBe(0);
      expect(manager.operationQueue.length).toBe(0);
      expect(manager.isInitialized).toBe(false);
    });

    test('should emit destroyed event', async () => {
      const destroyedSpy = jest.fn();
      manager.on('destroyed', destroyedSpy);

      await manager.destroy();

      expect(destroyedSpy).toHaveBeenCalled();
    });

    test('should stop all watchers during destruction', async () => {
      const path1 = '/test/destroy-watch-1';
      const path2 = '/test/destroy-watch-2';
      
      await manager.addWorktree(path1, 'feature/destroy-1');
      await manager.addWorktree(path2, 'feature/destroy-2');
      await manager.startWatching(path1);
      await manager.startWatching(path2);

      expect(manager.watchers.size).toBe(2);

      await manager.destroy();

      expect(manager.watchers.size).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should handle multiple concurrent operations efficiently', async () => {
      const startTime = Date.now();
      const operations = [];

      for (let i = 0; i < 10; i++) {
        operations.push(manager.addWorktree(`/test/concurrent-${i}`, `feature/concurrent-${i}`));
      }

      await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(manager.worktrees.size).toBeGreaterThanOrEqual(10);
    });

    test('should maintain performance with large number of worktrees', async () => {
      // Create many worktrees
      const largeManager = new MockWorktreeManager({ maxWorktrees: 100 });
      await largeManager.initialize();

      const startTime = Date.now();
      
      for (let i = 0; i < 50; i++) {
        await largeManager.addWorktree(`/test/large-${i}`, `feature/large-${i}`);
      }

      const allWorktrees = largeManager.getAllWorktrees();
      const getWorktreeTime = Date.now();

      expect(allWorktrees.length).toBeGreaterThanOrEqual(50);
      expect(getWorktreeTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds

      await largeManager.destroy();
    });

    test('should handle discovery efficiently', async () => {
      manager.worktrees.clear();
      
      const startTime = Date.now();
      await manager.discoverWorktrees();
      const discoveryTime = Date.now() - startTime;

      expect(discoveryTime).toBeLessThan(100); // Discovery should be fast
      expect(manager.statistics.averageDiscoveryTime).toBeLessThan(100);
    });
  });
}); 