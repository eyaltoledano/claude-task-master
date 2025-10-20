import { z } from 'zod';
import type {
	TestResult,
	ValidationResult,
	CoverageThresholds,
	PhaseValidationOptions
} from './test-result-validator.types.js';

/**
 * Schema for coverage metrics validation
 */
const coverageSchema = z.object({
	line: z.number().min(0).max(100),
	branch: z.number().min(0).max(100),
	function: z.number().min(0).max(100),
	statement: z.number().min(0).max(100)
});

/**
 * Schema for test result validation
 */
const testResultSchema = z.object({
	total: z.number().int().nonnegative(),
	passed: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	skipped: z.number().int().nonnegative(),
	phase: z.enum(['RED', 'GREEN', 'REFACTOR']),
	coverage: coverageSchema.optional()
});

/**
 * Validates test results according to TDD phase semantics
 */
export class TestResultValidator {
	/**
	 * Validates a test result object
	 */
	validate(testResult: TestResult): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		const suggestions: string[] = [];

		// Schema validation
		const parseResult = testResultSchema.safeParse(testResult);
		if (!parseResult.success) {
			const zodIssues = parseResult.error.issues || [];
			errors.push(
				...zodIssues.map((e) => {
					const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
					return `${path}${e.message}`;
				})
			);
			return { valid: false, errors, warnings, suggestions };
		}

		// Total validation
		const sum = testResult.passed + testResult.failed + testResult.skipped;
		if (sum !== testResult.total) {
			errors.push('Total tests must equal passed + failed + skipped');
		}

		// If there are validation errors, return early
		if (errors.length > 0) {
			return { valid: false, errors, warnings, suggestions };
		}

		return { valid: true, errors, warnings, suggestions };
	}

	/**
	 * Validates RED phase test results
	 * RED phase must have at least one failing test
	 */
	validateRedPhase(testResult: TestResult): ValidationResult {
		const baseValidation = this.validate(testResult);
		if (!baseValidation.valid) {
			return baseValidation;
		}

		const errors: string[] = [];
		const suggestions: string[] = [];

		// RED phase must have failures
		if (testResult.failed === 0) {
			errors.push('RED phase must have at least one failing test');
			suggestions.push('Write failing tests first to follow TDD workflow');
		}

		// Must have at least one test
		if (testResult.total === 0) {
			errors.push('Cannot validate empty test suite');
			suggestions.push('Add at least one test to begin TDD cycle');
		}

		return {
			valid: errors.length === 0,
			errors,
			suggestions
		};
	}

	/**
	 * Validates GREEN phase test results
	 * GREEN phase must have zero failures
	 */
	validateGreenPhase(
		testResult: TestResult,
		previousTestCount?: number
	): ValidationResult {
		const baseValidation = this.validate(testResult);
		if (!baseValidation.valid) {
			return baseValidation;
		}

		const errors: string[] = [];
		const warnings: string[] = [];
		const suggestions: string[] = [];

		// GREEN phase must have zero failures
		if (testResult.failed > 0) {
			errors.push('GREEN phase must have zero failures');
			suggestions.push('Fix implementation to make all tests pass');
		}

		// Must have at least one passing test
		if (testResult.passed === 0) {
			errors.push('GREEN phase must have at least one passing test');
			suggestions.push('Ensure tests exist and implementation makes them pass');
		}

		// Check for test count regression
		if (
			previousTestCount !== undefined &&
			testResult.total < previousTestCount
		) {
			warnings.push(
				`Test count decreased from ${previousTestCount} to ${testResult.total}`
			);
			suggestions.push('Verify that no tests were accidentally removed');
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
			suggestions
		};
	}

	/**
	 * Validates coverage thresholds if provided
	 */
	validateCoverage(
		testResult: TestResult,
		thresholds: CoverageThresholds
	): ValidationResult {
		const baseValidation = this.validate(testResult);
		if (!baseValidation.valid) {
			return baseValidation;
		}

		const errors: string[] = [];
		const suggestions: string[] = [];

		// Skip validation if no coverage data
		if (!testResult.coverage) {
			return { valid: true, errors: [], suggestions: [] };
		}

		const coverage = testResult.coverage;
		const gaps: string[] = [];

		// Check each coverage type against threshold
		if (thresholds.line !== undefined && coverage.line < thresholds.line) {
			gaps.push(`line coverage (${coverage.line}% < ${thresholds.line}%)`);
		}

		if (
			thresholds.branch !== undefined &&
			coverage.branch < thresholds.branch
		) {
			gaps.push(
				`branch coverage (${coverage.branch}% < ${thresholds.branch}%)`
			);
		}

		if (
			thresholds.function !== undefined &&
			coverage.function < thresholds.function
		) {
			gaps.push(
				`function coverage (${coverage.function}% < ${thresholds.function}%)`
			);
		}

		if (
			thresholds.statement !== undefined &&
			coverage.statement < thresholds.statement
		) {
			gaps.push(
				`statement coverage (${coverage.statement}% < ${thresholds.statement}%)`
			);
		}

		if (gaps.length > 0) {
			errors.push(`Coverage thresholds not met: ${gaps.join(', ')}`);
			suggestions.push('Add more tests to improve code coverage');
		}

		return {
			valid: errors.length === 0,
			errors,
			suggestions
		};
	}

	/**
	 * Validates test results based on TDD phase
	 */
	validatePhase(
		testResult: TestResult,
		options?: PhaseValidationOptions
	): ValidationResult {
		const phase = options?.phase ?? testResult.phase;

		// Phase-specific validation
		let phaseResult: ValidationResult;
		if (phase === 'RED') {
			phaseResult = this.validateRedPhase(testResult);
		} else if (phase === 'GREEN') {
			phaseResult = this.validateGreenPhase(
				testResult,
				options?.previousTestCount
			);
		} else {
			// REFACTOR phase uses same rules as GREEN
			phaseResult = this.validateGreenPhase(
				testResult,
				options?.previousTestCount
			);
		}

		if (!phaseResult.valid) {
			return phaseResult;
		}

		// Coverage validation if thresholds provided
		if (options?.coverageThresholds) {
			const coverageResult = this.validateCoverage(
				testResult,
				options.coverageThresholds
			);

			// Merge results
			return {
				valid: coverageResult.valid,
				errors: [...(phaseResult.errors || []), ...coverageResult.errors],
				warnings: phaseResult.warnings,
				suggestions: [
					...(phaseResult.suggestions || []),
					...(coverageResult.suggestions || [])
				]
			};
		}

		return phaseResult;
	}
}
