/**
 * Test phase in TDD workflow
 */
export type TestPhase = 'RED' | 'GREEN' | 'REFACTOR';

/**
 * Code coverage metrics
 */
export interface Coverage {
	line: number;
	branch: number;
	function: number;
	statement: number;
}

/**
 * Test result data structure
 */
export interface TestResult {
	total: number;
	passed: number;
	failed: number;
	skipped: number;
	phase: TestPhase;
	coverage?: Coverage;
}

/**
 * Coverage threshold configuration
 */
export interface CoverageThresholds {
	line?: number;
	branch?: number;
	function?: number;
	statement?: number;
}

/**
 * Validation result structure
 */
export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings?: string[];
	suggestions?: string[];
}

/**
 * Phase-specific validation options
 */
export interface PhaseValidationOptions {
	phase: TestPhase;
	coverageThresholds?: CoverageThresholds;
	previousTestCount?: number;
}
