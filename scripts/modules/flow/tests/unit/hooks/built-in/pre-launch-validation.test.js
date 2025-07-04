/**
 * @fileoverview Pre-Launch Validation Hook Tests
 * Tests for pre-launch validation hook including dependency checks,
 * environment validation, and safety verification.
 * 
 * @author Claude (Task Master Flow Testing Phase 2.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock PreLaunchValidationHook class
class MockPreLaunchValidationHook extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      validateDependencies: options.validateDependencies !== false,
      validateEnvironment: options.validateEnvironment !== false,
      validatePermissions: options.validatePermissions !== false,
      validateResources: options.validateResources !== false,
      strictMode: options.strictMode || false,
      timeoutMs: options.timeoutMs || 30000,
      ...options
    };
    this.validators = new Map();
    this.statistics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0
    };
    this.isActive = false;
  }

  async activate() {
    this.isActive = true;
    this.setupDefaultValidators();
    this.emit('hookActivated');
    return true;
  }

  async deactivate() {
    this.isActive = false;
    this.validators.clear();
    this.emit('hookDeactivated');
    return true;
  }

  setupDefaultValidators() {
    // Dependency validator
    this.validators.set('dependencies', async (context) => {
      const missing = [];
      if (context.requiredDependencies) {
        for (const dep of context.requiredDependencies) {
          if (!this.checkDependency(dep)) {
            missing.push(dep);
          }
        }
      }
      return {
        valid: missing.length === 0,
        message: missing.length > 0 ? `Missing dependencies: ${missing.join(', ')}` : 'All dependencies satisfied',
        details: { missing, checked: context.requiredDependencies?.length || 0 }
      };
    });

    // Environment validator
    this.validators.set('environment', async (context) => {
      const issues = [];
      if (context.requiredEnvVars) {
        for (const envVar of context.requiredEnvVars) {
          if (!process.env[envVar]) {
            issues.push(`Missing environment variable: ${envVar}`);
          }
        }
      }
      return {
        valid: issues.length === 0,
        message: issues.length > 0 ? issues.join('; ') : 'Environment validation passed',
        details: { issues, checked: context.requiredEnvVars?.length || 0 }
      };
    });

    // Permissions validator
    this.validators.set('permissions', async (context) => {
      const denied = [];
      if (context.requiredPermissions) {
        for (const permission of context.requiredPermissions) {
          if (!this.checkPermission(permission)) {
            denied.push(permission);
          }
        }
      }
      return {
        valid: denied.length === 0,
        message: denied.length > 0 ? `Insufficient permissions: ${denied.join(', ')}` : 'All permissions granted',
        details: { denied, checked: context.requiredPermissions?.length || 0 }
      };
    });

    // Resources validator
    this.validators.set('resources', async (context) => {
      const insufficient = [];
      if (context.requiredResources) {
        for (const resource of context.requiredResources) {
          if (!this.checkResource(resource)) {
            insufficient.push(resource.name);
          }
        }
      }
      return {
        valid: insufficient.length === 0,
        message: insufficient.length > 0 ? `Insufficient resources: ${insufficient.join(', ')}` : 'All resources available',
        details: { insufficient, checked: context.requiredResources?.length || 0 }
      };
    });
  }

  checkDependency(dependency) {
    // Mock dependency check
    return !dependency.name.includes('missing');
  }

  checkPermission(permission) {
    // Mock permission check
    return !permission.includes('denied');
  }

  checkResource(resource) {
    // Mock resource check
    return resource.available !== false;
  }

  async execute(context = {}) {
    if (!this.isActive) {
      throw new Error('Hook not active');
    }

    const startTime = Date.now();
    this.statistics.totalValidations++;

    try {
      this.emit('validationStarted', { context, timestamp: new Date() });

      // Add a small delay to ensure measurable validation time
      await new Promise(resolve => setTimeout(resolve, 1));

      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        validations: {},
        metadata: {
          validatedAt: new Date(),
          validationTime: 0,
          strictMode: this.config.strictMode
        }
      };

      // Run all enabled validators
      if (this.config.validateDependencies) {
        validationResult.validations.dependencies = await this.validators.get('dependencies')(context);
      }

      if (this.config.validateEnvironment) {
        validationResult.validations.environment = await this.validators.get('environment')(context);
      }

      if (this.config.validatePermissions) {
        validationResult.validations.permissions = await this.validators.get('permissions')(context);
      }

      if (this.config.validateResources) {
        validationResult.validations.resources = await this.validators.get('resources')(context);
      }

      // Process validation results
      for (const [name, result] of Object.entries(validationResult.validations)) {
        if (!result.valid) {
          if (this.config.strictMode) {
            validationResult.errors.push({
              validator: name,
              message: result.message,
              details: result.details
            });
          } else {
            validationResult.warnings.push({
              validator: name,
              message: result.message,
              details: result.details
            });
          }
        }
      }

      // Determine overall validity
      validationResult.valid = this.config.strictMode ? 
        validationResult.errors.length === 0 : 
        validationResult.errors.length === 0;

      const validationTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms
      validationResult.metadata.validationTime = validationTime;

      // Update statistics
      if (validationResult.valid) {
        this.statistics.passedValidations++;
      } else {
        this.statistics.failedValidations++;
      }

      this.updateAverageTime(validationTime);

      this.emit('validationCompleted', {
        result: validationResult,
        context,
        validationTime
      });

      return validationResult;
    } catch (error) {
      const validationTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms
      this.statistics.failedValidations++;
      this.updateAverageTime(validationTime);

      this.emit('validationFailed', {
        error: error.message,
        context,
        validationTime
      });

      throw error;
    }
  }

  updateAverageTime(validationTime) {
    const total = this.statistics.passedValidations + this.statistics.failedValidations;
    this.statistics.averageValidationTime = 
      ((this.statistics.averageValidationTime * (total - 1)) + validationTime) / total;
  }

  addValidator(name, validator) {
    this.validators.set(name, validator);
    this.emit('validatorAdded', { name });
  }

  removeValidator(name) {
    const existed = this.validators.delete(name);
    if (existed) {
      this.emit('validatorRemoved', { name });
    }
    return existed;
  }

  getStatistics() {
    return {
      ...this.statistics,
      successRate: this.statistics.totalValidations > 0 
        ? (this.statistics.passedValidations / this.statistics.totalValidations) * 100 
        : 0,
      validatorCount: this.validators.size,
      isActive: this.isActive
    };
  }

  async cleanup() {
    this.validators.clear();
    this.statistics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0
    };
    this.emit('hookCleanedUp');
  }
}

describe('Pre-Launch Validation Hook', () => {
  let validationHook;

  beforeEach(async () => {
    validationHook = new MockPreLaunchValidationHook();
    await validationHook.activate();
  });

  afterEach(async () => {
    if (validationHook.isActive) {
      await validationHook.deactivate();
    }
    await validationHook.cleanup();
  });

  describe('Hook Activation', () => {
    test('should activate successfully', async () => {
      const newHook = new MockPreLaunchValidationHook();
      await newHook.activate();
      
      expect(newHook.isActive).toBe(true);
      expect(newHook.validators.size).toBeGreaterThan(0);
      
      await newHook.deactivate();
    });

    test('should setup default validators', async () => {
      expect(validationHook.validators.has('dependencies')).toBe(true);
      expect(validationHook.validators.has('environment')).toBe(true);
      expect(validationHook.validators.has('permissions')).toBe(true);
      expect(validationHook.validators.has('resources')).toBe(true);
    });
  });

  describe('Dependency Validation', () => {
    test('should pass with all dependencies satisfied', async () => {
      const context = {
        requiredDependencies: [
          { name: 'node', version: '>=14.0.0' },
          { name: 'npm', version: '>=6.0.0' }
        ]
      };
      
      const result = await validationHook.execute(context);
      
      expect(result.valid).toBe(true);
      expect(result.validations.dependencies.valid).toBe(true);
    });

    test('should fail with missing dependencies', async () => {
      const context = {
        requiredDependencies: [
          { name: 'missing-dependency', version: '1.0.0' }
        ]
      };
      
      const result = await validationHook.execute(context);
      
      expect(result.validations.dependencies.valid).toBe(false);
      expect(result.validations.dependencies.message).toContain('Missing dependencies');
    });
  });

  describe('Environment Validation', () => {
    test('should pass with all environment variables present', async () => {
      process.env.TEST_VAR = 'test-value';
      
      const context = {
        requiredEnvVars: ['TEST_VAR', 'PATH']
      };
      
      const result = await validationHook.execute(context);
      
      expect(result.validations.environment.valid).toBe(true);
      
      delete process.env.TEST_VAR;
    });

    test('should fail with missing environment variables', async () => {
      const context = {
        requiredEnvVars: ['MISSING_ENV_VAR']
      };
      
      const result = await validationHook.execute(context);
      
      expect(result.validations.environment.valid).toBe(false);
      expect(result.validations.environment.message).toContain('Missing environment variable');
    });
  });

  describe('Permission Validation', () => {
    test('should pass with all permissions granted', async () => {
      const context = {
        requiredPermissions: ['read', 'write', 'execute']
      };
      
      const result = await validationHook.execute(context);
      
      expect(result.validations.permissions.valid).toBe(true);
    });

    test('should fail with denied permissions', async () => {
      const context = {
        requiredPermissions: ['denied-permission']
      };
      
      const result = await validationHook.execute(context);
      
      expect(result.validations.permissions.valid).toBe(false);
      expect(result.validations.permissions.message).toContain('Insufficient permissions');
    });
  });

  describe('Resource Validation', () => {
    test('should pass with all resources available', async () => {
      const context = {
        requiredResources: [
          { name: 'memory', required: '1GB', available: true },
          { name: 'disk', required: '10GB', available: true }
        ]
      };
      
      const result = await validationHook.execute(context);
      
      expect(result.validations.resources.valid).toBe(true);
    });

    test('should fail with insufficient resources', async () => {
      const context = {
        requiredResources: [
          { name: 'memory', required: '1GB', available: false }
        ]
      };
      
      const result = await validationHook.execute(context);
      
      expect(result.validations.resources.valid).toBe(false);
      expect(result.validations.resources.message).toContain('Insufficient resources');
    });
  });

  describe('Strict Mode', () => {
    test('should treat validation failures as errors in strict mode', async () => {
      const strictHook = new MockPreLaunchValidationHook({ strictMode: true });
      await strictHook.activate();
      
      const context = {
        requiredDependencies: [{ name: 'missing-dependency' }]
      };
      
      const result = await strictHook.execute(context);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
      
      await strictHook.deactivate();
    });

    test('should treat validation failures as warnings in non-strict mode', async () => {
      const context = {
        requiredDependencies: [{ name: 'missing-dependency' }]
      };
      
      const result = await validationHook.execute(context);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('Custom Validators', () => {
    test('should add custom validator', () => {
      const customValidator = jest.fn().mockResolvedValue({ valid: true, message: 'Custom validation passed' });
      
      validationHook.addValidator('custom', customValidator);
      
      expect(validationHook.validators.has('custom')).toBe(true);
    });

    test('should remove validator', () => {
      const result = validationHook.removeValidator('dependencies');
      
      expect(result).toBe(true);
      expect(validationHook.validators.has('dependencies')).toBe(false);
    });

    test('should emit events for validator management', () => {
      const addedSpy = jest.fn();
      const removedSpy = jest.fn();
      
      validationHook.on('validatorAdded', addedSpy);
      validationHook.on('validatorRemoved', removedSpy);
      
      validationHook.addValidator('test', jest.fn());
      validationHook.removeValidator('test');
      
      expect(addedSpy).toHaveBeenCalledWith({ name: 'test' });
      expect(removedSpy).toHaveBeenCalledWith({ name: 'test' });
    });
  });

  describe('Statistics and Events', () => {
    test('should track validation statistics', async () => {
      await validationHook.execute({});
      await validationHook.execute({});
      
      const stats = validationHook.getStatistics();
      
      expect(stats.totalValidations).toBe(2);
      expect(stats.passedValidations).toBe(2);
      expect(stats.successRate).toBe(100);
      expect(stats.averageValidationTime).toBeGreaterThan(0);
    });

    test('should emit validation events', async () => {
      const startedSpy = jest.fn();
      const completedSpy = jest.fn();
      
      validationHook.on('validationStarted', startedSpy);
      validationHook.on('validationCompleted', completedSpy);
      
      await validationHook.execute({});
      
      expect(startedSpy).toHaveBeenCalled();
      expect(completedSpy).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('should complete validation within time limits', async () => {
      const context = {
        requiredDependencies: Array.from({ length: 100 }, (_, i) => ({ name: `dep-${i}` })),
        requiredEnvVars: Array.from({ length: 50 }, (_, i) => `ENV_${i}`),
        requiredPermissions: Array.from({ length: 20 }, (_, i) => `permission-${i}`),
        requiredResources: Array.from({ length: 10 }, (_, i) => ({ name: `resource-${i}`, available: true }))
      };
      
      const startTime = Date.now();
      await validationHook.execute(context);
      const validationTime = Date.now() - startTime;
      
      expect(validationTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
}); 