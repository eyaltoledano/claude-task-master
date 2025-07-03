/**
 * @fileoverview Hook Validator Tests
 * Tests for hook validation system including safety checks, configuration validation,
 * and security validation for hook execution.
 * 
 * @author Claude (Task Master Flow Testing Phase 2.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock HookValidator class with comprehensive validation capabilities
class MockHookValidator extends EventEmitter {
  constructor() {
    super();
    this.validationRules = new Map();
    this.safetyChecks = new Map();
    this.securityPolicies = new Map();
    this.validationCache = new Map();
    this.statistics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      securityViolations: 0,
      safetyCheckFailures: 0
    };
    this.config = {
      enableCaching: true,
      strictMode: false,
      securityLevel: 'medium',
      allowUnsafeOperations: false,
      maxHookComplexity: 100,
      maxExecutionTime: 30000
    };
  }

  // Validation rule management
  addValidationRule(name, rule) {
    if (!name || typeof name !== 'string') {
      throw new Error('Validation rule name must be a non-empty string');
    }
    
    if (!rule || typeof rule !== 'object') {
      throw new Error('Validation rule must be an object');
    }

    const validationRule = {
      name,
      validator: rule.validator,
      severity: rule.severity || 'error',
      message: rule.message || `Validation failed for rule: ${name}`,
      enabled: rule.enabled !== false,
      category: rule.category || 'general',
      ...rule
    };

    this.validationRules.set(name, validationRule);
    this.emit('validationRuleAdded', { name, rule: validationRule });
    
    return validationRule;
  }

  // Safety check management
  addSafetyCheck(name, check) {
    if (!name || typeof name !== 'string') {
      throw new Error('Safety check name must be a non-empty string');
    }

    const safetyCheck = {
      name,
      checker: check.checker,
      severity: check.severity || 'warning',
      message: check.message || `Safety check failed: ${name}`,
      enabled: check.enabled !== false,
      blocking: check.blocking !== false,
      ...check
    };

    this.safetyChecks.set(name, safetyCheck);
    this.emit('safetyCheckAdded', { name, check: safetyCheck });
    
    return safetyCheck;
  }

  // Security policy management
  addSecurityPolicy(name, policy) {
    if (!name || typeof name !== 'string') {
      throw new Error('Security policy name must be a non-empty string');
    }

    const securityPolicy = {
      name,
      enforcer: policy.enforcer,
      severity: 'error',
      message: policy.message || `Security policy violation: ${name}`,
      enabled: policy.enabled !== false,
      ...policy
    };

    this.securityPolicies.set(name, securityPolicy);
    this.emit('securityPolicyAdded', { name, policy: securityPolicy });
    
    return securityPolicy;
  }

  // Hook validation
  async validateHook(hookConfig, context = {}) {
    const startTime = Date.now();
    this.statistics.totalValidations++;

    try {
      // Validate input parameters first
      if (!hookConfig) {
        throw new Error('Hook configuration is required');
      }

      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        securityViolations: [],
        safetyIssues: [],
        metadata: {
          validatedAt: new Date(),
          validationTime: 0,
          securityLevel: this.config.securityLevel,
          strictMode: this.config.strictMode
        }
      };

      // Check cache if enabled
      const cacheKey = this.generateCacheKey(hookConfig, context);
      if (this.config.enableCaching && this.validationCache.has(cacheKey)) {
        const cached = this.validationCache.get(cacheKey);
        
        // Update statistics even for cached results
        if (cached.valid) {
          this.statistics.passedValidations++;
        } else {
          this.statistics.failedValidations++;
        }
        
        this.emit('validationCacheHit', { cacheKey, result: cached });
        return cached;
      }

      // Basic structure validation
      await this.validateHookStructure(hookConfig, validationResult);

      // Run validation rules
      await this.runValidationRules(hookConfig, context, validationResult);

      // Run safety checks
      await this.runSafetyChecks(hookConfig, context, validationResult);

      // Run security policies
      await this.runSecurityPolicies(hookConfig, context, validationResult);

      // Determine overall validity
      validationResult.valid = validationResult.errors.length === 0 && 
                              validationResult.securityViolations.length === 0 &&
                              validationResult.safetyIssues.filter(issue => issue.blocking).length === 0;

      validationResult.metadata.validationTime = Date.now() - startTime;

      // Update statistics
      if (validationResult.valid) {
        this.statistics.passedValidations++;
      } else {
        this.statistics.failedValidations++;
      }

      this.statistics.securityViolations += validationResult.securityViolations.length;
      this.statistics.safetyCheckFailures += validationResult.safetyIssues.length;

      // Cache result if enabled
      if (this.config.enableCaching) {
        this.validationCache.set(cacheKey, validationResult);
      }

      this.emit('hookValidated', { 
        hookName: hookConfig.name, 
        result: validationResult,
        context 
      });

      return validationResult;
    } catch (error) {
      this.statistics.failedValidations++;
      this.emit('validationError', { 
        hookName: hookConfig?.name, 
        error: error.message,
        context 
      });
      throw error;
    }
  }

  // Structure validation
  async validateHookStructure(hookConfig, result) {
    if (!hookConfig.name || typeof hookConfig.name !== 'string') {
      result.errors.push({
        type: 'structure',
        message: 'Hook must have a valid name',
        severity: 'error'
      });
    }

    if (!hookConfig.function || typeof hookConfig.function !== 'function') {
      result.errors.push({
        type: 'structure',
        message: 'Hook must have a valid function',
        severity: 'error'
      });
    }

    if (hookConfig.timeout && (typeof hookConfig.timeout !== 'number' || hookConfig.timeout <= 0)) {
      result.errors.push({
        type: 'structure',
        message: 'Hook timeout must be a positive number',
        severity: 'error'
      });
    }

    if (hookConfig.priority && typeof hookConfig.priority !== 'number') {
      result.warnings.push({
        type: 'structure',
        message: 'Hook priority should be a number',
        severity: 'warning'
      });
    }

    if (hookConfig.dependencies && !Array.isArray(hookConfig.dependencies)) {
      result.errors.push({
        type: 'structure',
        message: 'Hook dependencies must be an array',
        severity: 'error'
      });
    }
  }

  // Run validation rules
  async runValidationRules(hookConfig, context, result) {
    for (const [name, rule] of this.validationRules) {
      if (!rule.enabled) continue;

      try {
        const ruleResult = await rule.validator(hookConfig, context);
        
        if (!ruleResult.valid) {
          const issue = {
            type: 'validation',
            rule: name,
            message: ruleResult.message || rule.message,
            severity: rule.severity,
            details: ruleResult.details
          };

          if (rule.severity === 'error') {
            result.errors.push(issue);
          } else {
            result.warnings.push(issue);
          }
        }
      } catch (error) {
        result.errors.push({
          type: 'validation',
          rule: name,
          message: `Validation rule '${name}' failed: ${error.message}`,
          severity: 'error'
        });
      }
    }
  }

  // Run safety checks
  async runSafetyChecks(hookConfig, context, result) {
    for (const [name, check] of this.safetyChecks) {
      if (!check.enabled) continue;

      try {
        const checkResult = await check.checker(hookConfig, context);
        
        if (!checkResult.safe) {
          const issue = {
            type: 'safety',
            check: name,
            message: checkResult.message || check.message,
            severity: check.severity,
            blocking: check.blocking,
            details: checkResult.details
          };

          result.safetyIssues.push(issue);
        }
      } catch (error) {
        result.safetyIssues.push({
          type: 'safety',
          check: name,
          message: `Safety check '${name}' failed: ${error.message}`,
          severity: 'error',
          blocking: true
        });
      }
    }
  }

  // Run security policies
  async runSecurityPolicies(hookConfig, context, result) {
    for (const [name, policy] of this.securityPolicies) {
      if (!policy.enabled) continue;

      try {
        const policyResult = await policy.enforcer(hookConfig, context);
        
        if (!policyResult.compliant) {
          const violation = {
            type: 'security',
            policy: name,
            message: policyResult.message || policy.message,
            severity: 'error',
            details: policyResult.details
          };

          result.securityViolations.push(violation);
        }
      } catch (error) {
        result.securityViolations.push({
          type: 'security',
          policy: name,
          message: `Security policy '${name}' enforcement failed: ${error.message}`,
          severity: 'error'
        });
      }
    }
  }

  // Configuration validation
  async validateConfiguration(config) {
    const validationResult = {
      valid: true,
      errors: [],
      warnings: [],
      normalizedConfig: { ...config }
    };

    // Validate security level
    const validSecurityLevels = ['low', 'medium', 'high', 'strict'];
    if (config.securityLevel && !validSecurityLevels.includes(config.securityLevel)) {
      validationResult.errors.push({
        field: 'securityLevel',
        message: `Invalid security level. Must be one of: ${validSecurityLevels.join(', ')}`,
        value: config.securityLevel
      });
    }

    // Validate numeric fields
    const numericFields = ['maxHookComplexity', 'maxExecutionTime'];
    for (const field of numericFields) {
      if (config[field] !== undefined) {
        if (typeof config[field] !== 'number' || config[field] <= 0) {
          validationResult.errors.push({
            field,
            message: `${field} must be a positive number`,
            value: config[field]
          });
        }
      }
    }

    // Validate boolean fields
    const booleanFields = ['enableCaching', 'strictMode', 'allowUnsafeOperations'];
    for (const field of booleanFields) {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        validationResult.warnings.push({
          field,
          message: `${field} should be a boolean value`,
          value: config[field]
        });
        validationResult.normalizedConfig[field] = Boolean(config[field]);
      }
    }

    validationResult.valid = validationResult.errors.length === 0;
    
    return validationResult;
  }

  // Batch validation
  async validateHooks(hookConfigs, context = {}) {
    const results = new Map();
    
    for (const hookConfig of hookConfigs) {
      try {
        const result = await this.validateHook(hookConfig, context);
        results.set(hookConfig.name, result);
      } catch (error) {
        results.set(hookConfig.name, {
          valid: false,
          errors: [{ type: 'validation', message: error.message, severity: 'error' }],
          warnings: [],
          securityViolations: [],
          safetyIssues: []
        });
      }
    }

    return results;
  }

  // Utility methods
  generateCacheKey(hookConfig, context) {
    const key = `${hookConfig.name}-${JSON.stringify(hookConfig)}-${JSON.stringify(context)}`;
    return Buffer.from(key).toString('base64');
  }

  getStatistics() {
    return {
      ...this.statistics,
      validationSuccessRate: this.statistics.totalValidations > 0 
        ? (this.statistics.passedValidations / this.statistics.totalValidations) * 100 
        : 0,
      totalRules: this.validationRules.size,
      totalSafetyChecks: this.safetyChecks.size,
      totalSecurityPolicies: this.securityPolicies.size,
      cacheSize: this.validationCache.size
    };
  }

  clearCache() {
    this.validationCache.clear();
    this.emit('cacheCleared');
  }

  async cleanup() {
    this.validationRules.clear();
    this.safetyChecks.clear();
    this.securityPolicies.clear();
    this.validationCache.clear();
    this.statistics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      securityViolations: 0,
      safetyCheckFailures: 0
    };
    this.emit('cleanup');
  }
}

describe('Hook Validator System', () => {
  let validator;

  beforeEach(() => {
    validator = new MockHookValidator();
  });

  afterEach(async () => {
    await validator.cleanup();
  });

  describe('Validation Rule Management', () => {
    test('should add validation rule successfully', () => {
      const rule = {
        validator: jest.fn().mockResolvedValue({ valid: true }),
        severity: 'error',
        message: 'Test validation failed'
      };
      
      const result = validator.addValidationRule('test-rule', rule);
      
      expect(result.name).toBe('test-rule');
      expect(result.validator).toBe(rule.validator);
      expect(result.severity).toBe('error');
      expect(validator.validationRules.has('test-rule')).toBe(true);
    });

    test('should emit validationRuleAdded event', () => {
      const eventSpy = jest.fn();
      validator.on('validationRuleAdded', eventSpy);
      
      const rule = { validator: jest.fn().mockResolvedValue({ valid: true }) };
      validator.addValidationRule('event-rule', rule);
      
      expect(eventSpy).toHaveBeenCalledWith({
        name: 'event-rule',
        rule: expect.objectContaining({ name: 'event-rule' })
      });
    });

    test('should reject invalid rule name', () => {
      const rule = { validator: jest.fn() };
      
      expect(() => validator.addValidationRule('', rule)).toThrow('Validation rule name must be a non-empty string');
      expect(() => validator.addValidationRule(null, rule)).toThrow('Validation rule name must be a non-empty string');
    });

    test('should reject invalid rule object', () => {
      expect(() => validator.addValidationRule('test', null)).toThrow('Validation rule must be an object');
      expect(() => validator.addValidationRule('test', 'not-object')).toThrow('Validation rule must be an object');
    });
  });

  describe('Safety Check Management', () => {
    test('should add safety check successfully', () => {
      const check = {
        checker: jest.fn().mockResolvedValue({ safe: true }),
        severity: 'warning',
        blocking: false
      };
      
      const result = validator.addSafetyCheck('test-safety', check);
      
      expect(result.name).toBe('test-safety');
      expect(result.checker).toBe(check.checker);
      expect(result.blocking).toBe(false);
      expect(validator.safetyChecks.has('test-safety')).toBe(true);
    });

    test('should set default blocking to true', () => {
      const check = { checker: jest.fn().mockResolvedValue({ safe: true }) };
      
      const result = validator.addSafetyCheck('blocking-check', check);
      
      expect(result.blocking).toBe(true);
    });
  });

  describe('Security Policy Management', () => {
    test('should add security policy successfully', () => {
      const policy = {
        enforcer: jest.fn().mockResolvedValue({ compliant: true }),
        message: 'Security policy violated'
      };
      
      const result = validator.addSecurityPolicy('test-policy', policy);
      
      expect(result.name).toBe('test-policy');
      expect(result.enforcer).toBe(policy.enforcer);
      expect(result.severity).toBe('error');
      expect(validator.securityPolicies.has('test-policy')).toBe(true);
    });
  });

  describe('Hook Structure Validation', () => {
    test('should validate valid hook structure', async () => {
      const hookConfig = {
        name: 'valid-hook',
        function: jest.fn(),
        timeout: 5000,
        priority: 1,
        dependencies: ['other-hook']
      };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing hook name', async () => {
      const hookConfig = {
        function: jest.fn()
      };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'structure',
          message: 'Hook must have a valid name'
        })
      );
    });

    test('should detect missing hook function', async () => {
      const hookConfig = {
        name: 'test-hook'
      };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'structure',
          message: 'Hook must have a valid function'
        })
      );
    });

    test('should detect invalid timeout', async () => {
      const hookConfig = {
        name: 'test-hook',
        function: jest.fn(),
        timeout: -1000
      };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'structure',
          message: 'Hook timeout must be a positive number'
        })
      );
    });

    test('should warn about invalid priority type', async () => {
      const hookConfig = {
        name: 'test-hook',
        function: jest.fn(),
        priority: 'high'
      };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'structure',
          message: 'Hook priority should be a number'
        })
      );
    });

    test('should detect invalid dependencies type', async () => {
      const hookConfig = {
        name: 'test-hook',
        function: jest.fn(),
        dependencies: 'not-array'
      };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'structure',
          message: 'Hook dependencies must be an array'
        })
      );
    });
  });

  describe('Validation Rules Execution', () => {
    test('should run validation rules successfully', async () => {
      const mockValidator = jest.fn().mockResolvedValue({ valid: true });
      validator.addValidationRule('test-rule', {
        validator: mockValidator,
        severity: 'error'
      });
      
      const hookConfig = { name: 'test-hook', function: jest.fn() };
      const context = { test: true };
      
      const result = await validator.validateHook(hookConfig, context);
      
      expect(mockValidator).toHaveBeenCalledWith(hookConfig, context);
      expect(result.valid).toBe(true);
    });

    test('should handle validation rule failures', async () => {
      const mockValidator = jest.fn().mockResolvedValue({ 
        valid: false, 
        message: 'Custom validation failed' 
      });
      validator.addValidationRule('failing-rule', {
        validator: mockValidator,
        severity: 'error'
      });
      
      const hookConfig = { name: 'test-hook', function: jest.fn() };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'validation',
          rule: 'failing-rule',
          message: 'Custom validation failed'
        })
      );
    });

    test('should handle validation rule exceptions', async () => {
      const mockValidator = jest.fn().mockRejectedValue(new Error('Validator crashed'));
      validator.addValidationRule('crashing-rule', {
        validator: mockValidator,
        severity: 'error'
      });
      
      const hookConfig = { name: 'test-hook', function: jest.fn() };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'validation',
          rule: 'crashing-rule',
          message: "Validation rule 'crashing-rule' failed: Validator crashed"
        })
      );
    });

    test('should skip disabled validation rules', async () => {
      const mockValidator = jest.fn().mockResolvedValue({ valid: false });
      validator.addValidationRule('disabled-rule', {
        validator: mockValidator,
        enabled: false
      });
      
      const hookConfig = { name: 'test-hook', function: jest.fn() };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(mockValidator).not.toHaveBeenCalled();
      expect(result.valid).toBe(true);
    });
  });

  describe('Safety Checks Execution', () => {
    test('should run safety checks successfully', async () => {
      const mockChecker = jest.fn().mockResolvedValue({ safe: true });
      validator.addSafetyCheck('test-safety', {
        checker: mockChecker,
        blocking: false
      });
      
      const hookConfig = { name: 'test-hook', function: jest.fn() };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(mockChecker).toHaveBeenCalledWith(hookConfig, {});
      expect(result.valid).toBe(true);
      expect(result.safetyIssues).toHaveLength(0);
    });

    test('should handle non-blocking safety issues', async () => {
      const mockChecker = jest.fn().mockResolvedValue({ 
        safe: false, 
        message: 'Non-critical safety issue' 
      });
      validator.addSafetyCheck('non-blocking-safety', {
        checker: mockChecker,
        blocking: false
      });
      
      const hookConfig = { name: 'test-hook', function: jest.fn() };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.valid).toBe(true); // Non-blocking doesn't affect validity
      expect(result.safetyIssues).toContainEqual(
        expect.objectContaining({
          type: 'safety',
          check: 'non-blocking-safety',
          blocking: false
        })
      );
    });

    test('should handle blocking safety issues', async () => {
      const mockChecker = jest.fn().mockResolvedValue({ 
        safe: false, 
        message: 'Critical safety issue' 
      });
      validator.addSafetyCheck('blocking-safety', {
        checker: mockChecker,
        blocking: true
      });
      
      const hookConfig = { name: 'test-hook', function: jest.fn() };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.valid).toBe(false); // Blocking affects validity
      expect(result.safetyIssues).toContainEqual(
        expect.objectContaining({
          type: 'safety',
          check: 'blocking-safety',
          blocking: true
        })
      );
    });
  });

  describe('Security Policy Execution', () => {
    test('should run security policies successfully', async () => {
      const mockEnforcer = jest.fn().mockResolvedValue({ compliant: true });
      validator.addSecurityPolicy('test-policy', {
        enforcer: mockEnforcer
      });
      
      const hookConfig = { name: 'test-hook', function: jest.fn() };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(mockEnforcer).toHaveBeenCalledWith(hookConfig, {});
      expect(result.valid).toBe(true);
      expect(result.securityViolations).toHaveLength(0);
    });

    test('should handle security policy violations', async () => {
      const mockEnforcer = jest.fn().mockResolvedValue({ 
        compliant: false, 
        message: 'Security policy violated' 
      });
      validator.addSecurityPolicy('security-policy', {
        enforcer: mockEnforcer
      });
      
      const hookConfig = { name: 'test-hook', function: jest.fn() };
      
      const result = await validator.validateHook(hookConfig);
      
      expect(result.valid).toBe(false);
      expect(result.securityViolations).toContainEqual(
        expect.objectContaining({
          type: 'security',
          policy: 'security-policy',
          message: 'Security policy violated'
        })
      );
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid configuration', async () => {
      const config = {
        securityLevel: 'medium',
        maxHookComplexity: 100,
        maxExecutionTime: 30000,
        enableCaching: true,
        strictMode: false,
        allowUnsafeOperations: false
      };
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedConfig).toEqual(config);
    });

    test('should detect invalid security level', async () => {
      const config = { securityLevel: 'invalid-level' };
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'securityLevel',
          message: 'Invalid security level. Must be one of: low, medium, high, strict'
        })
      );
    });

    test('should detect invalid numeric fields', async () => {
      const config = { 
        maxHookComplexity: -10,
        maxExecutionTime: 'not-a-number'
      };
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    test('should normalize boolean fields', async () => {
      const config = { 
        enableCaching: 'true',
        strictMode: 1,
        allowUnsafeOperations: 0
      };
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.warnings).toHaveLength(3);
      expect(result.normalizedConfig.enableCaching).toBe(true);
      expect(result.normalizedConfig.strictMode).toBe(true);
      expect(result.normalizedConfig.allowUnsafeOperations).toBe(false);
    });
  });

  describe('Caching and Performance', () => {
    test('should cache validation results', async () => {
      validator.config.enableCaching = true;
      
      const hookConfig = { name: 'cached-hook', function: jest.fn() };
      
      // First validation
      const result1 = await validator.validateHook(hookConfig);
      
      // Second validation should use cache
      const cacheHitSpy = jest.fn();
      validator.on('validationCacheHit', cacheHitSpy);
      
      const result2 = await validator.validateHook(hookConfig);
      
      expect(cacheHitSpy).toHaveBeenCalled();
      expect(result1).toEqual(result2);
    });

    test('should clear cache when requested', () => {
      validator.validationCache.set('test-key', { valid: true });
      
      expect(validator.validationCache.size).toBe(1);
      
      validator.clearCache();
      
      expect(validator.validationCache.size).toBe(0);
    });
  });

  describe('Batch Validation', () => {
    test('should validate multiple hooks', async () => {
      const hooks = [
        { name: 'hook1', function: jest.fn() },
        { name: 'hook2', function: jest.fn() },
        { name: 'hook3' } // Invalid hook
      ];
      
      const results = await validator.validateHooks(hooks);
      
      expect(results.size).toBe(3);
      expect(results.get('hook1').valid).toBe(true);
      expect(results.get('hook2').valid).toBe(true);
      expect(results.get('hook3').valid).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track validation statistics', async () => {
      const hookConfig = { name: 'stats-hook', function: jest.fn() };
      
      await validator.validateHook(hookConfig);
      await validator.validateHook(hookConfig);
      
      const stats = validator.getStatistics();
      
      expect(stats.totalValidations).toBe(2);
      expect(stats.passedValidations).toBe(2);
      expect(stats.validationSuccessRate).toBe(100);
    });

    test('should track failed validations', async () => {
      const hookConfig = { name: 'invalid-hook' }; // Missing function
      
      await validator.validateHook(hookConfig);
      
      const stats = validator.getStatistics();
      
      expect(stats.totalValidations).toBe(1);
      expect(stats.failedValidations).toBe(1);
      expect(stats.validationSuccessRate).toBe(0);
    });
  });

  describe('Event Emission', () => {
    test('should emit hookValidated event', async () => {
      const eventSpy = jest.fn();
      validator.on('hookValidated', eventSpy);
      
      const hookConfig = { name: 'event-hook', function: jest.fn() };
      
      await validator.validateHook(hookConfig);
      
      expect(eventSpy).toHaveBeenCalledWith({
        hookName: 'event-hook',
        result: expect.objectContaining({ valid: true }),
        context: {}
      });
    });

    test('should emit validationError event on exceptions', async () => {
      const eventSpy = jest.fn();
      validator.on('validationError', eventSpy);
      
      // Force an error by providing invalid input that causes an exception
      const invalidHook = null;
      
      try {
        await validator.validateHook(invalidHook);
      } catch (error) {
        // Expected to throw
      }
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Benchmarks', () => {
    test('should validate hooks within performance thresholds', async () => {
      const hookConfig = { name: 'perf-hook', function: jest.fn() };
      
      const startTime = Date.now();
      await validator.validateHook(hookConfig);
      const validationTime = Date.now() - startTime;
      
      expect(validationTime).toBeLessThan(100); // Should validate within 100ms
    });

    test('should handle concurrent validations efficiently', async () => {
      const hooks = [];
      for (let i = 0; i < 20; i++) {
        hooks.push({ name: `concurrent-hook-${i}`, function: jest.fn() });
      }
      
      const startTime = Date.now();
      const promises = hooks.map(hook => validator.validateHook(hook));
      await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(500); // Should complete within 500ms
    });
  });
}); 