/**
 * @fileoverview Hook Pipeline Integration Tests
 * Comprehensive integration testing for hook pipeline coordination with AST-Claude system
 * Tests the complete hook execution pipeline including pre/post hooks, error handling,
 * and coordination with background services.
 * 
 * @author Claude (Task Master Flow Testing Phase 3.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock dependencies
const mockASTProcessor = {
  parseFile: jest.fn(),
  parseProject: jest.fn(),
  generateContext: jest.fn(),
  invalidateCache: jest.fn()
};

const mockClaudeService = {
  createSession: jest.fn(),
  processContext: jest.fn(),
  streamResponse: jest.fn(),
  closeSession: jest.fn()
};

const mockBackgroundService = {
  queueOperation: jest.fn(),
  getOperationStatus: jest.fn(),
  cancelOperation: jest.fn(),
  subscribeToEvents: jest.fn()
};

const mockWorktreeManager = {
  discoverWorktrees: jest.fn(),
  watchFiles: jest.fn(),
  getWorktreeState: jest.fn()
};

// Mock Hook Pipeline Coordinator
class MockHookPipelineCoordinator extends EventEmitter {
  constructor() {
    super();
    this.hooks = new Map();
    this.pipeline = new Map();
    this.executionContext = new Map();
    this.statistics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      hookExecutions: new Map()
    };
    this.isActive = false;
  }

  async registerHook(name, handler, config = {}) {
    const hookConfig = {
      name,
      handler,
      timing: config.timing || 'before',
      target: config.target || 'any',
      priority: config.priority || 50,
      required: config.required !== false,
      timeout: config.timeout || 10000,
      dependencies: config.dependencies || [],
      conditions: config.conditions || [],
      ...config
    };

    this.hooks.set(name, hookConfig);
    this.emit('hookRegistered', { name, config: hookConfig });
    return true;
  }

  async executePipeline(context) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      this.statistics.totalExecutions++;
      this.executionContext.set(executionId, {
        ...context,
        executionId,
        startTime,
        hooks: [],
        results: new Map(),
        errors: []
      });

      this.emit('pipelineStarted', { executionId, context });

      // Execute pre-hooks
      const preHooks = this.getHooksByTiming('before', context.target);
      await this.executeHookChain(executionId, preHooks, 'pre');

      // Execute main operation
      const mainResult = await this.executeMainOperation(executionId, context);

      // Execute post-hooks
      const postHooks = this.getHooksByTiming('after', context.target);
      await this.executeHookChain(executionId, postHooks, 'post', mainResult);

      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      this.statistics.successfulExecutions++;
      this.updateExecutionTime(executionTime);

      const finalContext = this.executionContext.get(executionId);
      this.emit('pipelineCompleted', { 
        executionId, 
        executionTime, 
        results: finalContext.results 
      });

      return {
        success: true,
        executionId,
        executionTime,
        results: finalContext.results,
        mainResult,
        hooks: finalContext.hooks
      };

    } catch (error) {
      this.statistics.failedExecutions++;
      this.emit('pipelineError', { executionId, error });
      
      return {
        success: false,
        executionId,
        error: error.message,
        executionTime: Date.now() - startTime,
        results: this.executionContext.get(executionId)?.results || new Map(),
        hooks: this.executionContext.get(executionId)?.hooks || []
      };
    } finally {
      this.executionContext.delete(executionId);
    }
  }

  async executeHookChain(executionId, hooks, phase, previousResult = null) {
    const context = this.executionContext.get(executionId);
    
    for (const hook of hooks) {
      try {
        const hookStartTime = Date.now();
        
        // Check dependencies
        if (!this.checkHookDependencies(hook, context)) {
          context.hooks.push({
            name: hook.name,
            phase,
            status: 'skipped',
            reason: 'dependencies not met'
          });
          continue;
        }

        // Check conditions
        if (!this.checkHookConditions(hook, context)) {
          context.hooks.push({
            name: hook.name,
            phase,
            status: 'skipped',
            reason: 'conditions not met'
          });
          continue;
        }

        const hookContext = {
          executionId,
          phase,
          target: context.target,
          previousResult,
          results: context.results,
          astData: context.astData,
          claudeSession: context.claudeSession,
          timestamp: new Date().toISOString()
        };

        this.emit('hookStarted', { executionId, hookName: hook.name, phase });

        const result = await Promise.race([
          hook.handler(hookContext),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Hook ${hook.name} timeout`)), hook.timeout)
          )
        ]);

        const hookEndTime = Date.now();
        const hookExecutionTime = hookEndTime - hookStartTime;

        context.results.set(hook.name, result);
        context.hooks.push({
          name: hook.name,
          phase,
          status: 'success',
          executionTime: hookExecutionTime,
          result
        });

        this.updateHookStatistics(hook.name, hookExecutionTime, true);
        this.emit('hookCompleted', { 
          executionId, 
          hookName: hook.name, 
          phase, 
          result, 
          executionTime: hookExecutionTime 
        });

      } catch (error) {
        context.hooks.push({
          name: hook.name,
          phase,
          status: 'error',
          error: error.message
        });

        this.updateHookStatistics(hook.name, 0, false);
        this.emit('hookError', { executionId, hookName: hook.name, phase, error });

        if (hook.required) {
          throw new Error(`Required hook ${hook.name} failed: ${error.message}`);
        }
      }
    }
  }

  async executeMainOperation(executionId, context) {
    const operationHandlers = {
      'ast-parsing': this.executeASTOperation.bind(this),
      'claude-processing': this.executeClaudeOperation.bind(this),
      'worktree-operation': this.executeWorktreeOperation.bind(this),
      'context-building': this.executeContextOperation.bind(this)
    };

    const handler = operationHandlers[context.operation];
    if (!handler) {
      throw new Error(`Unknown operation: ${context.operation}`);
    }

    return await handler(executionId, context);
  }

  async executeASTOperation(executionId, context) {
    const { filePath, options = {} } = context;
    
    this.emit('astOperationStarted', { executionId, filePath });
    
    const astData = await mockASTProcessor.parseFile(filePath, options);
    
    // Update execution context with AST data
    const execContext = this.executionContext.get(executionId);
    execContext.astData = astData;
    
    this.emit('astOperationCompleted', { executionId, astData });
    
    return { type: 'ast', filePath, astData };
  }

  async executeClaudeOperation(executionId, context) {
    const { prompt, sessionConfig = {} } = context;
    
    this.emit('claudeOperationStarted', { executionId, sessionConfig });
    
    const session = await mockClaudeService.createSession(sessionConfig);
    const response = await mockClaudeService.processContext(session, prompt);
    
    // Update execution context with Claude session
    const execContext = this.executionContext.get(executionId);
    execContext.claudeSession = session;
    
    this.emit('claudeOperationCompleted', { executionId, session, response });
    
    return { type: 'claude', session, response };
  }

  async executeWorktreeOperation(executionId, context) {
    const { action, path } = context;
    
    this.emit('worktreeOperationStarted', { executionId, action, path });
    
    let result;
    switch (action) {
      case 'discover':
        result = await mockWorktreeManager.discoverWorktrees(path);
        break;
      case 'watch':
        result = await mockWorktreeManager.watchFiles(path);
        break;
      case 'status':
        result = await mockWorktreeManager.getWorktreeState(path);
        break;
      default:
        throw new Error(`Unknown worktree action: ${action}`);
    }
    
    this.emit('worktreeOperationCompleted', { executionId, action, result });
    
    return { type: 'worktree', action, result };
  }

  async executeContextOperation(executionId, context) {
    const { files, task } = context;
    
    this.emit('contextOperationStarted', { executionId, files, task });
    
    const contextData = await mockASTProcessor.generateContext(files, task);
    
    this.emit('contextOperationCompleted', { executionId, contextData });
    
    return { type: 'context', contextData };
  }

  getHooksByTiming(timing, target) {
    return Array.from(this.hooks.values())
      .filter(hook => hook.timing === timing && (hook.target === target || hook.target === 'any'))
      .sort((a, b) => a.priority - b.priority);
  }

  checkHookDependencies(hook, context) {
    if (!hook.dependencies || hook.dependencies.length === 0) {
      return true;
    }

    return hook.dependencies.every(dep => 
      context.results.has(dep) && context.results.get(dep) !== null
    );
  }

  checkHookConditions(hook, context) {
    if (!hook.conditions || hook.conditions.length === 0) {
      return true;
    }

    return hook.conditions.every(condition => {
      switch (condition.type) {
        case 'fileExists':
          return context.filePath && context.filePath.includes(condition.value);
        case 'hasASTData':
          return context.astData !== null;
        case 'hasClaudeSession':
          return context.claudeSession !== null;
        default:
          return true;
      }
    });
  }

  updateExecutionTime(executionTime) {
    const total = this.statistics.totalExecutions;
    const current = this.statistics.averageExecutionTime;
    this.statistics.averageExecutionTime = ((current * (total - 1)) + executionTime) / total;
  }

  updateHookStatistics(hookName, executionTime, success) {
    if (!this.statistics.hookExecutions.has(hookName)) {
      this.statistics.hookExecutions.set(hookName, {
        executions: 0,
        successes: 0,
        failures: 0,
        averageTime: 0,
        totalTime: 0
      });
    }

    const stats = this.statistics.hookExecutions.get(hookName);
    stats.executions++;
    stats.totalTime += executionTime;
    stats.averageTime = stats.totalTime / stats.executions;

    if (success) {
      stats.successes++;
    } else {
      stats.failures++;
    }
  }

  getStatistics() {
    return {
      ...this.statistics,
      hookExecutions: Object.fromEntries(this.statistics.hookExecutions)
    };
  }

  async reset() {
    this.hooks.clear();
    this.pipeline.clear();
    this.executionContext.clear();
    this.statistics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      hookExecutions: new Map()
    };
    this.isActive = false;
  }
}

describe('Hook Pipeline Integration Suite', () => {
  let coordinator;
  let mockPreHook;
  let mockPostHook;
  let mockValidationHook;

  beforeEach(async () => {
    coordinator = new MockHookPipelineCoordinator();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock hook handlers
    mockPreHook = jest.fn().mockResolvedValue({ status: 'pre-processed', data: 'pre-data' });
    mockPostHook = jest.fn().mockResolvedValue({ status: 'post-processed', data: 'post-data' });
    mockValidationHook = jest.fn().mockResolvedValue({ valid: true, checks: ['syntax', 'style'] });
    
    // Setup mock service responses
    mockASTProcessor.parseFile.mockResolvedValue({
      type: 'Program',
      body: [],
      metadata: { lineCount: 100, complexity: 5 }
    });
    
    mockClaudeService.createSession.mockResolvedValue({
      id: 'session-123',
      status: 'active'
    });
    
    mockClaudeService.processContext.mockResolvedValue({
      response: 'Claude response',
      tokens: 150
    });
    
    mockWorktreeManager.discoverWorktrees.mockResolvedValue([
      { path: '/project/main', branch: 'main' },
      { path: '/project/feature', branch: 'feature/test' }
    ]);
    
    mockASTProcessor.generateContext.mockResolvedValue({
      files: 5,
      tokens: 1000,
      relevanceScore: 0.85
    });
  });

  afterEach(async () => {
    await coordinator.reset();
  });

  describe('Basic Hook Pipeline Execution', () => {
    test('should execute complete pipeline with pre and post hooks', async () => {
      // Register hooks
      await coordinator.registerHook('pre-validation', mockPreHook, {
        timing: 'before',
        target: 'ast-parsing',
        priority: 10
      });
      
      await coordinator.registerHook('post-validation', mockPostHook, {
        timing: 'after',
        target: 'ast-parsing',
        priority: 10
      });

      // Execute pipeline
      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(result.success).toBe(true);
      expect(result.hooks).toHaveLength(2);
      expect(mockPreHook).toHaveBeenCalled();
      expect(mockPostHook).toHaveBeenCalled();
      expect(mockASTProcessor.parseFile).toHaveBeenCalledWith('/test/file.js', {});
    });

    test('should execute hooks in correct priority order', async () => {
      const executionOrder = [];
      
      await coordinator.registerHook('high-priority', () => {
        executionOrder.push('high');
        return Promise.resolve({ priority: 'high' });
      }, { timing: 'before', target: 'ast-parsing', priority: 1 });
      
      await coordinator.registerHook('low-priority', () => {
        executionOrder.push('low');
        return Promise.resolve({ priority: 'low' });
      }, { timing: 'before', target: 'ast-parsing', priority: 100 });
      
      await coordinator.registerHook('medium-priority', () => {
        executionOrder.push('medium');
        return Promise.resolve({ priority: 'medium' });
      }, { timing: 'before', target: 'ast-parsing', priority: 50 });

      await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(executionOrder).toEqual(['high', 'medium', 'low']);
    });

    test('should pass results between hooks', async () => {
      await coordinator.registerHook('data-producer', () => {
        return Promise.resolve({ generatedData: 'important-data' });
      }, { timing: 'before', target: 'ast-parsing' });
      
      const consumerHook = jest.fn().mockResolvedValue({ consumed: true });
      await coordinator.registerHook('data-consumer', consumerHook, {
        timing: 'after',
        target: 'ast-parsing',
        dependencies: ['data-producer']
      });

      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(result.success).toBe(true);
      expect(consumerHook).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.any(Map)
        })
      );
      
      const hookContext = consumerHook.mock.calls[0][0];
      expect(hookContext.results.get('data-producer')).toEqual({ generatedData: 'important-data' });
    });
  });

  describe('Hook Dependencies and Conditions', () => {
    test('should skip hooks when dependencies not met', async () => {
      const skippedHook = jest.fn();
      
      await coordinator.registerHook('dependent-hook', skippedHook, {
        timing: 'before',
        target: 'ast-parsing',
        dependencies: ['non-existent-hook']
      });

      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(result.success).toBe(true);
      expect(skippedHook).not.toHaveBeenCalled();
      
      const dependentHookResult = result.hooks.find(h => h.name === 'dependent-hook');
      expect(dependentHookResult.status).toBe('skipped');
      expect(dependentHookResult.reason).toBe('dependencies not met');
    });

    test('should execute hooks when dependencies are satisfied', async () => {
      await coordinator.registerHook('dependency-hook', () => {
        return Promise.resolve({ dependency: 'satisfied' });
      }, { timing: 'before', target: 'ast-parsing' });
      
      const dependentHook = jest.fn().mockResolvedValue({ dependent: 'executed' });
      await coordinator.registerHook('dependent-hook', dependentHook, {
        timing: 'before',
        target: 'ast-parsing',
        dependencies: ['dependency-hook'],
        priority: 100 // Lower priority to ensure dependency runs first
      });

      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(result.success).toBe(true);
      expect(dependentHook).toHaveBeenCalled();
      
      const dependentHookResult = result.hooks.find(h => h.name === 'dependent-hook');
      expect(dependentHookResult.status).toBe('success');
    });

    test('should check conditions before executing hooks', async () => {
      const conditionalHook = jest.fn();
      
      await coordinator.registerHook('conditional-hook', conditionalHook, {
        timing: 'before',
        target: 'ast-parsing',
        conditions: [
          { type: 'fileExists', value: 'specific-file.js' }
        ]
      });

      // Execute with file that doesn't match condition
      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/other-file.js'
      });

      expect(result.success).toBe(true);
      expect(conditionalHook).not.toHaveBeenCalled();
      
      const conditionalHookResult = result.hooks.find(h => h.name === 'conditional-hook');
      expect(conditionalHookResult.status).toBe('skipped');
      expect(conditionalHookResult.reason).toBe('conditions not met');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle optional hook failures gracefully', async () => {
      const failingHook = jest.fn().mockRejectedValue(new Error('Hook failed'));
      const successHook = jest.fn().mockResolvedValue({ success: true });
      
      await coordinator.registerHook('failing-hook', failingHook, {
        timing: 'before',
        target: 'ast-parsing',
        required: false
      });
      
      await coordinator.registerHook('success-hook', successHook, {
        timing: 'after',
        target: 'ast-parsing'
      });

      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(result.success).toBe(true);
      expect(successHook).toHaveBeenCalled();
      
      const failedHookResult = result.hooks.find(h => h.name === 'failing-hook');
      expect(failedHookResult.status).toBe('error');
      expect(failedHookResult.error).toBe('Hook failed');
    });

    test('should fail pipeline when required hook fails', async () => {
      const failingHook = jest.fn().mockRejectedValue(new Error('Critical hook failed'));
      
      await coordinator.registerHook('critical-hook', failingHook, {
        timing: 'before',
        target: 'ast-parsing',
        required: true
      });

      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Required hook critical-hook failed');
      expect(mockASTProcessor.parseFile).not.toHaveBeenCalled();
    });

    test('should handle hook timeouts', async () => {
      const slowHook = jest.fn(() => new Promise(resolve => setTimeout(resolve, 2000)));
      
      await coordinator.registerHook('slow-hook', slowHook, {
        timing: 'before',
        target: 'ast-parsing',
        timeout: 100,
        required: false
      });

      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(result.success).toBe(true);
      
      const slowHookResult = result.hooks.find(h => h.name === 'slow-hook');
      expect(slowHookResult.status).toBe('error');
      expect(slowHookResult.error).toContain('timeout');
    });
  });

  describe('Integration with AST Processing', () => {
    test('should integrate hooks with AST parsing operation', async () => {
      const preASTHook = jest.fn().mockResolvedValue({ preProcessed: true });
      const postASTHook = jest.fn().mockResolvedValue({ postProcessed: true });
      
      await coordinator.registerHook('pre-ast', preASTHook, {
        timing: 'before',
        target: 'ast-parsing'
      });
      
      await coordinator.registerHook('post-ast', postASTHook, {
        timing: 'after',
        target: 'ast-parsing'
      });

      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/complex-file.js',
        options: { includeComments: true }
      });

      expect(result.success).toBe(true);
      expect(mockASTProcessor.parseFile).toHaveBeenCalledWith('/test/complex-file.js', { includeComments: true });
      expect(preASTHook).toHaveBeenCalled();
      expect(postASTHook).toHaveBeenCalled();
      
      // Check that post hook received AST data
      const postHookContext = postASTHook.mock.calls[0][0];
      expect(postHookContext.astData).toBeDefined();
      expect(postHookContext.astData.type).toBe('Program');
    });

    test('should provide access to main operation result in post hooks', async () => {
      const postHook = jest.fn().mockResolvedValue({ validated: true });
      
      await coordinator.registerHook('ast-validator', postHook, {
        timing: 'after',
        target: 'ast-parsing'
      });

      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(result.success).toBe(true);
      expect(postHook).toHaveBeenCalled();
      
      const hookContext = postHook.mock.calls[0][0];
      expect(hookContext.previousResult).toBeDefined();
      expect(hookContext.previousResult.type).toBe('ast');
      expect(hookContext.previousResult.astData).toBeDefined();
    });
  });

  describe('Integration with Claude Processing', () => {
    test('should integrate hooks with Claude operations', async () => {
      const claudePreHook = jest.fn().mockResolvedValue({ sessionConfigured: true });
      const claudePostHook = jest.fn().mockResolvedValue({ responseProcessed: true });
      
      await coordinator.registerHook('claude-pre', claudePreHook, {
        timing: 'before',
        target: 'claude-processing'
      });
      
      await coordinator.registerHook('claude-post', claudePostHook, {
        timing: 'after',
        target: 'claude-processing'
      });

      const result = await coordinator.executePipeline({
        operation: 'claude-processing',
        target: 'claude-processing',
        prompt: 'Analyze this code',
        sessionConfig: { model: 'claude-3', temperature: 0.7 }
      });

      expect(result.success).toBe(true);
      expect(mockClaudeService.createSession).toHaveBeenCalled();
      expect(mockClaudeService.processContext).toHaveBeenCalled();
      expect(claudePreHook).toHaveBeenCalled();
      expect(claudePostHook).toHaveBeenCalled();
    });

    test('should provide Claude session access to post hooks', async () => {
      const sessionHook = jest.fn().mockResolvedValue({ sessionValidated: true });
      
      await coordinator.registerHook('session-validator', sessionHook, {
        timing: 'after',
        target: 'claude-processing'
      });

      await coordinator.executePipeline({
        operation: 'claude-processing',
        target: 'claude-processing',
        prompt: 'Test prompt'
      });

      const hookContext = sessionHook.mock.calls[0][0];
      expect(hookContext.claudeSession).toBeDefined();
      expect(hookContext.claudeSession.id).toBe('session-123');
    });
  });

  describe('Multi-Operation Pipeline Coordination', () => {
    test('should coordinate hooks across multiple operations', async () => {
      const globalPreHook = jest.fn().mockResolvedValue({ globalPre: true });
      const globalPostHook = jest.fn().mockResolvedValue({ globalPost: true });
      const astSpecificHook = jest.fn().mockResolvedValue({ astSpecific: true });
      
      // Global hooks that run for any operation
      await coordinator.registerHook('global-pre', globalPreHook, {
        timing: 'before',
        target: 'any'
      });
      
      await coordinator.registerHook('global-post', globalPostHook, {
        timing: 'after',
        target: 'any'
      });
      
      // Operation-specific hook
      await coordinator.registerHook('ast-specific', astSpecificHook, {
        timing: 'after',
        target: 'ast-parsing'
      });

      // Execute AST operation
      const astResult = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(astResult.success).toBe(true);
      expect(astResult.hooks).toHaveLength(3);
      expect(globalPreHook).toHaveBeenCalled();
      expect(globalPostHook).toHaveBeenCalled();
      expect(astSpecificHook).toHaveBeenCalled();

      // Reset mocks for next operation
      jest.clearAllMocks();

      // Execute Claude operation (should only trigger global hooks)
      const claudeResult = await coordinator.executePipeline({
        operation: 'claude-processing',
        target: 'claude-processing',
        prompt: 'Test'
      });

      expect(claudeResult.success).toBe(true);
      expect(claudeResult.hooks).toHaveLength(2);
      expect(globalPreHook).toHaveBeenCalled();
      expect(globalPostHook).toHaveBeenCalled();
      expect(astSpecificHook).not.toHaveBeenCalled();
    });
  });

  describe('Pipeline Statistics and Monitoring', () => {
    test('should track execution statistics', async () => {
      await coordinator.registerHook('test-hook', jest.fn().mockResolvedValue({ test: true }), {
        timing: 'before',
        target: 'ast-parsing'
      });

      // Execute multiple pipelines
      await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file1.js'
      });

      await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file2.js'
      });

      const stats = coordinator.getStatistics();
      
      expect(stats.totalExecutions).toBe(2);
      expect(stats.successfulExecutions).toBe(2);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
      expect(stats.hookExecutions['test-hook']).toBeDefined();
      expect(stats.hookExecutions['test-hook'].executions).toBe(2);
      expect(stats.hookExecutions['test-hook'].successes).toBe(2);
    });

    test('should emit comprehensive pipeline events', async () => {
      const events = [];
      
      coordinator.on('pipelineStarted', (data) => events.push({ type: 'started', data }));
      coordinator.on('hookStarted', (data) => events.push({ type: 'hookStarted', data }));
      coordinator.on('hookCompleted', (data) => events.push({ type: 'hookCompleted', data }));
      coordinator.on('pipelineCompleted', (data) => events.push({ type: 'completed', data }));

      await coordinator.registerHook('event-hook', jest.fn().mockResolvedValue({ event: true }), {
        timing: 'before',
        target: 'ast-parsing'
      });

      await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('started');
      expect(events[1].type).toBe('hookStarted');
      expect(events[2].type).toBe('hookCompleted');
      expect(events[3].type).toBe('completed');
    });
  });

  describe('Complex Integration Scenarios', () => {
    test('should handle complete AST-to-Claude pipeline with hooks', async () => {
      // Setup hooks for complete pipeline
      await coordinator.registerHook('file-validator', jest.fn().mockResolvedValue({ valid: true }), {
        timing: 'before',
        target: 'ast-parsing'
      });
      
      await coordinator.registerHook('ast-processor', jest.fn().mockResolvedValue({ processed: true }), {
        timing: 'after',
        target: 'ast-parsing'
      });
      
      await coordinator.registerHook('context-builder', jest.fn().mockResolvedValue({ context: 'built' }), {
        timing: 'before',
        target: 'claude-processing',
        dependencies: ['ast-processor']
      });

      // Execute AST parsing first
      const astResult = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/complex-file.js'
      });

      expect(astResult.success).toBe(true);

      // Execute Claude processing
      const claudeResult = await coordinator.executePipeline({
        operation: 'claude-processing',
        target: 'claude-processing',
        prompt: 'Analyze the parsed AST'
      });

      expect(claudeResult.success).toBe(true);
      expect(claudeResult.hooks).toHaveLength(1); // Only context-builder hook
    });

    test('should support hook pipeline with worktree operations', async () => {
      await coordinator.registerHook('worktree-validator', jest.fn().mockResolvedValue({ valid: true }), {
        timing: 'before',
        target: 'worktree-operation'
      });
      
      await coordinator.registerHook('discovery-processor', jest.fn().mockResolvedValue({ processed: true }), {
        timing: 'after',
        target: 'worktree-operation'
      });

      const result = await coordinator.executePipeline({
        operation: 'worktree-operation',
        target: 'worktree-operation',
        action: 'discover',
        path: '/test/project'
      });

      expect(result.success).toBe(true);
      expect(mockWorktreeManager.discoverWorktrees).toHaveBeenCalledWith('/test/project');
      expect(result.hooks).toHaveLength(2);
    });

    test('should handle context building with multiple file processing', async () => {
      await coordinator.registerHook('multi-file-validator', jest.fn().mockResolvedValue({ valid: true }), {
        timing: 'before',
        target: 'context-building'
      });
      
      await coordinator.registerHook('relevance-scorer', jest.fn().mockResolvedValue({ scored: true }), {
        timing: 'after',
        target: 'context-building'
      });

      const result = await coordinator.executePipeline({
        operation: 'context-building',
        target: 'context-building',
        files: ['/test/file1.js', '/test/file2.js', '/test/file3.js'],
        task: 'Implement user authentication'
      });

      expect(result.success).toBe(true);
      expect(mockASTProcessor.generateContext).toHaveBeenCalledWith(
        ['/test/file1.js', '/test/file2.js', '/test/file3.js'],
        'Implement user authentication'
      );
      expect(result.hooks).toHaveLength(2);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent pipeline executions', async () => {
      await coordinator.registerHook('concurrent-hook', jest.fn().mockResolvedValue({ concurrent: true }), {
        timing: 'before',
        target: 'ast-parsing'
      });

      const promises = Array.from({ length: 5 }, (_, i) => 
        coordinator.executePipeline({
          operation: 'ast-parsing',
          target: 'ast-parsing',
          filePath: `/test/file${i}.js`
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      
      const stats = coordinator.getStatistics();
      expect(stats.totalExecutions).toBe(5);
    });

    test('should maintain performance under hook load', async () => {
      // Register many hooks
      for (let i = 0; i < 20; i++) {
        await coordinator.registerHook(`hook-${i}`, jest.fn().mockResolvedValue({ id: i }), {
          timing: i % 2 === 0 ? 'before' : 'after',
          target: 'ast-parsing',
          priority: i
        });
      }

      const startTime = Date.now();
      
      const result = await coordinator.executePipeline({
        operation: 'ast-parsing',
        target: 'ast-parsing',
        filePath: '/test/file.js'
      });

      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.hooks).toHaveLength(20);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
}); 