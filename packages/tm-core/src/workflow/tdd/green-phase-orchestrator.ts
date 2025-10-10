/**
 * GreenPhaseOrchestrator - Coordinates the GREEN phase of TDD cycle
 *
 * The GREEN phase ensures that implementation code makes all tests pass,
 * validating that functionality has been correctly implemented.
 */

import type { TestResultValidator } from '../../services/test-result-validator.js';
import type { SubtaskContext, TestResults } from './red-phase-orchestrator.js';

export interface GreenPhaseResult {
  success: boolean;
  phase: 'GREEN';
  allTestsPass: boolean;
  failureCount: number;
  passCount: number;
  totalTests: number;
  attemptNumber: number;
  feedback?: string;
  error?: string;
  timestamp: Date;
}

export class GreenPhaseOrchestrator {
  constructor(private testValidator: TestResultValidator) {}

  /**
   * Execute the GREEN phase: implement code and validate all tests pass
   */
  async executeGreenPhase(
    subtaskContext: SubtaskContext,
    implementationCode: string,
    attemptNumber: number
  ): Promise<GreenPhaseResult> {
    try {
      // Validate implementation code is provided
      if (!implementationCode || implementationCode.trim().length === 0) {
        return {
          success: false,
          phase: 'GREEN',
          allTestsPass: false,
          failureCount: 0,
          passCount: 0,
          totalTests: 0,
          attemptNumber,
          error: 'No implementation code provided',
          timestamp: new Date()
        };
      }

      // Run tests using TestResultValidator
      const testResults = await this.testValidator.validateTestResults(implementationCode);

      // Validate GREEN phase requirements
      const isValid = this.validateGreenRequirements(testResults);

      // Return result with feedback
      return this.getPhaseResult(testResults, isValid, attemptNumber);
    } catch (error) {
      return {
        success: false,
        phase: 'GREEN',
        allTestsPass: false,
        failureCount: 0,
        passCount: 0,
        totalTests: 0,
        attemptNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate that GREEN phase requirements are met
   * Requirements:
   * - All tests must pass
   * - Tests must actually exist
   */
  validateGreenRequirements(testResults: TestResults): boolean {
    // Must have at least one test
    if (testResults.totalTests === 0) {
      return false;
    }

    // All tests must pass (GREEN requirement)
    if (testResults.hasFailures || testResults.failureCount > 0) {
      return false;
    }

    // Ensure passed flag is true
    if (!testResults.passed) {
      return false;
    }

    return true;
  }

  /**
   * Format phase result with test outcomes and feedback
   */
  getPhaseResult(
    testResults: TestResults,
    isValid: boolean,
    attemptNumber: number
  ): GreenPhaseResult {
    const feedback = this.provideFeedback(testResults, attemptNumber);

    return {
      success: isValid,
      phase: 'GREEN',
      allTestsPass: !testResults.hasFailures,
      failureCount: testResults.failureCount,
      passCount: testResults.passCount,
      totalTests: testResults.totalTests,
      attemptNumber,
      feedback,
      error: isValid
        ? undefined
        : 'GREEN phase requires all tests to pass. Some tests are still failing.',
      timestamp: new Date()
    };
  }

  /**
   * Provide actionable feedback for implementation
   */
  provideFeedback(testResults: TestResults, attemptNumber: number): string {
    if (testResults.passed && !testResults.hasFailures) {
      return `All ${testResults.totalTests} tests passing. GREEN phase complete!`;
    }

    return `Attempt ${attemptNumber}: ${testResults.failureCount} test(s) still failing out of ${testResults.totalTests} total (${testResults.passCount} passing). Review failing tests and adjust implementation.`;
  }
}
