import { describe, it, expect } from 'vitest';
import { TestResultValidator } from './test-result-validator.js';
import type {
	TestResult,
	ValidationResult,
	TestPhase
} from './test-result-validator.types.js';

describe('TestResultValidator - Input Validation', () => {
	const validator = new TestResultValidator();

	describe('Schema Validation', () => {
		it('should validate a valid test result', () => {
			const validResult: TestResult = {
				total: 10,
				passed: 5,
				failed: 5,
				skipped: 0,
				phase: 'RED'
			};

			const result = validator.validate(validResult);
			expect(result.valid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it('should reject negative test counts', () => {
			const invalidResult = {
				total: -1,
				passed: 0,
				failed: 0,
				skipped: 0,
				phase: 'RED'
			};

			const result = validator.validate(invalidResult as TestResult);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject when totals do not match', () => {
			const invalidResult: TestResult = {
				total: 10,
				passed: 3,
				failed: 3,
				skipped: 3, // 3 + 3 + 3 = 9, not 10
				phase: 'RED'
			};

			const result = validator.validate(invalidResult);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Total tests must equal passed + failed + skipped'
			);
		});

		it('should reject missing required fields', () => {
			const invalidResult = {
				total: 10,
				passed: 5
				// missing failed, skipped, phase
			};

			const result = validator.validate(invalidResult as TestResult);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should accept optional coverage data', () => {
			const resultWithCoverage: TestResult = {
				total: 10,
				passed: 10,
				failed: 0,
				skipped: 0,
				phase: 'GREEN',
				coverage: {
					line: 85,
					branch: 75,
					function: 90,
					statement: 85
				}
			};

			const result = validator.validate(resultWithCoverage);
			expect(result.valid).toBe(true);
		});

		it('should reject invalid coverage percentages', () => {
			const invalidResult: TestResult = {
				total: 10,
				passed: 10,
				failed: 0,
				skipped: 0,
				phase: 'GREEN',
				coverage: {
					line: 150, // Invalid: > 100
					branch: -10, // Invalid: < 0
					function: 90,
					statement: 85
				}
			};

			const result = validator.validate(invalidResult);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject invalid phase values', () => {
			const invalidResult = {
				total: 10,
				passed: 5,
				failed: 5,
				skipped: 0,
				phase: 'INVALID_PHASE'
			};

			const result = validator.validate(invalidResult as TestResult);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});
});

describe('TestResultValidator - RED Phase Validation', () => {
	const validator = new TestResultValidator();

	it('should pass validation when RED phase has failures', () => {
		const redResult: TestResult = {
			total: 10,
			passed: 5,
			failed: 5,
			skipped: 0,
			phase: 'RED'
		};

		const result = validator.validateRedPhase(redResult);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('should fail validation when RED phase has zero failures', () => {
		const redResult: TestResult = {
			total: 10,
			passed: 10,
			failed: 0,
			skipped: 0,
			phase: 'RED'
		};

		const result = validator.validateRedPhase(redResult);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			'RED phase must have at least one failing test'
		);
		expect(result.suggestions).toContain(
			'Write failing tests first to follow TDD workflow'
		);
	});

	it('should fail validation when RED phase has empty test suite', () => {
		const emptyResult: TestResult = {
			total: 0,
			passed: 0,
			failed: 0,
			skipped: 0,
			phase: 'RED'
		};

		const result = validator.validateRedPhase(emptyResult);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Cannot validate empty test suite');
		expect(result.suggestions).toContain(
			'Add at least one test to begin TDD cycle'
		);
	});

	it('should propagate base validation errors', () => {
		const invalidResult: TestResult = {
			total: 10,
			passed: 3,
			failed: 3,
			skipped: 3, // Total mismatch
			phase: 'RED'
		};

		const result = validator.validateRedPhase(invalidResult);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			'Total tests must equal passed + failed + skipped'
		);
	});
});

describe('TestResultValidator - GREEN Phase Validation', () => {
	const validator = new TestResultValidator();

	it('should pass validation when GREEN phase has all tests passing', () => {
		const greenResult: TestResult = {
			total: 10,
			passed: 10,
			failed: 0,
			skipped: 0,
			phase: 'GREEN'
		};

		const result = validator.validateGreenPhase(greenResult);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('should fail validation when GREEN phase has failures', () => {
		const greenResult: TestResult = {
			total: 10,
			passed: 5,
			failed: 5,
			skipped: 0,
			phase: 'GREEN'
		};

		const result = validator.validateGreenPhase(greenResult);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('GREEN phase must have zero failures');
		expect(result.suggestions).toContain(
			'Fix implementation to make all tests pass'
		);
	});

	it('should fail validation when GREEN phase has no passing tests', () => {
		const greenResult: TestResult = {
			total: 5,
			passed: 0,
			failed: 0,
			skipped: 5,
			phase: 'GREEN'
		};

		const result = validator.validateGreenPhase(greenResult);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			'GREEN phase must have at least one passing test'
		);
	});

	it('should warn when test count decreases', () => {
		const greenResult: TestResult = {
			total: 5,
			passed: 5,
			failed: 0,
			skipped: 0,
			phase: 'GREEN'
		};

		const result = validator.validateGreenPhase(greenResult, 10);
		expect(result.valid).toBe(true);
		expect(result.warnings).toContain('Test count decreased from 10 to 5');
		expect(result.suggestions).toContain(
			'Verify that no tests were accidentally removed'
		);
	});

	it('should not warn when test count increases', () => {
		const greenResult: TestResult = {
			total: 15,
			passed: 15,
			failed: 0,
			skipped: 0,
			phase: 'GREEN'
		};

		const result = validator.validateGreenPhase(greenResult, 10);
		expect(result.valid).toBe(true);
		expect(result.warnings || []).toEqual([]);
	});

	it('should propagate base validation errors', () => {
		const invalidResult: TestResult = {
			total: 10,
			passed: 3,
			failed: 3,
			skipped: 3, // Total mismatch
			phase: 'GREEN'
		};

		const result = validator.validateGreenPhase(invalidResult);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			'Total tests must equal passed + failed + skipped'
		);
	});
});

describe('TestResultValidator - Coverage Threshold Validation', () => {
	const validator = new TestResultValidator();

	it('should pass validation when coverage meets thresholds', () => {
		const result: TestResult = {
			total: 10,
			passed: 10,
			failed: 0,
			skipped: 0,
			phase: 'GREEN',
			coverage: {
				line: 85,
				branch: 80,
				function: 90,
				statement: 85
			}
		};

		const thresholds = {
			line: 80,
			branch: 75,
			function: 85,
			statement: 80
		};

		const validationResult = validator.validateCoverage(result, thresholds);
		expect(validationResult.valid).toBe(true);
		expect(validationResult.errors).toEqual([]);
	});

	it('should fail validation when line coverage is below threshold', () => {
		const result: TestResult = {
			total: 10,
			passed: 10,
			failed: 0,
			skipped: 0,
			phase: 'GREEN',
			coverage: {
				line: 70,
				branch: 80,
				function: 90,
				statement: 85
			}
		};

		const thresholds = {
			line: 80
		};

		const validationResult = validator.validateCoverage(result, thresholds);
		expect(validationResult.valid).toBe(false);
		expect(validationResult.errors[0]).toContain('line coverage (70% < 80%)');
		expect(validationResult.suggestions).toContain(
			'Add more tests to improve code coverage'
		);
	});

	it('should fail validation when multiple coverage types are below threshold', () => {
		const result: TestResult = {
			total: 10,
			passed: 10,
			failed: 0,
			skipped: 0,
			phase: 'GREEN',
			coverage: {
				line: 70,
				branch: 60,
				function: 75,
				statement: 65
			}
		};

		const thresholds = {
			line: 80,
			branch: 75,
			function: 85,
			statement: 80
		};

		const validationResult = validator.validateCoverage(result, thresholds);
		expect(validationResult.valid).toBe(false);
		expect(validationResult.errors[0]).toContain('line coverage (70% < 80%)');
		expect(validationResult.errors[0]).toContain('branch coverage (60% < 75%)');
		expect(validationResult.errors[0]).toContain(
			'function coverage (75% < 85%)'
		);
		expect(validationResult.errors[0]).toContain(
			'statement coverage (65% < 80%)'
		);
	});

	it('should skip validation when no coverage data is provided', () => {
		const result: TestResult = {
			total: 10,
			passed: 10,
			failed: 0,
			skipped: 0,
			phase: 'GREEN'
		};

		const thresholds = {
			line: 80,
			branch: 75
		};

		const validationResult = validator.validateCoverage(result, thresholds);
		expect(validationResult.valid).toBe(true);
		expect(validationResult.errors).toEqual([]);
	});

	it('should only validate specified threshold types', () => {
		const result: TestResult = {
			total: 10,
			passed: 10,
			failed: 0,
			skipped: 0,
			phase: 'GREEN',
			coverage: {
				line: 70,
				branch: 60,
				function: 90,
				statement: 85
			}
		};

		const thresholds = {
			line: 80
			// Only checking line coverage
		};

		const validationResult = validator.validateCoverage(result, thresholds);
		expect(validationResult.valid).toBe(false);
		expect(validationResult.errors[0]).toContain('line coverage');
		expect(validationResult.errors[0]).not.toContain('branch coverage');
	});

	it('should propagate base validation errors', () => {
		const invalidResult: TestResult = {
			total: 10,
			passed: 3,
			failed: 3,
			skipped: 3, // Total mismatch
			phase: 'GREEN',
			coverage: {
				line: 90,
				branch: 90,
				function: 90,
				statement: 90
			}
		};

		const thresholds = {
			line: 80
		};

		const validationResult = validator.validateCoverage(
			invalidResult,
			thresholds
		);
		expect(validationResult.valid).toBe(false);
		expect(validationResult.errors).toContain(
			'Total tests must equal passed + failed + skipped'
		);
	});
});
