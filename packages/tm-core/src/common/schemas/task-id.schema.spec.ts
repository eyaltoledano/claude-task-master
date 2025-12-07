/**
 * @fileoverview Unit tests for task ID schemas
 */

import { describe, expect, it } from 'vitest';
import {
	MainTaskIdSchema,
	TaskIdSchema,
	normalizeDisplayId
} from './task-id.schema.js';

describe('normalizeDisplayId', () => {
	describe('file storage IDs (numeric)', () => {
		it('should return numeric main task IDs unchanged', () => {
			expect(normalizeDisplayId('1')).toBe('1');
			expect(normalizeDisplayId('123')).toBe('123');
		});

		it('should return numeric subtask IDs unchanged', () => {
			expect(normalizeDisplayId('1.1')).toBe('1.1');
			expect(normalizeDisplayId('123.45')).toBe('123.45');
		});

		it('should trim whitespace', () => {
			expect(normalizeDisplayId('  1  ')).toBe('1');
			expect(normalizeDisplayId('  1.2  ')).toBe('1.2');
		});
	});

	describe('API storage IDs (prefixed)', () => {
		it('should normalize lowercase without hyphen', () => {
			expect(normalizeDisplayId('ham1')).toBe('HAM-1');
			expect(normalizeDisplayId('ham123')).toBe('HAM-123');
		});

		it('should normalize uppercase without hyphen', () => {
			expect(normalizeDisplayId('HAM1')).toBe('HAM-1');
			expect(normalizeDisplayId('HAM123')).toBe('HAM-123');
		});

		it('should normalize lowercase with hyphen', () => {
			expect(normalizeDisplayId('ham-1')).toBe('HAM-1');
			expect(normalizeDisplayId('ham-123')).toBe('HAM-123');
		});

		it('should keep uppercase with hyphen unchanged', () => {
			expect(normalizeDisplayId('HAM-1')).toBe('HAM-1');
			expect(normalizeDisplayId('HAM-123')).toBe('HAM-123');
		});

		it('should normalize mixed case', () => {
			expect(normalizeDisplayId('Ham-1')).toBe('HAM-1');
			expect(normalizeDisplayId('hAm1')).toBe('HAM-1');
		});

		it('should trim whitespace', () => {
			expect(normalizeDisplayId('  ham1  ')).toBe('HAM-1');
			expect(normalizeDisplayId('  HAM-1  ')).toBe('HAM-1');
		});
	});

	describe('edge cases', () => {
		it('should return empty string for empty input', () => {
			expect(normalizeDisplayId('')).toBe('');
		});

		it('should return null/undefined as-is', () => {
			expect(normalizeDisplayId(null as any)).toBe(null);
			expect(normalizeDisplayId(undefined as any)).toBe(undefined);
		});

		it('should return unmatched patterns as-is', () => {
			expect(normalizeDisplayId('abc')).toBe('abc');
			expect(normalizeDisplayId('HAMSTER-1')).toBe('HAMSTER-1'); // 7 letters, not 3
			expect(normalizeDisplayId('AB-1')).toBe('AB-1'); // 2 letters, not 3
		});
	});
});

describe('TaskIdSchema', () => {
	describe('file storage IDs', () => {
		it('should accept numeric main task IDs', () => {
			expect(TaskIdSchema.safeParse('1').success).toBe(true);
			expect(TaskIdSchema.safeParse('123').success).toBe(true);
		});

		it('should accept numeric subtask IDs (one level)', () => {
			expect(TaskIdSchema.safeParse('1.1').success).toBe(true);
			expect(TaskIdSchema.safeParse('123.45').success).toBe(true);
		});

		it('should reject deeply nested IDs', () => {
			expect(TaskIdSchema.safeParse('1.2.3').success).toBe(false);
			expect(TaskIdSchema.safeParse('1.2.3.4').success).toBe(false);
		});

		it('should return normalized value', () => {
			const result = TaskIdSchema.safeParse('  1  ');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('1');
			}
		});
	});

	describe('API storage IDs', () => {
		it('should accept prefixed IDs with hyphen', () => {
			expect(TaskIdSchema.safeParse('HAM-1').success).toBe(true);
			expect(TaskIdSchema.safeParse('ham-1').success).toBe(true);
		});

		it('should accept prefixed IDs without hyphen', () => {
			expect(TaskIdSchema.safeParse('HAM1').success).toBe(true);
			expect(TaskIdSchema.safeParse('ham1').success).toBe(true);
		});

		it('should reject prefixed subtask IDs', () => {
			expect(TaskIdSchema.safeParse('HAM-1.2').success).toBe(false);
			expect(TaskIdSchema.safeParse('ham1.2').success).toBe(false);
		});

		it('should normalize to uppercase with hyphen', () => {
			const result = TaskIdSchema.safeParse('ham1');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('HAM-1');
			}
		});
	});

	describe('invalid inputs', () => {
		it('should reject empty string', () => {
			expect(TaskIdSchema.safeParse('').success).toBe(false);
		});

		it('should reject whitespace only', () => {
			expect(TaskIdSchema.safeParse('   ').success).toBe(false);
		});

		it('should reject invalid formats', () => {
			expect(TaskIdSchema.safeParse('abc').success).toBe(false);
			expect(TaskIdSchema.safeParse('HAMSTER-1').success).toBe(false);
			expect(TaskIdSchema.safeParse('AB-1').success).toBe(false);
		});
	});
});

describe('MainTaskIdSchema', () => {
	describe('valid main tasks', () => {
		it('should accept numeric main task IDs', () => {
			expect(MainTaskIdSchema.safeParse('1').success).toBe(true);
			expect(MainTaskIdSchema.safeParse('123').success).toBe(true);
		});

		it('should accept prefixed main task IDs', () => {
			expect(MainTaskIdSchema.safeParse('HAM-1').success).toBe(true);
			expect(MainTaskIdSchema.safeParse('ham-1').success).toBe(true);
			expect(MainTaskIdSchema.safeParse('ham1').success).toBe(true);
		});

		it('should normalize prefixed IDs', () => {
			const result = MainTaskIdSchema.safeParse('ham1');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('HAM-1');
			}
		});
	});

	describe('invalid subtasks', () => {
		it('should reject numeric subtask IDs', () => {
			const result = MainTaskIdSchema.safeParse('1.2');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('Subtask');
			}
		});

		it('should reject prefixed subtask IDs', () => {
			expect(MainTaskIdSchema.safeParse('HAM-1.2').success).toBe(false);
		});
	});

	describe('error messages', () => {
		it('should provide helpful error for invalid format', () => {
			const result = MainTaskIdSchema.safeParse('invalid');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('Invalid task ID');
			}
		});

		it('should provide helpful error for subtask', () => {
			const result = MainTaskIdSchema.safeParse('1.2');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('Subtask');
			}
		});
	});
});
