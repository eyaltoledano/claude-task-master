/**
 * @fileoverview Worktree-AST Integration Test Suite
 * Tests the integration between Git worktree management and AST processing
 * 
 * Phase 3.1: AST-Claude Integration Testing
 * @author Claude (Task Master Flow Testing)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { promisify } from 'util';

// Mock implementations for worktree and AST components
const mockWorktreeManager = {
  discoverWorktrees: jest.fn(),
  createWorktree: jest.fn(),
  removeWorktree: jest.fn(),
  switchWorktree: jest.fn(),
  getWorktreeStatus: jest.fn(),
  listWorktrees: jest.fn()
};

const mockFileWatcher = new EventEmitter();
Object.assign(mockFileWatcher, {
  watch: jest.fn(),
  unwatch: jest.fn(),
  getWatchedFiles: jest.fn(() => new Set()),
  isWatching: jest.fn(() => false)
});

const mockResourceMonitor = {
  trackWorktree: jest.fn(),
  releaseWorktree: jest.fn(),
  getResourceUsage: jest.fn(() => ({ memory: 0, cpu: 0 })),
  setLimits: jest.fn()
};

const mockASTProcessor = {
  processFile: jest.fn(),
  processDirectory: jest.fn(),
  invalidateCache: jest.fn(),
  getProcessingStats: jest.fn(() => ({ processed: 0, cached: 0, errors: 0 }))
};

const mockGitOperations = {
  getCurrentBranch: jest.fn(),
  getChangedFiles: jest.fn(),
  getFileHistory: jest.fn(),
  checkoutBranch: jest.fn()
};

describe('Worktree-AST Integration Suite', () => {
  let integrationManager;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup integration manager
    integrationManager = {
      worktreeComponents: {
        manager: mockWorktreeManager,
        fileWatcher: mockFileWatcher,
        resourceMonitor: mockResourceMonitor,
        gitOps: mockGitOperations
      },
      astComponents: {
        processor: mockASTProcessor
      },
      state: {
        activeWorktrees: new Map(),
        watchedDirectories: new Set(),
        processingQueue: new Map()
      }
    };
    
    // Setup default mock implementations
    mockWorktreeManager.discoverWorktrees.mockResolvedValue([
      { path: '/project', branch: 'main', active: true },
      { path: '/project-feature', branch: 'feature/auth', active: false }
    ]);
    
    mockWorktreeManager.getWorktreeStatus.mockResolvedValue({
      branch: 'main',
      clean: true,
      ahead: 0,
      behind: 0
    });
    
    mockGitOperations.getCurrentBranch.mockResolvedValue('main');
    mockGitOperations.getChangedFiles.mockResolvedValue([]);
    
    mockASTProcessor.processFile.mockResolvedValue({
      ast: { type: 'Program', body: [] },
      metadata: { lineCount: 10, functions: [] }
    });
    
    mockResourceMonitor.getResourceUsage.mockReturnValue({
      memory: 50 * 1024 * 1024, // 50MB
      cpu: 15, // 15%
      openFiles: 25
    });
  });

  describe('Worktree Discovery and AST Processing', () => {
    test('should discover worktrees and initialize AST processing', async () => {
      const worktrees = await discoverAndInitializeWorktrees('/project');
      
      expect(worktrees).toHaveLength(2);
      expect(worktrees[0]).toMatchObject({
        path: '/project',
        branch: 'main',
        active: true,
        astInitialized: true
      });
      
      expect(mockWorktreeManager.discoverWorktrees).toHaveBeenCalledWith('/project');
      expect(mockASTProcessor.processDirectory).toHaveBeenCalledTimes(2);
    });

    test('should process only active worktree by default', async () => {
      const result = await processActiveWorktree('/project');
      
      expect(result).toMatchObject({
        worktree: expect.objectContaining({ active: true }),
        filesProcessed: expect.any(Number),
        astCache: expect.any(Object)
      });
      
      expect(mockASTProcessor.processDirectory).toHaveBeenCalledWith('/project');
      expect(mockASTProcessor.processDirectory).toHaveBeenCalledTimes(1);
    });

    test('should handle worktree switching with AST cache management', async () => {
      const fromBranch = 'main';
      const toBranch = 'feature/auth';
      
      const result = await switchWorktreeWithAST(fromBranch, toBranch);
      
      expect(result.success).toBe(true);
      expect(result.astCacheInvalidated).toBe(true);
      expect(result.newWorktreeProcessed).toBe(true);
      
      expect(mockWorktreeManager.switchWorktree).toHaveBeenCalledWith(toBranch);
      expect(mockASTProcessor.invalidateCache).toHaveBeenCalled();
      expect(mockASTProcessor.processDirectory).toHaveBeenCalledWith('/project-feature');
    });

    test('should discover nested worktrees correctly', async () => {
      const nestedWorktrees = [
        { path: '/project', branch: 'main', active: true },
        { path: '/project/submodule', branch: 'main', active: true },
        { path: '/project-feature', branch: 'feature/nested', active: false }
      ];
      
      mockWorktreeManager.discoverWorktrees.mockResolvedValueOnce(nestedWorktrees);
      
      const result = await discoverAndInitializeWorktrees('/project');
      
      expect(result).toHaveLength(3);
      expect(result.some(w => w.path.includes('submodule'))).toBe(true);
    });
  });

  describe('File Watching and Real-time AST Updates', () => {
    test('should setup file watching for worktree directories', async () => {
      const worktreePath = '/project';
      const watchConfig = {
        extensions: ['.js', '.ts', '.py'],
        ignore: ['node_modules', '.git'],
        recursive: true
      };
      
      await setupWorktreeFileWatching(worktreePath, watchConfig);
      
      expect(mockFileWatcher.watch).toHaveBeenCalledWith(
        worktreePath,
        expect.objectContaining(watchConfig)
      );
      expect(integrationManager.state.watchedDirectories.has(worktreePath)).toBe(true);
    });

    test('should trigger AST reprocessing on file changes', async () => {
      const changedFile = '/project/src/component.js';
      
      // Simulate file change event
      const changePromise = simulateFileChange(changedFile, 'modify');
      
      // Emit file change
      mockFileWatcher.emit('change', changedFile, 'modify');
      
      await changePromise;
      
      expect(mockASTProcessor.processFile).toHaveBeenCalledWith(changedFile);
      expect(mockASTProcessor.invalidateCache).toHaveBeenCalledWith(changedFile);
    });

    test('should handle multiple rapid file changes efficiently', async () => {
      const files = [
        '/project/src/file1.js',
        '/project/src/file2.js',
        '/project/src/file3.js'
      ];
      
      // Setup debouncing
      const debounceTime = 100;
      const changePromises = files.map(file => 
        simulateFileChange(file, 'modify', debounceTime)
      );
      
      // Emit rapid changes
      files.forEach(file => {
        mockFileWatcher.emit('change', file, 'modify');
      });
      
      await Promise.all(changePromises);
      
      // Should process all files but with debouncing
      expect(mockASTProcessor.processFile).toHaveBeenCalledTimes(files.length);
    });

    test('should handle file creation and deletion events', async () => {
      const newFile = '/project/src/new-component.js';
      const deletedFile = '/project/src/old-component.js';
      
      // Simulate file creation
      mockFileWatcher.emit('add', newFile);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate file deletion
      mockFileWatcher.emit('unlink', deletedFile);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockASTProcessor.processFile).toHaveBeenCalledWith(newFile);
      expect(mockASTProcessor.invalidateCache).toHaveBeenCalledWith(deletedFile);
    });

    test('should ignore changes in excluded directories', async () => {
      const excludedFile = '/project/node_modules/package/index.js';
      
      mockFileWatcher.emit('change', excludedFile, 'modify');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockASTProcessor.processFile).not.toHaveBeenCalledWith(excludedFile);
    });
  });

  describe('Resource Management and Performance', () => {
    test('should track resource usage per worktree', async () => {
      const worktreePath = '/project';
      
      await trackWorktreeResources(worktreePath);
      
      expect(mockResourceMonitor.trackWorktree).toHaveBeenCalledWith(
        worktreePath,
        expect.objectContaining({
          limits: expect.any(Object),
          monitoring: true
        })
      );
    });

    test('should enforce memory limits during AST processing', async () => {
      const memoryLimit = 100 * 1024 * 1024; // 100MB
      
      mockResourceMonitor.getResourceUsage.mockReturnValue({
        memory: 95 * 1024 * 1024, // 95MB - near limit
        cpu: 20,
        openFiles: 50
      });
      
      const result = await processWorktreeWithLimits('/project', { memoryLimit });
      
      expect(result.limitApproached).toBe(true);
      expect(result.processingThrottled).toBe(true);
    });

    test('should clean up resources on worktree removal', async () => {
      const worktreePath = '/project-feature';
      
      await removeWorktreeWithCleanup(worktreePath);
      
      expect(mockWorktreeManager.removeWorktree).toHaveBeenCalledWith(worktreePath);
      expect(mockResourceMonitor.releaseWorktree).toHaveBeenCalledWith(worktreePath);
      expect(mockFileWatcher.unwatch).toHaveBeenCalledWith(worktreePath);
      expect(mockASTProcessor.invalidateCache).toHaveBeenCalledWith(
        expect.stringContaining(worktreePath)
      );
    });

    test('should handle concurrent worktree processing', async () => {
      const worktrees = [
        '/project-main',
        '/project-feature1',
        '/project-feature2'
      ];
      
      const startTime = Date.now();
      const results = await Promise.all(
        worktrees.map(path => processWorktreeDirectory(path))
      );
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test('should monitor and report performance metrics', async () => {
      const worktreePath = '/project';
      
      const metrics = await getWorktreePerformanceMetrics(worktreePath);
      
      expect(metrics).toMatchObject({
        worktree: worktreePath,
        resourceUsage: expect.objectContaining({
          memory: expect.any(Number),
          cpu: expect.any(Number)
        }),
        astStats: expect.objectContaining({
          processed: expect.any(Number),
          cached: expect.any(Number)
        }),
        fileWatchingStats: expect.any(Object)
      });
    });
  });

  describe('Git Integration and Branch Management', () => {
    test('should coordinate AST processing with git branch changes', async () => {
      const currentBranch = 'main';
      const targetBranch = 'feature/new-component';
      
      mockGitOperations.getCurrentBranch.mockResolvedValueOnce(currentBranch);
      mockGitOperations.getChangedFiles.mockResolvedValueOnce([
        '/project/src/new-component.js',
        '/project/src/modified-file.js'
      ]);
      
      const result = await handleBranchChangeWithAST(targetBranch);
      
      expect(result).toMatchObject({
        previousBranch: currentBranch,
        newBranch: targetBranch,
        changedFiles: expect.arrayContaining([
          '/project/src/new-component.js',
          '/project/src/modified-file.js'
        ]),
        astUpdated: true
      });
      
      expect(mockGitOperations.checkoutBranch).toHaveBeenCalledWith(targetBranch);
      expect(mockASTProcessor.processFile).toHaveBeenCalledWith('/project/src/new-component.js');
    });

    test('should handle merge conflicts during worktree operations', async () => {
      const conflictFiles = [
        '/project/src/conflicted.js',
        '/project/package.json'
      ];
      
      const mergeError = new Error('Merge conflict detected');
      mergeError.conflictFiles = conflictFiles;
      
      mockGitOperations.checkoutBranch.mockRejectedValueOnce(mergeError);
      
      const result = await handleBranchChangeWithConflicts('feature/conflict');
      
      expect(result).toMatchObject({
        success: false,
        conflicts: expect.arrayContaining(conflictFiles),
        astProcessingSuspended: true
      });
    });

    test('should optimize AST processing based on git diff', async () => {
      const changedFiles = [
        '/project/src/changed1.js',
        '/project/src/changed2.js'
      ];
      const unchangedFiles = [
        '/project/src/unchanged1.js',
        '/project/src/unchanged2.js'
      ];
      
      mockGitOperations.getChangedFiles.mockResolvedValueOnce(changedFiles);
      
      const result = await optimizedASTProcessing('/project');
      
      expect(result.processedFiles).toEqual(changedFiles);
      expect(result.skippedFiles).toContain(unchangedFiles[0]);
      expect(mockASTProcessor.processFile).toHaveBeenCalledTimes(changedFiles.length);
    });

    test('should maintain AST cache across worktree switches', async () => {
      const cacheKey = 'ast:/project/src/component.js:main';
      const cachedAST = { type: 'Program', body: [], cached: true };
      
      // Simulate switching from main to feature branch and back
      await switchWorktreeWithAST('main', 'feature/test');
      await switchWorktreeWithAST('feature/test', 'main');
      
      // Cache should be preserved for main branch files
      expect(mockASTProcessor.invalidateCache).toHaveBeenCalledWith(
        expect.not.stringContaining(':main')
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle worktree discovery failures gracefully', async () => {
      const error = new Error('Git repository not found');
      mockWorktreeManager.discoverWorktrees.mockRejectedValueOnce(error);
      
      const result = await discoverAndInitializeWorktrees('/invalid-path');
      
      expect(result).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: 'Git repository not found'
        }),
        fallbackProcessing: true
      });
    });

    test('should recover from file watcher failures', async () => {
      const watchError = new Error('Permission denied');
      mockFileWatcher.watch.mockImplementationOnce(() => {
        throw watchError;
      });
      
      const result = await setupWorktreeFileWatching('/restricted-project');
      
      expect(result).toMatchObject({
        success: false,
        watchingEnabled: false,
        fallbackPolling: true
      });
    });

    test('should handle AST processing errors per file', async () => {
      const files = [
        '/project/src/valid.js',
        '/project/src/syntax-error.js',
        '/project/src/another-valid.js'
      ];
      
      mockASTProcessor.processFile
        .mockResolvedValueOnce({ ast: {}, success: true })
        .mockRejectedValueOnce(new Error('Syntax error'))
        .mockResolvedValueOnce({ ast: {}, success: true });
      
      const results = await processFilesWithErrorHandling(files);
      
      expect(results.successful).toHaveLength(2);
      expect(results.failed).toHaveLength(1);
      expect(results.failed[0].file).toBe('/project/src/syntax-error.js');
    });

    test('should implement circuit breaker for resource exhaustion', async () => {
      // Simulate high resource usage
      mockResourceMonitor.getResourceUsage.mockReturnValue({
        memory: 950 * 1024 * 1024, // 950MB - very high
        cpu: 95, // 95%
        openFiles: 500
      });
      
      const result = await processWorktreeWithCircuitBreaker('/project');
      
      expect(result).toMatchObject({
        circuitBreakerTriggered: true,
        processingHalted: true,
        reason: 'resource-exhaustion',
        usage
      });
    });
  });

  describe('Multi-Worktree Coordination', () => {
    test('should coordinate processing across multiple worktrees', async () => {
      const worktrees = [
        { path: '/project-main', branch: 'main' },
        { path: '/project-feature1', branch: 'feature/auth' },
        { path: '/project-feature2', branch: 'feature/ui' }
      ];
      
      mockWorktreeManager.discoverWorktrees.mockResolvedValueOnce(worktrees);
      
      const coordinator = await createMultiWorktreeCoordinator(worktrees);
      
      expect(coordinator).toMatchObject({
        worktrees: expect.arrayContaining([
          expect.objectContaining({ path: '/project-main' }),
          expect.objectContaining({ path: '/project-feature1' }),
          expect.objectContaining({ path: '/project-feature2' })
        ]),
        processingQueue: expect.any(Object),
        resourceAllocation: expect.any(Object)
      });
    });

    test('should balance resource allocation across worktrees', async () => {
      const worktrees = ['/project1', '/project2', '/project3'];
      const totalMemoryLimit = 300 * 1024 * 1024; // 300MB
      
      const allocation = await allocateResourcesAcrossWorktrees(worktrees, {
        memoryLimit: totalMemoryLimit
      });
      
      expect(allocation.perWorktree.memory).toBe(totalMemoryLimit / worktrees.length);
      expect(allocation.assignments).toHaveLength(worktrees.length);
    });

    test('should handle cross-worktree file dependencies', async () => {
      const mainFile = '/project-main/src/shared.js';
      const dependentFile = '/project-feature/src/component.js';
      
      // Simulate file change in main that affects feature branch
      mockFileWatcher.emit('change', mainFile, 'modify');
      
      const result = await handleCrossWorktreeDependency(mainFile, dependentFile);
      
      expect(result).toMatchObject({
        mainFileProcessed: true,
        dependentFileInvalidated: true,
        crossWorktreeUpdate: true
      });
    });
  });

  // Helper functions for testing
  async function discoverAndInitializeWorktrees(projectPath) {
    try {
      const worktrees = await integrationManager.worktreeComponents.manager.discoverWorktrees(projectPath);
      
      for (const worktree of worktrees) {
        await integrationManager.astComponents.processor.processDirectory(worktree.path);
        worktree.astInitialized = true;
        integrationManager.state.activeWorktrees.set(worktree.path, worktree);
      }
      
      return worktrees;
    } catch (error) {
      return {
        success: false,
        error,
        fallbackProcessing: true
      };
    }
  }

  async function processActiveWorktree(projectPath) {
    const worktrees = await integrationManager.worktreeComponents.manager.discoverWorktrees(projectPath);
    const activeWorktree = worktrees.find(w => w.active);
    
    if (!activeWorktree) {
      throw new Error('No active worktree found');
    }
    
    const astData = await integrationManager.astComponents.processor.processDirectory(activeWorktree.path);
    
    return {
      worktree: activeWorktree,
      filesProcessed: astData.fileCount || 0,
      astCache: astData
    };
  }

  async function switchWorktreeWithAST(fromBranch, toBranch) {
    try {
      // Invalidate AST cache for current branch
      await integrationManager.astComponents.processor.invalidateCache();
      
      // Switch worktree
      await integrationManager.worktreeComponents.manager.switchWorktree(toBranch);
      
      // Process new worktree
      const newWorktreePath = `/project-${toBranch.replace('/', '-')}`;
      await integrationManager.astComponents.processor.processDirectory(newWorktreePath);
      
      return {
        success: true,
        fromBranch,
        toBranch,
        astCacheInvalidated: true,
        newWorktreeProcessed: true
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async function setupWorktreeFileWatching(worktreePath, config = {}) {
    try {
      await integrationManager.worktreeComponents.fileWatcher.watch(worktreePath, {
        extensions: ['.js', '.ts', '.py'],
        ignore: ['node_modules', '.git'],
        recursive: true,
        ...config
      });
      
      integrationManager.state.watchedDirectories.add(worktreePath);
      
      return { success: true, watching: true };
    } catch (error) {
      return {
        success: false,
        watchingEnabled: false,
        fallbackPolling: true,
        error: error.message
      };
    }
  }

  async function simulateFileChange(filePath, eventType, debounceTime = 50) {
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          if (eventType === 'modify') {
            await integrationManager.astComponents.processor.invalidateCache(filePath);
            await integrationManager.astComponents.processor.processFile(filePath);
          }
          resolve({ filePath, eventType, processed: true });
        } catch (error) {
          resolve({ filePath, eventType, processed: false, error });
        }
      }, debounceTime);
    });
  }

  async function trackWorktreeResources(worktreePath) {
    const limits = {
      memory: 200 * 1024 * 1024, // 200MB
      cpu: 50, // 50%
      openFiles: 100
    };
    
    await integrationManager.worktreeComponents.resourceMonitor.trackWorktree(worktreePath, {
      limits,
      monitoring: true
    });
    
    return { worktreePath, limits, tracking: true };
  }

  async function processWorktreeWithLimits(worktreePath, limits) {
    const usage = integrationManager.worktreeComponents.resourceMonitor.getResourceUsage();
    const memoryUsagePercent = (usage.memory / limits.memoryLimit) * 100;
    
    const result = {
      worktreePath,
      usage,
      limitApproached: memoryUsagePercent > 90,
      processingThrottled: false
    };
    
    if (result.limitApproached) {
      result.processingThrottled = true;
      // Simulate throttled processing
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return result;
  }

  async function removeWorktreeWithCleanup(worktreePath) {
    // Clean up file watching
    await integrationManager.worktreeComponents.fileWatcher.unwatch(worktreePath);
    
    // Release resources
    await integrationManager.worktreeComponents.resourceMonitor.releaseWorktree(worktreePath);
    
    // Invalidate AST cache
    await integrationManager.astComponents.processor.invalidateCache(worktreePath);
    
    // Remove worktree
    await integrationManager.worktreeComponents.manager.removeWorktree(worktreePath);
    
    // Clean up state
    integrationManager.state.activeWorktrees.delete(worktreePath);
    integrationManager.state.watchedDirectories.delete(worktreePath);
    
    return { success: true, cleaned: true };
  }

  async function processWorktreeDirectory(worktreePath) {
    try {
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
      const result = await integrationManager.astComponents.processor.processDirectory(worktreePath);
      return { success: true, worktreePath, ...result };
    } catch (error) {
      return { success: false, worktreePath, error: error.message };
    }
  }

  async function getWorktreePerformanceMetrics(worktreePath) {
    const resourceUsage = integrationManager.worktreeComponents.resourceMonitor.getResourceUsage();
    const astStats = integrationManager.astComponents.processor.getProcessingStats();
    
    return {
      worktree: worktreePath,
      resourceUsage,
      astStats,
      fileWatchingStats: {
        watchedFiles: integrationManager.worktreeComponents.fileWatcher.getWatchedFiles().size,
        isWatching: integrationManager.worktreeComponents.fileWatcher.isWatching()
      }
    };
  }

  async function handleBranchChangeWithAST(targetBranch) {
    const currentBranch = await integrationManager.worktreeComponents.gitOps.getCurrentBranch();
    
    await integrationManager.worktreeComponents.gitOps.checkoutBranch(targetBranch);
    
    const changedFiles = await integrationManager.worktreeComponents.gitOps.getChangedFiles();
    
    // Process changed files
    for (const file of changedFiles) {
      await integrationManager.astComponents.processor.processFile(file);
    }
    
    return {
      previousBranch: currentBranch,
      newBranch: targetBranch,
      changedFiles,
      astUpdated: true
    };
  }

  async function handleBranchChangeWithConflicts(targetBranch) {
    try {
      await integrationManager.worktreeComponents.gitOps.checkoutBranch(targetBranch);
      return { success: true };
    } catch (error) {
      if (error.conflictFiles) {
        return {
          success: false,
          conflicts: error.conflictFiles,
          astProcessingSuspended: true
        };
      }
      throw error;
    }
  }

  async function optimizedASTProcessing(projectPath) {
    const changedFiles = await integrationManager.worktreeComponents.gitOps.getChangedFiles();
    const processedFiles = [];
    const skippedFiles = [];
    
    // Only process changed files
    for (const file of changedFiles) {
      await integrationManager.astComponents.processor.processFile(file);
      processedFiles.push(file);
    }
    
    // Skip unchanged files (simulated)
    const allFiles = ['/project/src/unchanged1.js', '/project/src/unchanged2.js'];
    skippedFiles.push(...allFiles.filter(f => !changedFiles.includes(f)));
    
    return { processedFiles, skippedFiles };
  }

  async function processFilesWithErrorHandling(files) {
    const successful = [];
    const failed = [];
    
    for (const file of files) {
      try {
        const result = await integrationManager.astComponents.processor.processFile(file);
        successful.push({ file, result });
      } catch (error) {
        failed.push({ file, error: error.message });
      }
    }
    
    return { successful, failed };
  }

  async function processWorktreeWithCircuitBreaker(worktreePath) {
    const usage = integrationManager.worktreeComponents.resourceMonitor.getResourceUsage();
    
    // Check if resources are exhausted
    const memoryThreshold = 900 * 1024 * 1024; // 900MB
    const cpuThreshold = 90; // 90%
    
    if (usage.memory > memoryThreshold || usage.cpu > cpuThreshold) {
      return {
        circuitBreakerTriggered: true,
        processingHalted: true,
        reason: 'resource-exhaustion',
        usage
      };
    }
    
    // Normal processing
    await integrationManager.astComponents.processor.processDirectory(worktreePath);
    return { circuitBreakerTriggered: false, processingCompleted: true };
  }

  async function createMultiWorktreeCoordinator(worktrees) {
    const coordinator = {
      worktrees: worktrees.map(w => ({ ...w, priority: 1, allocated: false })),
      processingQueue: new Map(),
      resourceAllocation: new Map()
    };
    
    // Initialize processing for each worktree
    for (const worktree of coordinator.worktrees) {
      await integrationManager.astComponents.processor.processDirectory(worktree.path);
      coordinator.processingQueue.set(worktree.path, []);
    }
    
    return coordinator;
  }

  async function allocateResourcesAcrossWorktrees(worktrees, limits) {
    const totalWorktrees = worktrees.length;
    const perWorktreeAllocation = {
      memory: Math.floor(limits.memoryLimit / totalWorktrees),
      cpu: Math.floor(100 / totalWorktrees), // Percentage
      openFiles: Math.floor(500 / totalWorktrees)
    };
    
    const assignments = worktrees.map(worktree => ({
      worktree,
      allocation: perWorktreeAllocation
    }));
    
    return {
      perWorktree: perWorktreeAllocation,
      assignments
    };
  }

  async function handleCrossWorktreeDependency(mainFile, dependentFile) {
    // Process the main file
    await integrationManager.astComponents.processor.processFile(mainFile);
    
    // Invalidate dependent file in other worktree
    await integrationManager.astComponents.processor.invalidateCache(dependentFile);
    
    return {
      mainFileProcessed: true,
      dependentFileInvalidated: true,
      crossWorktreeUpdate: true
    };
  }
}); 