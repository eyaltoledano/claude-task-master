/**
 * CLI UI utilities tests (Backward compatibility tests)
 * Tests for apps/cli/src/utils/ui.ts
 *
 * This file ensures backward compatibility with the old ui.ts module.
 * The actual implementation has been moved to src/ui/ organized modules.
 * See:
 * - ui/layout/helpers.spec.ts
 * - ui/formatters/status-formatters.spec.ts
 */

import { describe, expect, it } from 'vitest';
import { getBoxWidth, getBriefStatusWithColor } from './ui.js';

describe('CLI UI Utilities (Backward Compatibility)', () => {
	describe('Re-exports work correctly from ui/', () => {
		it('should re-export getBoxWidth', () => {
			expect(typeof getBoxWidth).toBe('function');
		});

		it('should re-export getBriefStatusWithColor', () => {
			expect(typeof getBriefStatusWithColor).toBe('function');
		});

		it('should maintain functional behavior for getBoxWidth', () => {
			// Simple smoke test - detailed tests are in ui/layout/helpers.spec.ts
			const width = getBoxWidth(0.9, 40);
			expect(typeof width).toBe('number');
			expect(width).toBeGreaterThanOrEqual(40);
		});

		it('should maintain functional behavior for getBriefStatusWithColor', () => {
			// Simple smoke test - detailed tests are in ui/formatters/status-formatters.spec.ts
			const result = getBriefStatusWithColor('done', true);
			expect(result).toContain('Done');
			expect(result).toContain('✓');
		});
	});
});
