/**
 * CLI UI utilities tests
 * Tests for apps/cli/src/utils/ui.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { getBoxWidth, getBriefStatusWithColor } from './ui.js';

describe('CLI UI Utilities', () => {
	describe('getBoxWidth', () => {
		let columnsSpy: MockInstance;
		let originalDescriptor: PropertyDescriptor | undefined;

		beforeEach(() => {
			// Store original descriptor if it exists
			originalDescriptor = Object.getOwnPropertyDescriptor(
				process.stdout,
				'columns'
			);

			// If columns doesn't exist or isn't a getter, define it as one
			if (!originalDescriptor || !originalDescriptor.get) {
				const currentValue = process.stdout.columns || 80;
				Object.defineProperty(process.stdout, 'columns', {
					get() {
						return currentValue;
					},
					configurable: true
				});
			}

			// Now spy on the getter
			columnsSpy = vi.spyOn(process.stdout, 'columns', 'get');
		});

		afterEach(() => {
			// Restore the spy
			columnsSpy.mockRestore();

			// Restore original descriptor or delete the property
			if (originalDescriptor) {
				Object.defineProperty(process.stdout, 'columns', originalDescriptor);
			} else {
				delete (process.stdout as any).columns;
			}
		});

		it('should calculate width as percentage of terminal width', () => {
			columnsSpy.mockReturnValue(100);
			const width = getBoxWidth(0.9, 40);
			expect(width).toBe(90);
		});

		it('should use default percentage of 0.9 when not specified', () => {
			columnsSpy.mockReturnValue(100);
			const width = getBoxWidth();
			expect(width).toBe(90);
		});

		it('should use default minimum width of 40 when not specified', () => {
			columnsSpy.mockReturnValue(30);
			const width = getBoxWidth();
			expect(width).toBe(40); // Should enforce minimum
		});

		it('should enforce minimum width when terminal is too narrow', () => {
			columnsSpy.mockReturnValue(50);
			const width = getBoxWidth(0.9, 60);
			expect(width).toBe(60); // Should use minWidth instead of 45
		});

		it('should handle undefined process.stdout.columns', () => {
			columnsSpy.mockReturnValue(undefined);
			const width = getBoxWidth(0.9, 40);
			// Should fall back to 80 columns: Math.floor(80 * 0.9) = 72
			expect(width).toBe(72);
		});

		it('should handle custom percentage values', () => {
			columnsSpy.mockReturnValue(100);
			expect(getBoxWidth(0.95, 40)).toBe(95);
			expect(getBoxWidth(0.8, 40)).toBe(80);
			expect(getBoxWidth(0.5, 40)).toBe(50);
		});

		it('should handle custom minimum width values', () => {
			columnsSpy.mockReturnValue(60);
			expect(getBoxWidth(0.9, 70)).toBe(70); // 60 * 0.9 = 54, but min is 70
			expect(getBoxWidth(0.9, 50)).toBe(54); // 60 * 0.9 = 54, min is 50
		});

		it('should floor the calculated width', () => {
			columnsSpy.mockReturnValue(99);
			const width = getBoxWidth(0.9, 40);
			// 99 * 0.9 = 89.1, should floor to 89
			expect(width).toBe(89);
		});

		it('should match warning box width calculation', () => {
			// Test the specific case from displayWarning()
			columnsSpy.mockReturnValue(80);
			const width = getBoxWidth(0.9, 40);
			expect(width).toBe(72);
		});

		it('should match table width calculation', () => {
			// Test the specific case from createTaskTable()
			columnsSpy.mockReturnValue(111);
			const width = getBoxWidth(0.9, 100);
			// 111 * 0.9 = 99.9, floor to 99, but max(99, 100) = 100
			expect(width).toBe(100);
		});

		it('should match recommended task box width calculation', () => {
			// Test the specific case from displayRecommendedNextTask()
			columnsSpy.mockReturnValue(120);
			const width = getBoxWidth(0.97, 40);
			// 120 * 0.97 = 116.4, floor to 116
			expect(width).toBe(116);
		});

		it('should handle edge case of zero terminal width', () => {
			columnsSpy.mockReturnValue(0);
			const width = getBoxWidth(0.9, 40);
			// When columns is 0, it uses fallback of 80: Math.floor(80 * 0.9) = 72
			expect(width).toBe(72);
		});

		it('should handle very large terminal widths', () => {
			columnsSpy.mockReturnValue(1000);
			const width = getBoxWidth(0.9, 40);
			expect(width).toBe(900);
		});

		it('should handle very small percentages', () => {
			columnsSpy.mockReturnValue(100);
			const width = getBoxWidth(0.1, 5);
			// 100 * 0.1 = 10, which is greater than min 5
			expect(width).toBe(10);
		});

		it('should handle percentage of 1.0 (100%)', () => {
			columnsSpy.mockReturnValue(80);
			const width = getBoxWidth(1.0, 40);
			expect(width).toBe(80);
		});

		it('should consistently return same value for same inputs', () => {
			columnsSpy.mockReturnValue(100);
			const width1 = getBoxWidth(0.9, 40);
			const width2 = getBoxWidth(0.9, 40);
			const width3 = getBoxWidth(0.9, 40);
			expect(width1).toBe(width2);
			expect(width2).toBe(width3);
		});
	});

	describe('getBriefStatusWithColor', () => {
		it('should format draft status with gray color and circle icon', () => {
			const result = getBriefStatusWithColor('draft', true);
			expect(result).toContain('draft');
			expect(result).toContain('○');
		});

		it('should format refining status with yellow color and half-circle icon', () => {
			const result = getBriefStatusWithColor('refining', true);
			expect(result).toContain('refining');
			expect(result).toContain('◐');
		});

		it('should format aligned status with cyan color and target icon', () => {
			const result = getBriefStatusWithColor('aligned', true);
			expect(result).toContain('aligned');
			expect(result).toContain('◎');
		});

		it('should format delivering status with orange color and play icon', () => {
			const result = getBriefStatusWithColor('delivering', true);
			expect(result).toContain('delivering');
			expect(result).toContain('▶');
		});

		it('should format delivered status with blue color and diamond icon', () => {
			const result = getBriefStatusWithColor('delivered', true);
			expect(result).toContain('delivered');
			expect(result).toContain('◆');
		});

		it('should format done status with green color and checkmark icon', () => {
			const result = getBriefStatusWithColor('done', true);
			expect(result).toContain('done');
			expect(result).toContain('✓');
		});

		it('should format archived status with gray color and square icon', () => {
			const result = getBriefStatusWithColor('archived', true);
			expect(result).toContain('archived');
			expect(result).toContain('■');
		});

		it('should handle unknown status with red color and question mark', () => {
			const result = getBriefStatusWithColor('unknown-status', true);
			expect(result).toContain('unknown-status');
			expect(result).toContain('?');
		});

		it('should handle undefined status with gray color', () => {
			const result = getBriefStatusWithColor(undefined, true);
			expect(result).toContain('unknown');
			expect(result).toContain('○');
		});

		it('should use same icon for table and non-table display', () => {
			const tableResult = getBriefStatusWithColor('done', true);
			const nonTableResult = getBriefStatusWithColor('done', false);
			expect(tableResult).toBe(nonTableResult);
		});
	});
});
