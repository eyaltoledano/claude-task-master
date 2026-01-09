/**
 * tool-registry.test.js
 * Tests for tool registry - verifies loop tools are correctly registered in tiers
 */

import {
	toolRegistry,
	coreTools,
	standardTools,
	getAvailableTools,
	getToolCounts,
	getToolCategories,
	getToolRegistration,
	isValidTool
} from '../../../../mcp-server/src/tools/tool-registry.js';

describe('tool-registry', () => {
	describe('loop tools registration', () => {
		it('should have loop_start registered in toolRegistry', () => {
			expect(toolRegistry.loop_start).toBeDefined();
			expect(typeof toolRegistry.loop_start).toBe('function');
		});

		it('should have loop_presets registered in toolRegistry', () => {
			expect(toolRegistry.loop_presets).toBeDefined();
			expect(typeof toolRegistry.loop_presets).toBe('function');
		});

		it('should include loop_start in standardTools', () => {
			expect(standardTools).toContain('loop_start');
		});

		it('should include loop_presets in standardTools', () => {
			expect(standardTools).toContain('loop_presets');
		});

		it('should NOT include loop_start in coreTools', () => {
			expect(coreTools).not.toContain('loop_start');
		});

		it('should NOT include loop_presets in coreTools', () => {
			expect(coreTools).not.toContain('loop_presets');
		});
	});

	describe('tool tier structure', () => {
		it('should have exactly 7 core tools', () => {
			expect(coreTools.length).toBe(7);
		});

		it('should have exactly 16 standard tools', () => {
			expect(standardTools.length).toBe(16);
		});

		it('should have standardTools include all coreTools', () => {
			coreTools.forEach((tool) => {
				expect(standardTools).toContain(tool);
			});
		});

		it('should have all standardTools registered in toolRegistry', () => {
			standardTools.forEach((tool) => {
				expect(toolRegistry[tool]).toBeDefined();
			});
		});
	});

	describe('getAvailableTools', () => {
		it('should return all registered tool names', () => {
			const tools = getAvailableTools();
			expect(Array.isArray(tools)).toBe(true);
			expect(tools).toContain('loop_start');
			expect(tools).toContain('loop_presets');
		});
	});

	describe('getToolCounts', () => {
		it('should return correct counts including loop tools', () => {
			const counts = getToolCounts();
			expect(counts.core).toBe(7);
			expect(counts.standard).toBe(16);
			expect(counts.total).toBeGreaterThanOrEqual(16);
		});
	});

	describe('getToolCategories', () => {
		it('should include loop tools in standard category', () => {
			const categories = getToolCategories();
			expect(categories.standard).toContain('loop_start');
			expect(categories.standard).toContain('loop_presets');
		});

		it('should include loop tools in all category', () => {
			const categories = getToolCategories();
			expect(categories.all).toContain('loop_start');
			expect(categories.all).toContain('loop_presets');
		});

		it('should NOT include loop tools in extended category (since they are in standard)', () => {
			const categories = getToolCategories();
			expect(categories.extended).not.toContain('loop_start');
			expect(categories.extended).not.toContain('loop_presets');
		});
	});

	describe('getToolRegistration', () => {
		it('should return registration function for loop_start', () => {
			const registration = getToolRegistration('loop_start');
			expect(registration).toBeDefined();
			expect(typeof registration).toBe('function');
		});

		it('should return registration function for loop_presets', () => {
			const registration = getToolRegistration('loop_presets');
			expect(registration).toBeDefined();
			expect(typeof registration).toBe('function');
		});

		it('should return null for unknown tool', () => {
			const registration = getToolRegistration('unknown_tool');
			expect(registration).toBeNull();
		});
	});

	describe('isValidTool', () => {
		it('should return true for loop_start', () => {
			expect(isValidTool('loop_start')).toBe(true);
		});

		it('should return true for loop_presets', () => {
			expect(isValidTool('loop_presets')).toBe(true);
		});

		it('should return false for unknown tool', () => {
			expect(isValidTool('unknown_tool')).toBe(false);
		});
	});

	describe('TASK_MASTER_TOOLS behavior simulation', () => {
		// This test verifies the logic that would be used when TASK_MASTER_TOOLS env var is set
		it('should allow filtering to core tools only (loop tools excluded)', () => {
			const coreToolSet = new Set(coreTools);
			expect(coreToolSet.has('loop_start')).toBe(false);
			expect(coreToolSet.has('loop_presets')).toBe(false);
			// Core tools should still be available
			expect(coreToolSet.has('get_tasks')).toBe(true);
			expect(coreToolSet.has('next_task')).toBe(true);
		});

		it('should allow filtering to standard tools (loop tools included)', () => {
			const standardToolSet = new Set(standardTools);
			expect(standardToolSet.has('loop_start')).toBe(true);
			expect(standardToolSet.has('loop_presets')).toBe(true);
			// Core tools should also be present
			expect(standardToolSet.has('get_tasks')).toBe(true);
			expect(standardToolSet.has('next_task')).toBe(true);
		});

		it('should include loop tools when using all tools', () => {
			const allTools = getAvailableTools();
			const allToolSet = new Set(allTools);
			expect(allToolSet.has('loop_start')).toBe(true);
			expect(allToolSet.has('loop_presets')).toBe(true);
		});
	});
});
