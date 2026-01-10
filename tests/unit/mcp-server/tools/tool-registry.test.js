/**
 * tool-registry.test.js
 * Tests for tool registry - verifies tools are correctly registered in tiers
 */

import {
	coreTools,
	getAvailableTools,
	getToolCategories,
	getToolCounts,
	getToolRegistration,
	isValidTool,
	standardTools,
	toolRegistry
} from '../../../../mcp-server/src/tools/tool-registry.js';

describe('tool-registry', () => {
	describe('tool tier structure', () => {
		it('should have exactly 7 core tools', () => {
			expect(coreTools.length).toBe(7);
		});

		it('should have exactly 14 standard tools', () => {
			expect(standardTools.length).toBe(14);
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
		});
	});

	describe('getToolCounts', () => {
		it('should return correct counts', () => {
			const counts = getToolCounts();
			expect(counts.core).toBe(7);
			expect(counts.standard).toBe(14);
			expect(counts.total).toBeGreaterThanOrEqual(14);
		});
	});

	describe('getToolCategories', () => {
		it('should return categories with core tools', () => {
			const categories = getToolCategories();
			expect(categories.core).toContain('get_tasks');
			expect(categories.core).toContain('next_task');
		});

		it('should return categories with standard tools', () => {
			const categories = getToolCategories();
			expect(categories.standard).toContain('get_tasks');
			expect(categories.standard).toContain('add_task');
		});

		it('should return categories with all tools', () => {
			const categories = getToolCategories();
			expect(categories.all.length).toBeGreaterThanOrEqual(
				categories.standard.length
			);
		});
	});

	describe('getToolRegistration', () => {
		it('should return registration function for get_tasks', () => {
			const registration = getToolRegistration('get_tasks');
			expect(registration).toBeDefined();
			expect(typeof registration).toBe('function');
		});

		it('should return registration function for add_task', () => {
			const registration = getToolRegistration('add_task');
			expect(registration).toBeDefined();
			expect(typeof registration).toBe('function');
		});

		it('should return null for unknown tool', () => {
			const registration = getToolRegistration('unknown_tool');
			expect(registration).toBeNull();
		});
	});

	describe('isValidTool', () => {
		it('should return true for get_tasks', () => {
			expect(isValidTool('get_tasks')).toBe(true);
		});

		it('should return true for add_task', () => {
			expect(isValidTool('add_task')).toBe(true);
		});

		it('should return false for unknown tool', () => {
			expect(isValidTool('unknown_tool')).toBe(false);
		});
	});

	describe('TASK_MASTER_TOOLS behavior simulation', () => {
		it('should allow filtering to core tools only', () => {
			const coreToolSet = new Set(coreTools);
			expect(coreToolSet.has('get_tasks')).toBe(true);
			expect(coreToolSet.has('next_task')).toBe(true);
		});

		it('should allow filtering to standard tools', () => {
			const standardToolSet = new Set(standardTools);
			expect(standardToolSet.has('get_tasks')).toBe(true);
			expect(standardToolSet.has('next_task')).toBe(true);
			expect(standardToolSet.has('add_task')).toBe(true);
		});

		it('should include all tools when using getAvailableTools', () => {
			const allTools = getAvailableTools();
			const allToolSet = new Set(allTools);
			expect(allToolSet.has('get_tasks')).toBe(true);
			expect(allToolSet.has('add_task')).toBe(true);
		});
	});
});
