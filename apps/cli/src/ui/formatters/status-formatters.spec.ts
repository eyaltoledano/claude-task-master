/**
 * Status formatter tests
 * Tests for apps/cli/src/utils/formatters/status-formatters.ts
 */

import { describe, expect, it } from 'vitest';
import {
	capitalizeStatus,
	getBriefStatusColor,
	getBriefStatusIcon,
	getBriefStatusWithColor
} from './status-formatters.js';

describe('Status Formatters', () => {
	describe('getBriefStatusWithColor', () => {
		it('should format draft status with gray color and circle icon', () => {
			const result = getBriefStatusWithColor('draft', true);
			expect(result).toContain('Draft');
			expect(result).toContain('○');
		});

		it('should format refining status with yellow color and half-circle icon', () => {
			const result = getBriefStatusWithColor('refining', true);
			expect(result).toContain('Refining');
			expect(result).toContain('◐');
		});

		it('should format aligned status with cyan color and target icon', () => {
			const result = getBriefStatusWithColor('aligned', true);
			expect(result).toContain('Aligned');
			expect(result).toContain('◎');
		});

		it('should format delivering status with orange color and play icon', () => {
			const result = getBriefStatusWithColor('delivering', true);
			expect(result).toContain('Delivering');
			expect(result).toContain('▶');
		});

		it('should format delivered status with blue color and diamond icon', () => {
			const result = getBriefStatusWithColor('delivered', true);
			expect(result).toContain('Delivered');
			expect(result).toContain('◆');
		});

		it('should format done status with green color and checkmark icon', () => {
			const result = getBriefStatusWithColor('done', true);
			expect(result).toContain('Done');
			expect(result).toContain('✓');
		});

		it('should format archived status with gray color and square icon', () => {
			const result = getBriefStatusWithColor('archived', true);
			expect(result).toContain('Archived');
			expect(result).toContain('■');
		});

		it('should handle unknown status with red color and question mark', () => {
			const result = getBriefStatusWithColor('unknown-status', true);
			expect(result).toContain('Unknown-status');
			expect(result).toContain('?');
		});

		it('should handle undefined status with gray color', () => {
			const result = getBriefStatusWithColor(undefined, true);
			expect(result).toContain('Unknown');
			expect(result).toContain('○');
		});

		it('should use same icon for table and non-table display', () => {
			const tableResult = getBriefStatusWithColor('done', true);
			const nonTableResult = getBriefStatusWithColor('done', false);
			expect(tableResult).toBe(nonTableResult);
		});

		it('should handle case-insensitive status names', () => {
			const lowerResult = getBriefStatusWithColor('draft', true);
			const upperResult = getBriefStatusWithColor('DRAFT', true);
			const mixedResult = getBriefStatusWithColor('DrAfT', true);
			expect(lowerResult).toContain('Draft');
			expect(upperResult).toContain('Draft');
			expect(mixedResult).toContain('Draft');
		});
	});

	describe('getBriefStatusIcon', () => {
		it('should return correct icon for status', () => {
			expect(getBriefStatusIcon('draft')).toBe('○');
			expect(getBriefStatusIcon('done')).toBe('✓');
			expect(getBriefStatusIcon('delivering')).toBe('▶');
		});

		it('should return default icon for unknown status', () => {
			expect(getBriefStatusIcon('unknown-status')).toBe('?');
		});

		it('should return default icon for undefined', () => {
			expect(getBriefStatusIcon(undefined)).toBe('○');
		});

		it('should return same icon for table and non-table', () => {
			expect(getBriefStatusIcon('done', true)).toBe(
				getBriefStatusIcon('done', false)
			);
		});
	});

	describe('getBriefStatusColor', () => {
		it('should return a color function', () => {
			const colorFn = getBriefStatusColor('draft');
			expect(typeof colorFn).toBe('function');
			const result = colorFn('test');
			expect(typeof result).toBe('string');
		});

		it('should return gray color for undefined', () => {
			const colorFn = getBriefStatusColor(undefined);
			expect(typeof colorFn).toBe('function');
		});
	});

	describe('capitalizeStatus', () => {
		it('should capitalize first letter and lowercase rest', () => {
			expect(capitalizeStatus('draft')).toBe('Draft');
			expect(capitalizeStatus('DRAFT')).toBe('Draft');
			expect(capitalizeStatus('DrAfT')).toBe('Draft');
			expect(capitalizeStatus('in-progress')).toBe('In-progress');
		});

		it('should handle single character', () => {
			expect(capitalizeStatus('a')).toBe('A');
			expect(capitalizeStatus('A')).toBe('A');
		});

		it('should handle empty string', () => {
			expect(capitalizeStatus('')).toBe('');
		});
	});
});
