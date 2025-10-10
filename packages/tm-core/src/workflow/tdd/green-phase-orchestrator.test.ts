import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GreenPhaseOrchestrator } from './green-phase-orchestrator.js';
import type { TestResultValidator } from '../../services/test-result-validator.js';

describe('GreenPhaseOrchestrator', () => {
	let orchestrator: GreenPhaseOrchestrator;
	let mockTestValidator: TestResultValidator;

	beforeEach(() => {
		mockTestValidator = {
			validateTestResults: vi.fn()
		} as unknown as TestResultValidator;

		orchestrator = new GreenPhaseOrchestrator(mockTestValidator);
	});

	describe('executeGreenPhase', () => {
		it('should execute GREEN phase with passing tests', async () => {
			const subtaskContext = {
				taskId: '6.2',
				subtaskId: '6.2.1',
				description: 'Test GREEN phase'
			};

			const implementationCode = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

			vi.mocked(mockTestValidator.validateTestResults).mockResolvedValue({
				passed: true,
				failureCount: 0,
				passCount: 5,
				totalTests: 5,
				hasFailures: false
			});

			const result = await orchestrator.executeGreenPhase(
				subtaskContext,
				implementationCode,
				1
			);

			expect(result.success).toBe(true);
			expect(result.phase).toBe('GREEN');
			expect(result.allTestsPass).toBe(true);
			expect(result.attemptNumber).toBe(1);
		});

		it('should fail when tests still failing', async () => {
			const subtaskContext = {
				taskId: '6.2',
				subtaskId: '6.2.1',
				description: 'Test GREEN phase'
			};

			vi.mocked(mockTestValidator.validateTestResults).mockResolvedValue({
				passed: false,
				failureCount: 2,
				passCount: 3,
				totalTests: 5,
				hasFailures: true
			});

			const result = await orchestrator.executeGreenPhase(
				subtaskContext,
				'incomplete code',
				1
			);

			expect(result.success).toBe(false);
			expect(result.allTestsPass).toBe(false);
			expect(result.error).toContain('GREEN phase requires all tests to pass');
		});

		it('should track attempt numbers', async () => {
			const subtaskContext = {
				taskId: '6.2',
				subtaskId: '6.2.1',
				description: 'Test GREEN phase'
			};

			vi.mocked(mockTestValidator.validateTestResults).mockResolvedValue({
				passed: true,
				failureCount: 0,
				passCount: 3,
				totalTests: 3,
				hasFailures: false
			});

			const result = await orchestrator.executeGreenPhase(
				subtaskContext,
				'code',
				5
			);

			expect(result.attemptNumber).toBe(5);
		});

		it('should handle empty implementation code', async () => {
			const subtaskContext = {
				taskId: '6.2',
				subtaskId: '6.2.1',
				description: 'Test GREEN phase'
			};

			const result = await orchestrator.executeGreenPhase(
				subtaskContext,
				'',
				1
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain('No implementation code provided');
		});

		it('should handle test execution errors', async () => {
			const subtaskContext = {
				taskId: '6.2',
				subtaskId: '6.2.1',
				description: 'Test GREEN phase'
			};

			vi.mocked(mockTestValidator.validateTestResults).mockRejectedValue(
				new Error('Runtime error')
			);

			const result = await orchestrator.executeGreenPhase(
				subtaskContext,
				'buggy code',
				1
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Runtime error');
		});
	});

	describe('validateGreenRequirements', () => {
		it('should validate all tests pass', () => {
			const testResults = {
				passed: true,
				failureCount: 0,
				passCount: 10,
				totalTests: 10,
				hasFailures: false
			};

			const isValid = orchestrator.validateGreenRequirements(testResults);

			expect(isValid).toBe(true);
		});

		it('should reject when tests fail', () => {
			const testResults = {
				passed: false,
				failureCount: 1,
				passCount: 9,
				totalTests: 10,
				hasFailures: true
			};

			const isValid = orchestrator.validateGreenRequirements(testResults);

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

			const isValid = orchestrator.validateGreenRequirements(testResults);

			expect(isValid).toBe(false);
		});

		it('should require zero failures', () => {
			const testResults = {
				passed: false,
				failureCount: 1,
				passCount: 0,
				totalTests: 1,
				hasFailures: true
			};

			const isValid = orchestrator.validateGreenRequirements(testResults);

			expect(isValid).toBe(false);
		});
	});

	describe('getPhaseResult', () => {
		it('should return formatted phase result', () => {
			const testResults = {
				passed: true,
				failureCount: 0,
				passCount: 8,
				totalTests: 8,
				hasFailures: false
			};

			const result = orchestrator.getPhaseResult(testResults, true, 2);

			expect(result.success).toBe(true);
			expect(result.phase).toBe('GREEN');
			expect(result.allTestsPass).toBe(true);
			expect(result.passCount).toBe(8);
			expect(result.attemptNumber).toBe(2);
		});

		it('should include error when validation fails', () => {
			const testResults = {
				passed: false,
				failureCount: 3,
				passCount: 2,
				totalTests: 5,
				hasFailures: true
			};

			const result = orchestrator.getPhaseResult(testResults, false, 1);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.failureCount).toBe(3);
		});

		it('should include feedback for failing tests', () => {
			const testResults = {
				passed: false,
				failureCount: 2,
				passCount: 3,
				totalTests: 5,
				hasFailures: true
			};

			const result = orchestrator.getPhaseResult(testResults, false, 3);

			expect(result.feedback).toContain('2 test(s) still failing');
			expect(result.feedback).toContain('Attempt 3');
		});
	});

	describe('provideFeedback', () => {
		it('should provide feedback for failing tests', () => {
			const testResults = {
				passed: false,
				failureCount: 3,
				passCount: 7,
				totalTests: 10,
				hasFailures: true
			};

			const feedback = orchestrator.provideFeedback(testResults, 2);

			expect(feedback).toContain('3 test(s) still failing');
			expect(feedback).toContain('7 passing');
			expect(feedback).toContain('Attempt 2');
		});

		it('should provide positive feedback for passing tests', () => {
			const testResults = {
				passed: true,
				failureCount: 0,
				passCount: 10,
				totalTests: 10,
				hasFailures: false
			};

			const feedback = orchestrator.provideFeedback(testResults, 1);

			expect(feedback).toContain('All 10 tests passing');
		});
	});

	describe('edge cases', () => {
		it('should handle large test suites in GREEN phase', async () => {
			const subtaskContext = {
				taskId: '6.2',
				subtaskId: '6.2.1',
				description: 'Large test suite'
			};

			vi.mocked(mockTestValidator.validateTestResults).mockResolvedValue({
				passed: true,
				failureCount: 0,
				passCount: 200,
				totalTests: 200,
				hasFailures: false
			});

			const result = await orchestrator.executeGreenPhase(
				subtaskContext,
				'code',
				1
			);

			expect(result.success).toBe(true);
			expect(result.passCount).toBe(200);
		});

		it('should handle high attempt numbers', async () => {
			const subtaskContext = {
				taskId: '6.2',
				subtaskId: '6.2.1',
				description: 'Many attempts'
			};

			vi.mocked(mockTestValidator.validateTestResults).mockResolvedValue({
				passed: true,
				failureCount: 0,
				passCount: 5,
				totalTests: 5,
				hasFailures: false
			});

			const result = await orchestrator.executeGreenPhase(
				subtaskContext,
				'code',
				20
			);

			expect(result.attemptNumber).toBe(20);
		});
	});
});
