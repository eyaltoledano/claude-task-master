import { describe, it, expect } from 'vitest';
import {
	generateRunId,
	isValidRunId,
	parseRunId,
	compareRunIds
} from './run-id-generator.js';

describe('Run ID Generator', () => {
	describe('generateRunId', () => {
		it('should generate a valid ISO 8601 timestamp-based ID', () => {
			const runId = generateRunId();

			// Should be in ISO 8601 format with milliseconds
			expect(runId).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		});

		it('should generate unique IDs when called multiple times', () => {
			const id1 = generateRunId();
			const id2 = generateRunId();
			const id3 = generateRunId();

			expect(id1).not.toBe(id2);
			expect(id2).not.toBe(id3);
			expect(id1).not.toBe(id3);
		});

		it('should generate chronologically ordered IDs', () => {
			const id1 = generateRunId();
			// Small delay to ensure different timestamp
			const id2 = generateRunId();

			expect(id2 > id1).toBe(true);
		});

		it('should use current time by default', () => {
			const before = new Date().toISOString();
			const runId = generateRunId();
			const after = new Date().toISOString();

			expect(runId >= before).toBe(true);
			expect(runId <= after).toBe(true);
		});

		it('should accept custom Date object', () => {
			const customDate = new Date('2024-01-15T10:30:45.123Z');
			const runId = generateRunId(customDate);

			expect(runId).toBe('2024-01-15T10:30:45.123Z');
		});

		it('should handle date at year boundary', () => {
			const newYear = new Date('2025-01-01T00:00:00.000Z');
			const runId = generateRunId(newYear);

			expect(runId).toBe('2025-01-01T00:00:00.000Z');
		});

		it('should handle millisecond precision correctly', () => {
			const dateWithMs = new Date('2024-03-15T14:22:33.999Z');
			const runId = generateRunId(dateWithMs);

			expect(runId).toBe('2024-03-15T14:22:33.999Z');
		});
	});

	describe('isValidRunId', () => {
		it('should return true for valid ISO 8601 timestamp', () => {
			expect(isValidRunId('2024-01-15T10:30:45.123Z')).toBe(true);
		});

		it('should return true for generated run IDs', () => {
			const runId = generateRunId();
			expect(isValidRunId(runId)).toBe(true);
		});

		it('should return false for invalid format', () => {
			expect(isValidRunId('not-a-timestamp')).toBe(false);
			expect(isValidRunId('2024-01-15')).toBe(false);
			expect(isValidRunId('2024-01-15T10:30:45')).toBe(false); // missing Z
			expect(isValidRunId('2024-01-15 10:30:45.123Z')).toBe(false); // space instead of T
		});

		it('should return false for empty string', () => {
			expect(isValidRunId('')).toBe(false);
		});

		it('should return false for null or undefined', () => {
			expect(isValidRunId(null)).toBe(false);
			expect(isValidRunId(undefined)).toBe(false);
		});

		it('should return false for invalid dates', () => {
			expect(isValidRunId('2024-13-01T10:30:45.123Z')).toBe(false); // invalid month
			expect(isValidRunId('2024-01-32T10:30:45.123Z')).toBe(false); // invalid day
			expect(isValidRunId('2024-01-15T25:30:45.123Z')).toBe(false); // invalid hour
		});

		it('should return true for edge case valid dates', () => {
			expect(isValidRunId('2024-02-29T23:59:59.999Z')).toBe(true); // leap year
			expect(isValidRunId('2025-01-01T00:00:00.000Z')).toBe(true); // year boundary
		});

		it('should return false for missing milliseconds', () => {
			expect(isValidRunId('2024-01-15T10:30:45Z')).toBe(false);
		});

		it('should return false for non-UTC timezone', () => {
			expect(isValidRunId('2024-01-15T10:30:45.123+01:00')).toBe(false);
		});
	});

	describe('parseRunId', () => {
		it('should parse valid run ID to Date object', () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const date = parseRunId(runId);

			expect(date).toBeInstanceOf(Date);
			expect(date?.toISOString()).toBe(runId);
		});

		it('should parse generated run ID', () => {
			const originalDate = new Date('2024-03-20T15:45:30.500Z');
			const runId = generateRunId(originalDate);
			const parsedDate = parseRunId(runId);

			expect(parsedDate?.getTime()).toBe(originalDate.getTime());
		});

		it('should return null for invalid run ID', () => {
			expect(parseRunId('invalid')).toBe(null);
			expect(parseRunId('')).toBe(null);
			expect(parseRunId(null)).toBe(null);
			expect(parseRunId(undefined)).toBe(null);
		});

		it('should handle edge case dates correctly', () => {
			const leapYear = '2024-02-29T12:00:00.000Z';
			const parsed = parseRunId(leapYear);

			expect(parsed?.toISOString()).toBe(leapYear);
		});
	});

	describe('compareRunIds', () => {
		it('should return negative when first ID is earlier', () => {
			const earlier = '2024-01-15T10:00:00.000Z';
			const later = '2024-01-15T11:00:00.000Z';

			expect(compareRunIds(earlier, later)).toBeLessThan(0);
		});

		it('should return positive when first ID is later', () => {
			const earlier = '2024-01-15T10:00:00.000Z';
			const later = '2024-01-15T11:00:00.000Z';

			expect(compareRunIds(later, earlier)).toBeGreaterThan(0);
		});

		it('should return zero when IDs are equal', () => {
			const runId = '2024-01-15T10:00:00.000Z';

			expect(compareRunIds(runId, runId)).toBe(0);
		});

		it('should handle millisecond differences', () => {
			const id1 = '2024-01-15T10:00:00.100Z';
			const id2 = '2024-01-15T10:00:00.200Z';

			expect(compareRunIds(id1, id2)).toBeLessThan(0);
			expect(compareRunIds(id2, id1)).toBeGreaterThan(0);
		});

		it('should handle cross-day comparisons', () => {
			const yesterday = '2024-01-14T23:59:59.999Z';
			const today = '2024-01-15T00:00:00.000Z';

			expect(compareRunIds(yesterday, today)).toBeLessThan(0);
		});

		it('should handle cross-year comparisons', () => {
			const lastYear = '2023-12-31T23:59:59.999Z';
			const thisYear = '2024-01-01T00:00:00.000Z';

			expect(compareRunIds(lastYear, thisYear)).toBeLessThan(0);
		});

		it('should throw error for invalid run IDs', () => {
			const valid = '2024-01-15T10:00:00.000Z';

			expect(() => compareRunIds('invalid', valid)).toThrow();
			expect(() => compareRunIds(valid, 'invalid')).toThrow();
			expect(() => compareRunIds('invalid', 'invalid')).toThrow();
		});
	});

	describe('Collision detection', () => {
		it('should generate different IDs in rapid succession', () => {
			const ids = new Set();
			const count = 100;

			for (let i = 0; i < count; i++) {
				ids.add(generateRunId());
			}

			// All IDs should be unique
			expect(ids.size).toBe(count);
		});

		it('should handle high-frequency generation', () => {
			const ids = [];
			const iterations = 1000;

			for (let i = 0; i < iterations; i++) {
				ids.push(generateRunId());
			}

			// Check uniqueness
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(iterations);

			// Check chronological order
			for (let i = 1; i < ids.length; i++) {
				expect(compareRunIds(ids[i - 1], ids[i])).toBeLessThanOrEqual(0);
			}
		});
	});

	describe('Chronological ordering', () => {
		it('should allow sorting run IDs chronologically', () => {
			const ids = [
				'2024-01-15T14:00:00.000Z',
				'2024-01-15T10:00:00.000Z',
				'2024-01-15T12:00:00.000Z',
				'2024-01-14T23:00:00.000Z',
				'2024-01-16T08:00:00.000Z'
			];

			const sorted = [...ids].sort(compareRunIds);

			expect(sorted).toEqual([
				'2024-01-14T23:00:00.000Z',
				'2024-01-15T10:00:00.000Z',
				'2024-01-15T12:00:00.000Z',
				'2024-01-15T14:00:00.000Z',
				'2024-01-16T08:00:00.000Z'
			]);
		});

		it('should handle reverse chronological sorting', () => {
			const ids = [
				'2024-01-15T10:00:00.000Z',
				'2024-01-15T14:00:00.000Z',
				'2024-01-15T12:00:00.000Z'
			];

			const sorted = [...ids].sort((a, b) => compareRunIds(b, a));

			expect(sorted).toEqual([
				'2024-01-15T14:00:00.000Z',
				'2024-01-15T12:00:00.000Z',
				'2024-01-15T10:00:00.000Z'
			]);
		});
	});
});
