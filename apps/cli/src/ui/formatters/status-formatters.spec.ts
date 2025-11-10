/**
 * Status formatter tests
 * Tests for apps/cli/src/utils/formatters/status-formatters.ts
 */

import { describe, it, expect } from 'vitest';
import { getBriefStatusWithColor } from './status-formatters.js';

describe('Status Formatters', () => {
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
