import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedPhaseOrchestrator } from './red-phase-orchestrator.js';
import type { TestResultValidator } from '../../services/test-result-validator.js';

describe('RedPhaseOrchestrator', () => {
  let orchestrator: RedPhaseOrchestrator;
  let mockTestValidator: TestResultValidator;

  beforeEach(() => {
    // Mock test validator
    mockTestValidator = {
      validateTestResults: vi.fn()
    } as unknown as TestResultValidator;

    orchestrator = new RedPhaseOrchestrator(mockTestValidator);
  });

  describe('executeRedPhase', () => {
    it('should execute RED phase with generated tests', async () => {
      const subtaskContext = {
        taskId: '6.1',
        subtaskId: '6.1.1',
        description: 'Test RED phase',
        requirements: 'Implement feature X'
      };

      const testCode = `
        describe('Feature X', () => {
          it('should fail initially', () => {
            expect(true).toBe(false);
          });
        });
      `;

      vi.mocked(mockTestValidator.validateTestResults).mockResolvedValue({
        passed: false,
        failureCount: 1,
        passCount: 0,
        totalTests: 1,
        hasFailures: true
      });

      const result = await orchestrator.executeRedPhase(subtaskContext, testCode);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('RED');
      expect(result.testsGenerated).toBe(true);
      expect(result.hasFailures).toBe(true);
      expect(mockTestValidator.validateTestResults).toHaveBeenCalled();
    });

    it('should fail validation when no tests fail (not RED)', async () => {
      const subtaskContext = {
        taskId: '6.1',
        subtaskId: '6.1.1',
        description: 'Test RED phase'
      };

      const testCode = `
        describe('Feature', () => {
          it('should pass', () => {
            expect(true).toBe(true);
          });
        });
      `;

      vi.mocked(mockTestValidator.validateTestResults).mockResolvedValue({
        passed: true,
        failureCount: 0,
        passCount: 1,
        totalTests: 1,
        hasFailures: false
      });

      const result = await orchestrator.executeRedPhase(subtaskContext, testCode);

      expect(result.success).toBe(false);
      expect(result.error).toContain('RED phase requires at least one failing test');
    });

    it('should handle empty test code', async () => {
      const subtaskContext = {
        taskId: '6.1',
        subtaskId: '6.1.1',
        description: 'Test RED phase'
      };

      const result = await orchestrator.executeRedPhase(subtaskContext, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No test code provided');
    });

    it('should handle test execution errors', async () => {
      const subtaskContext = {
        taskId: '6.1',
        subtaskId: '6.1.1',
        description: 'Test RED phase'
      };

      const testCode = 'invalid test code';

      vi.mocked(mockTestValidator.validateTestResults).mockRejectedValue(
        new Error('Compilation error')
      );

      const result = await orchestrator.executeRedPhase(subtaskContext, testCode);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Compilation error');
    });
  });

  describe('validateRedRequirements', () => {
    it('should validate RED phase requirements', () => {
      const testResults = {
        passed: false,
        failureCount: 2,
        passCount: 0,
        totalTests: 2,
        hasFailures: true
      };

      const isValid = orchestrator.validateRedRequirements(testResults);

      expect(isValid).toBe(true);
    });

    it('should reject when all tests pass', () => {
      const testResults = {
        passed: true,
        failureCount: 0,
        passCount: 5,
        totalTests: 5,
        hasFailures: false
      };

      const isValid = orchestrator.validateRedRequirements(testResults);

      expect(isValid).toBe(false);
    });

    it('should reject when no tests exist', () => {
      const testResults = {
        passed: true,
        failureCount: 0,
        passCount: 0,
        totalTests: 0,
        hasFailures: false
      };

      const isValid = orchestrator.validateRedRequirements(testResults);

      expect(isValid).toBe(false);
    });

    it('should accept mixed pass/fail results as long as some fail', () => {
      const testResults = {
        passed: false,
        failureCount: 1,
        passCount: 4,
        totalTests: 5,
        hasFailures: true
      };

      const isValid = orchestrator.validateRedRequirements(testResults);

      expect(isValid).toBe(true);
    });
  });

  describe('getPhaseResult', () => {
    it('should return formatted phase result', () => {
      const testResults = {
        passed: false,
        failureCount: 3,
        passCount: 0,
        totalTests: 3,
        hasFailures: true
      };

      const result = orchestrator.getPhaseResult(testResults, true);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('RED');
      expect(result.failureCount).toBe(3);
      expect(result.totalTests).toBe(3);
      expect(result.hasFailures).toBe(true);
    });

    it('should include error when validation fails', () => {
      const testResults = {
        passed: true,
        failureCount: 0,
        passCount: 2,
        totalTests: 2,
        hasFailures: false
      };

      const result = orchestrator.getPhaseResult(testResults, false);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very large test suites', async () => {
      const subtaskContext = {
        taskId: '6.1',
        subtaskId: '6.1.1',
        description: 'Large test suite'
      };

      const testCode = 'large test suite...';

      vi.mocked(mockTestValidator.validateTestResults).mockResolvedValue({
        passed: false,
        failureCount: 50,
        passCount: 0,
        totalTests: 50,
        hasFailures: true
      });

      const result = await orchestrator.executeRedPhase(subtaskContext, testCode);

      expect(result.success).toBe(true);
      expect(result.failureCount).toBe(50);
    });

    it('should handle test timeout scenarios', async () => {
      const subtaskContext = {
        taskId: '6.1',
        subtaskId: '6.1.1',
        description: 'Timeout test'
      };

      vi.mocked(mockTestValidator.validateTestResults).mockRejectedValue(
        new Error('Test execution timeout')
      );

      const result = await orchestrator.executeRedPhase(subtaskContext, 'test code');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
});
