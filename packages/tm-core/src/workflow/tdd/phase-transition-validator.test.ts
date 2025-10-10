import { describe, it, expect } from 'vitest';
import { PhaseTransitionValidator } from './phase-transition-validator.js';

describe('PhaseTransitionValidator', () => {
	const validator = new PhaseTransitionValidator();

	describe('canTransition', () => {
		it('should allow RED to GREEN transition', () => {
			expect(validator.canTransition('RED', 'GREEN')).toBe(true);
		});

		it('should allow GREEN to COMMIT transition', () => {
			expect(validator.canTransition('GREEN', 'COMMIT')).toBe(true);
		});

		it('should allow COMMIT to RED transition (next subtask)', () => {
			expect(validator.canTransition('COMMIT', 'RED')).toBe(true);
		});

		it('should not allow RED to COMMIT transition', () => {
			expect(validator.canTransition('RED', 'COMMIT')).toBe(false);
		});

		it('should not allow GREEN to RED transition', () => {
			expect(validator.canTransition('GREEN', 'RED')).toBe(false);
		});
	});

	describe('validateTransition', () => {
		it('should return success for valid transition', () => {
			const result = validator.validateTransition('RED', 'GREEN');
			expect(result.isValid).toBe(true);
		});

		it('should return error for invalid transition', () => {
			const result = validator.validateTransition('RED', 'COMMIT');
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Invalid transition');
		});
	});
});
