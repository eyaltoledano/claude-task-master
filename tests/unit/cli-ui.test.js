/**
 * CLI UI utilities tests
 * Tests for apps/cli/src/utils/ui.ts
 */

import { jest } from '@jest/globals';
import { getBoxWidth } from '../../apps/cli/src/utils/ui.js';

describe('CLI UI Utilities', () => {
	describe('getBoxWidth', () => {
		let originalColumns;

		beforeEach(() => {
			// Store original value
			originalColumns = process.stdout.columns;
		});

		afterEach(() => {
			// Restore original value
			process.stdout.columns = originalColumns;
		});

		it('should calculate width as percentage of terminal width', () => {
			process.stdout.columns = 100;
			const width = getBoxWidth(0.9, 40);
			expect(width).toBe(90);
		});

		it('should use default percentage of 0.9 when not specified', () => {
			process.stdout.columns = 100;
			const width = getBoxWidth();
			expect(width).toBe(90);
		});

		it('should use default minimum width of 40 when not specified', () => {
			process.stdout.columns = 30;
			const width = getBoxWidth();
			expect(width).toBe(40); // Should enforce minimum
		});

		it('should enforce minimum width when terminal is too narrow', () => {
			process.stdout.columns = 50;
			const width = getBoxWidth(0.9, 60);
			expect(width).toBe(60); // Should use minWidth instead of 45
		});

		it('should handle undefined process.stdout.columns', () => {
			process.stdout.columns = undefined;
			const width = getBoxWidth(0.9, 40);
			// Should fall back to 80 columns: Math.floor(80 * 0.9) = 72
			expect(width).toBe(72);
		});

		it('should handle custom percentage values', () => {
			process.stdout.columns = 100;
			expect(getBoxWidth(0.95, 40)).toBe(95);
			expect(getBoxWidth(0.8, 40)).toBe(80);
			expect(getBoxWidth(0.5, 40)).toBe(50);
		});

		it('should handle custom minimum width values', () => {
			process.stdout.columns = 60;
			expect(getBoxWidth(0.9, 70)).toBe(70); // 60 * 0.9 = 54, but min is 70
			expect(getBoxWidth(0.9, 50)).toBe(54); // 60 * 0.9 = 54, min is 50
		});

		it('should floor the calculated width', () => {
			process.stdout.columns = 99;
			const width = getBoxWidth(0.9, 40);
			// 99 * 0.9 = 89.1, should floor to 89
			expect(width).toBe(89);
		});

		it('should match warning box width calculation', () => {
			// Test the specific case from displayWarning()
			process.stdout.columns = 80;
			const width = getBoxWidth(0.9, 40);
			expect(width).toBe(72);
		});

		it('should match table width calculation', () => {
			// Test the specific case from createTaskTable()
			process.stdout.columns = 111;
			const width = getBoxWidth(0.9, 100);
			// 111 * 0.9 = 99.9, floor to 99, but max(99, 100) = 100
			expect(width).toBe(100);
		});

		it('should match recommended task box width calculation', () => {
			// Test the specific case from displayRecommendedNextTask()
			process.stdout.columns = 120;
			const width = getBoxWidth(0.97, 40);
			// 120 * 0.97 = 116.4, floor to 116
			expect(width).toBe(116);
		});

		it('should handle edge case of zero terminal width', () => {
			process.stdout.columns = 0;
			const width = getBoxWidth(0.9, 40);
			// When columns is 0, it uses fallback of 80: Math.floor(80 * 0.9) = 72
			expect(width).toBe(72);
		});

		it('should handle very large terminal widths', () => {
			process.stdout.columns = 1000;
			const width = getBoxWidth(0.9, 40);
			expect(width).toBe(900);
		});

		it('should handle very small percentages', () => {
			process.stdout.columns = 100;
			const width = getBoxWidth(0.1, 5);
			// 100 * 0.1 = 10, which is greater than min 5
			expect(width).toBe(10);
		});

		it('should handle percentage of 1.0 (100%)', () => {
			process.stdout.columns = 80;
			const width = getBoxWidth(1.0, 40);
			expect(width).toBe(80);
		});

		it('should consistently return same value for same inputs', () => {
			process.stdout.columns = 100;
			const width1 = getBoxWidth(0.9, 40);
			const width2 = getBoxWidth(0.9, 40);
			const width3 = getBoxWidth(0.9, 40);
			expect(width1).toBe(width2);
			expect(width2).toBe(width3);
		});
	});
});
