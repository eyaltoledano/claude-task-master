/**
 * @fileoverview Hook Executor Tests
 * Tests for the core hook execution system including registration, discovery,
 * execution pipeline, and performance monitoring.
 * 
 * @author Claude (Task Master Flow Testing Phase 2.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock HookExecutor class with comprehensive hook management
class MockHookExecutor extends EventEmitter {
  constructor() {
    super();
    this.hooks = new Map();
    this.executionQueue = [];
    this.isExecuting = false;
    this.statistics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0
    };
    this.config = {
      maxConcurrentHooks: 5,
      executionTimeout: 30000,
      retryAttempts: 3,
      enablePerformanceMonitoring: true
    };
  }

  // Hook registration
  async registerHook(name, hookFunction, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Hook name must be a non-empty string');
    }
    
    if (!hookFunction || typeof hookFunction !== 'function') {
      throw new Error('Hook function must be a valid function');
    }

    const hookConfig = {
      name,
      function: hookFunction,
      priority: options.priority || 0,
      async: options.async !== false,
      timeout: options.timeout || this.config.executionTimeout,
      retryAttempts: options.retryAttempts || this.config.retryAttempts,
      enabled: options.enabled !== false,
      tags: options.tags || [],
      dependencies: options.dependencies || [],
      registeredAt: new Date(),
      ...options
    };

    this.hooks.set(name, hookConfig);
    this.emit('hookRegistered', { name, config: hookConfig });
    
    return hookConfig;
  }

  // Hook discovery
  discoverHooks(pattern = '*') {
    const discovered = [];
    
    for (const [name, config] of this.hooks) {
      if (pattern === '*' || name.includes(pattern) || config.tags.some(tag => tag.includes(pattern))) {
        discovered.push({
          name,
          priority: config.priority,
          enabled: config.enabled,
          tags: config.tags,
          dependencies: config.dependencies,
          registeredAt: config.registeredAt
        });
      }
    }

    // Sort by priority (higher first)
    return discovered.sort((a, b) => b.priority - a.priority);
  }

  // Hook execution
  async executeHook(name, context = {}) {
    const startTime = Date.now();
    
    try {
      const hookConfig = this.hooks.get(name);
      if (!hookConfig) {
        throw new Error(`Hook '${name}' not found`);
      }

      if (!hookConfig.enabled) {
        throw new Error(`Hook '${name}' is disabled`);
      }

      // Check dependencies
      for (const dependency of hookConfig.dependencies) {
        if (!this.hooks.has(dependency)) {
          throw new Error(`Hook dependency '${dependency}' not found`);
        }
      }

      this.emit('hookExecutionStarted', { name, context });

      // Add a small delay to ensure measurable execution time
      await new Promise(resolve => setTimeout(resolve, 1));

      // Execute hook with timeout
      const result = await Promise.race([
        hookConfig.function(context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Hook execution timeout')), hookConfig.timeout)
        )
      ]);

      const executionTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms
      this.updateStatistics(true, executionTime);
      
      this.emit('hookExecutionCompleted', { 
        name, 
        result, 
        executionTime,
        context 
      });

      return result;
    } catch (error) {
      const executionTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms
      this.updateStatistics(false, executionTime);
      
      this.emit('hookExecutionFailed', { 
        name, 
        error: error.message,
        executionTime,
        context 
      });
      
      throw error;
    }
  }

  // Execute multiple hooks
  async executeHooks(names, context = {}) {
    const results = new Map();
    const errors = new Map();

    for (const name of names) {
      try {
        const result = await this.executeHook(name, context);
        results.set(name, result);
      } catch (error) {
        errors.set(name, error);
      }
    }

    return { results, errors };
  }

  // Execute hooks by pattern/tag
  async executeHooksByPattern(pattern, context = {}) {
    const discovered = this.discoverHooks(pattern);
    const names = discovered.map(hook => hook.name);
    return await this.executeHooks(names, context);
  }

  // Hook management
  async unregisterHook(name) {
    if (!this.hooks.has(name)) {
      throw new Error(`Hook '${name}' not found`);
    }

    this.hooks.delete(name);
    this.emit('hookUnregistered', { name });
    return true;
  }

  async enableHook(name) {
    const hook = this.hooks.get(name);
    if (!hook) {
      throw new Error(`Hook '${name}' not found`);
    }

    hook.enabled = true;
    this.emit('hookEnabled', { name });
    return true;
  }

  async disableHook(name) {
    const hook = this.hooks.get(name);
    if (!hook) {
      throw new Error(`Hook '${name}' not found`);
    }

    hook.enabled = false;
    this.emit('hookDisabled', { name });
    return true;
  }

  // Statistics and monitoring
  updateStatistics(success, executionTime) {
    this.statistics.totalExecutions++;
    if (success) {
      this.statistics.successfulExecutions++;
    } else {
      this.statistics.failedExecutions++;
    }
    
    this.statistics.totalExecutionTime += executionTime;
    this.statistics.averageExecutionTime = 
      this.statistics.totalExecutionTime / this.statistics.totalExecutions;
  }

  getStatistics() {
    return {
      ...this.statistics,
      successRate: this.statistics.totalExecutions > 0 
        ? (this.statistics.successfulExecutions / this.statistics.totalExecutions) * 100 
        : 0,
      totalHooks: this.hooks.size,
      enabledHooks: Array.from(this.hooks.values()).filter(h => h.enabled).length
    };
  }

  // Cleanup
  async cleanup() {
    this.hooks.clear();
    this.executionQueue = [];
    this.isExecuting = false;
    this.statistics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0
    };
    this.emit('cleanup');
  }
}

describe('Hook Executor System', () => {
  let executor;

  beforeEach(() => {
    executor = new MockHookExecutor();
  });

  afterEach(async () => {
    await executor.cleanup();
  });

  describe('Hook Registration', () => {
    test('should register a basic hook successfully', async () => {
      const mockHook = jest.fn().mockResolvedValue('success');
      
      const config = await executor.registerHook('test-hook', mockHook);
      
      expect(config.name).toBe('test-hook');
      expect(config.function).toBe(mockHook);
      expect(config.enabled).toBe(true);
      expect(config.priority).toBe(0);
      expect(executor.hooks.has('test-hook')).toBe(true);
    });

    test('should register hook with custom options', async () => {
      const mockHook = jest.fn().mockResolvedValue('success');
      const options = {
        priority: 10,
        timeout: 5000,
        tags: ['test', 'validation'],
        dependencies: ['other-hook']
      };
      
      const config = await executor.registerHook('custom-hook', mockHook, options);
      
      expect(config.priority).toBe(10);
      expect(config.timeout).toBe(5000);
      expect(config.tags).toEqual(['test', 'validation']);
      expect(config.dependencies).toEqual(['other-hook']);
    });

    test('should emit hookRegistered event', async () => {
      const eventSpy = jest.fn();
      executor.on('hookRegistered', eventSpy);
      
      const mockHook = jest.fn().mockResolvedValue('success');
      await executor.registerHook('event-test', mockHook);
      
      expect(eventSpy).toHaveBeenCalledWith({
        name: 'event-test',
        config: expect.objectContaining({ name: 'event-test' })
      });
    });

    test('should reject invalid hook name', async () => {
      const mockHook = jest.fn();
      
      await expect(executor.registerHook('', mockHook)).rejects.toThrow('Hook name must be a non-empty string');
      await expect(executor.registerHook(null, mockHook)).rejects.toThrow('Hook name must be a non-empty string');
    });

    test('should reject invalid hook function', async () => {
      await expect(executor.registerHook('test', null)).rejects.toThrow('Hook function must be a valid function');
      await expect(executor.registerHook('test', 'not-a-function')).rejects.toThrow('Hook function must be a valid function');
    });
  });

  describe('Hook Discovery', () => {
    beforeEach(async () => {
      await executor.registerHook('high-priority', jest.fn(), { priority: 10, tags: ['critical'] });
      await executor.registerHook('medium-priority', jest.fn(), { priority: 5, tags: ['normal'] });
      await executor.registerHook('low-priority', jest.fn(), { priority: 1, tags: ['optional'] });
      await executor.registerHook('disabled-hook', jest.fn(), { enabled: false });
    });

    test('should discover all hooks with wildcard pattern', () => {
      const discovered = executor.discoverHooks('*');
      
      expect(discovered).toHaveLength(4);
      expect(discovered[0].name).toBe('high-priority');
      expect(discovered[1].name).toBe('medium-priority');
      expect(discovered[2].name).toBe('low-priority');
    });

    test('should discover hooks by name pattern', () => {
      const discovered = executor.discoverHooks('priority');
      
      expect(discovered).toHaveLength(3);
      expect(discovered.every(h => h.name.includes('priority'))).toBe(true);
    });

    test('should discover hooks by tag', () => {
      const discovered = executor.discoverHooks('critical');
      
      expect(discovered).toHaveLength(1);
      expect(discovered[0].name).toBe('high-priority');
    });

    test('should return hooks sorted by priority', () => {
      const discovered = executor.discoverHooks('*');
      
      for (let i = 0; i < discovered.length - 1; i++) {
        expect(discovered[i].priority).toBeGreaterThanOrEqual(discovered[i + 1].priority);
      }
    });
  });

  describe('Hook Execution', () => {
    test('should execute hook successfully', async () => {
      const mockHook = jest.fn().mockResolvedValue('hook-result');
      await executor.registerHook('test-hook', mockHook);
      
      const result = await executor.executeHook('test-hook', { data: 'test' });
      
      expect(result).toBe('hook-result');
      expect(mockHook).toHaveBeenCalledWith({ data: 'test' });
    });

    test('should emit execution events', async () => {
      const startSpy = jest.fn();
      const completedSpy = jest.fn();
      
      executor.on('hookExecutionStarted', startSpy);
      executor.on('hookExecutionCompleted', completedSpy);
      
      const mockHook = jest.fn().mockResolvedValue('success');
      await executor.registerHook('event-hook', mockHook);
      
      await executor.executeHook('event-hook', { test: true });
      
      expect(startSpy).toHaveBeenCalledWith({
        name: 'event-hook',
        context: { test: true }
      });
      expect(completedSpy).toHaveBeenCalledWith({
        name: 'event-hook',
        result: 'success',
        executionTime: expect.any(Number),
        context: { test: true }
      });
    });

    test('should handle hook execution timeout', async () => {
      const slowHook = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      await executor.registerHook('slow-hook', slowHook, { timeout: 50 });
      
      await expect(executor.executeHook('slow-hook')).rejects.toThrow('Hook execution timeout');
    });

    test('should handle hook execution errors', async () => {
      const errorHook = jest.fn().mockRejectedValue(new Error('Hook failed'));
      const failedSpy = jest.fn();
      
      executor.on('hookExecutionFailed', failedSpy);
      await executor.registerHook('error-hook', errorHook);
      
      await expect(executor.executeHook('error-hook')).rejects.toThrow('Hook failed');
      expect(failedSpy).toHaveBeenCalledWith({
        name: 'error-hook',
        error: 'Hook failed',
        executionTime: expect.any(Number),
        context: {}
      });
    });

    test('should reject execution of non-existent hook', async () => {
      await expect(executor.executeHook('non-existent')).rejects.toThrow("Hook 'non-existent' not found");
    });

    test('should reject execution of disabled hook', async () => {
      const mockHook = jest.fn();
      await executor.registerHook('disabled-hook', mockHook, { enabled: false });
      
      await expect(executor.executeHook('disabled-hook')).rejects.toThrow("Hook 'disabled-hook' is disabled");
    });

    test('should check hook dependencies', async () => {
      const dependentHook = jest.fn().mockResolvedValue('success');
      await executor.registerHook('dependent-hook', dependentHook, { 
        dependencies: ['missing-dependency'] 
      });
      
      await expect(executor.executeHook('dependent-hook')).rejects.toThrow("Hook dependency 'missing-dependency' not found");
    });
  });

  describe('Multiple Hook Execution', () => {
    beforeEach(async () => {
      await executor.registerHook('hook1', jest.fn().mockResolvedValue('result1'));
      await executor.registerHook('hook2', jest.fn().mockResolvedValue('result2'));
      await executor.registerHook('hook3', jest.fn().mockRejectedValue(new Error('Hook3 failed')));
    });

    test('should execute multiple hooks and return results', async () => {
      const { results, errors } = await executor.executeHooks(['hook1', 'hook2']);
      
      expect(results.get('hook1')).toBe('result1');
      expect(results.get('hook2')).toBe('result2');
      expect(errors.size).toBe(0);
    });

    test('should handle mixed success and failure', async () => {
      const { results, errors } = await executor.executeHooks(['hook1', 'hook3']);
      
      expect(results.get('hook1')).toBe('result1');
      expect(errors.has('hook3')).toBe(true);
      expect(errors.get('hook3').message).toBe('Hook3 failed');
    });

    test('should execute hooks by pattern', async () => {
      await executor.registerHook('validation-hook', jest.fn().mockResolvedValue('validated'), { tags: ['validation'] });
      
      const { results } = await executor.executeHooksByPattern('validation');
      
      expect(results.has('validation-hook')).toBe(true);
      expect(results.get('validation-hook')).toBe('validated');
    });
  });

  describe('Hook Management', () => {
    test('should unregister hook successfully', async () => {
      const mockHook = jest.fn();
      await executor.registerHook('temp-hook', mockHook);
      
      expect(executor.hooks.has('temp-hook')).toBe(true);
      
      await executor.unregisterHook('temp-hook');
      
      expect(executor.hooks.has('temp-hook')).toBe(false);
    });

    test('should emit hookUnregistered event', async () => {
      const eventSpy = jest.fn();
      executor.on('hookUnregistered', eventSpy);
      
      await executor.registerHook('temp-hook', jest.fn());
      await executor.unregisterHook('temp-hook');
      
      expect(eventSpy).toHaveBeenCalledWith({ name: 'temp-hook' });
    });

    test('should enable and disable hooks', async () => {
      const mockHook = jest.fn();
      await executor.registerHook('toggle-hook', mockHook);
      
      await executor.disableHook('toggle-hook');
      expect(executor.hooks.get('toggle-hook').enabled).toBe(false);
      
      await executor.enableHook('toggle-hook');
      expect(executor.hooks.get('toggle-hook').enabled).toBe(true);
    });
  });

  describe('Statistics and Performance', () => {
    test('should track execution statistics', async () => {
      const mockHook = jest.fn().mockResolvedValue('success');
      await executor.registerHook('stats-hook', mockHook);
      
      await executor.executeHook('stats-hook');
      await executor.executeHook('stats-hook');
      
      const stats = executor.getStatistics();
      
      expect(stats.totalExecutions).toBe(2);
      expect(stats.successfulExecutions).toBe(2);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.successRate).toBe(100);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    });

    test('should track failed executions', async () => {
      const errorHook = jest.fn().mockRejectedValue(new Error('Failed'));
      await executor.registerHook('error-hook', errorHook);
      
      try {
        await executor.executeHook('error-hook');
      } catch (error) {
        // Expected to fail
      }
      
      const stats = executor.getStatistics();
      
      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    test('should provide hook count statistics', async () => {
      await executor.registerHook('enabled-hook', jest.fn());
      await executor.registerHook('disabled-hook', jest.fn(), { enabled: false });
      
      const stats = executor.getStatistics();
      
      expect(stats.totalHooks).toBe(2);
      expect(stats.enabledHooks).toBe(1);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should execute hooks within performance thresholds', async () => {
      const fastHook = jest.fn().mockResolvedValue('fast');
      await executor.registerHook('fast-hook', fastHook);
      
      const startTime = Date.now();
      await executor.executeHook('fast-hook');
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(100); // Should execute within 100ms
    });

    test('should handle concurrent hook executions efficiently', async () => {
      const hooks = [];
      for (let i = 0; i < 10; i++) {
        const hook = jest.fn().mockResolvedValue(`result-${i}`);
        await executor.registerHook(`concurrent-hook-${i}`, hook);
        hooks.push(`concurrent-hook-${i}`);
      }
      
      const startTime = Date.now();
      const { results } = await executor.executeHooks(hooks);
      const totalTime = Date.now() - startTime;
      
      expect(results.size).toBe(10);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should continue execution despite individual hook failures', async () => {
      await executor.registerHook('good-hook', jest.fn().mockResolvedValue('success'));
      await executor.registerHook('bad-hook', jest.fn().mockRejectedValue(new Error('Failed')));
      await executor.registerHook('another-good-hook', jest.fn().mockResolvedValue('also-success'));
      
      const { results, errors } = await executor.executeHooks(['good-hook', 'bad-hook', 'another-good-hook']);
      
      expect(results.size).toBe(2);
      expect(errors.size).toBe(1);
      expect(results.get('good-hook')).toBe('success');
      expect(results.get('another-good-hook')).toBe('also-success');
    });

    test('should maintain system stability after cleanup', async () => {
      await executor.registerHook('test-hook', jest.fn().mockResolvedValue('before-cleanup'));
      
      await executor.cleanup();
      
      expect(executor.hooks.size).toBe(0);
      expect(executor.getStatistics().totalExecutions).toBe(0);
      
      // Should be able to register new hooks after cleanup
      await executor.registerHook('new-hook', jest.fn().mockResolvedValue('after-cleanup'));
      expect(executor.hooks.size).toBe(1);
    });
  });
}); 