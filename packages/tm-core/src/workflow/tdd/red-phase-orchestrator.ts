/**
 * RedPhaseOrchestrator - Coordinates the RED phase of TDD cycle
 *
 * The RED phase ensures that tests are written first and initially fail,
 * validating that we're testing for actual functionality that doesn't exist yet.
 */

import type { TestResultValidator } from '../../services/test-result-validator.js';

export interface SubtaskContext {
	taskId: string;
	subtaskId: string;
	description: string;
	requirements?: string;
}

export interface RedPhaseResult {
	success: boolean;
	phase: 'RED';
	testsGenerated: boolean;
	hasFailures: boolean;
	failureCount: number;
	passCount: number;
	totalTests: number;
	error?: string;
	timestamp: Date;
}

export interface TestResults {
	passed: boolean;
	failureCount: number;
	passCount: number;
	totalTests: number;
	hasFailures: boolean;
}

export class RedPhaseOrchestrator {
	constructor(private testValidator: TestResultValidator) {}

	/**
	 * Execute the RED phase: generate tests and validate they fail
	 */
	async executeRedPhase(
		subtaskContext: SubtaskContext,
		testCode: string
	): Promise<RedPhaseResult> {
		try {
			// Validate test code is provided
			if (!testCode || testCode.trim().length === 0) {
				return {
					success: false,
					phase: 'RED',
					testsGenerated: false,
					hasFailures: false,
					failureCount: 0,
					passCount: 0,
					totalTests: 0,
					error: 'No test code provided',
					timestamp: new Date()
				};
			}

			// Run tests using TestResultValidator
			const testResults =
				await this.testValidator.validateTestResults(testCode);

			// Validate RED phase requirements
			const isValid = this.validateRedRequirements(testResults);

			// Return result
			return this.getPhaseResult(testResults, isValid);
		} catch (error) {
			return {
				success: false,
				phase: 'RED',
				testsGenerated: true,
				hasFailures: false,
				failureCount: 0,
				passCount: 0,
				totalTests: 0,
				error: error instanceof Error ? error.message : 'Unknown error',
				timestamp: new Date()
			};
		}
	}

	/**
	 * Validate that RED phase requirements are met
	 * Requirements:
	 * - At least one test must fail
	 * - Tests must actually exist
	 */
	validateRedRequirements(testResults: TestResults): boolean {
		// Must have at least one test
		if (testResults.totalTests === 0) {
			return false;
		}

		// At least one test must fail (RED requirement)
		if (!testResults.hasFailures || testResults.failureCount === 0) {
			return false;
		}

		return true;
	}

	/**
	 * Format phase result with test outcomes
	 */
	getPhaseResult(testResults: TestResults, isValid: boolean): RedPhaseResult {
		return {
			success: isValid,
			phase: 'RED',
			testsGenerated: true,
			hasFailures: testResults.hasFailures,
			failureCount: testResults.failureCount,
			passCount: testResults.passCount,
			totalTests: testResults.totalTests,
			error: isValid
				? undefined
				: 'RED phase requires at least one failing test. All tests passed or no tests found.',
			timestamp: new Date()
		};
	}
}
