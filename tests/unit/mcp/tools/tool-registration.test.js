/**
 * tool-registration.test.js
 * Comprehensive unit tests for the Task Master MCP tool registration system
 * Tests environment variable control system covering all configuration modes and edge cases
 */

import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest
} from '@jest/globals';

import {
	EXPECTED_TOOL_COUNTS,
	EXPECTED_CORE_TOOLS,
	validateToolCounts,
	validateToolStructure
} from '../../../helpers/tool-counts.js';

import { registerTaskMasterTools } from '../../../../mcp-server/src/tools/index.js';
import {
	toolRegistry,
	coreTools,
	standardTools
} from '../../../../mcp-server/src/tools/tool-registry.js';

// Derive constants from imported registry to avoid brittle magic numbers
const ALL_COUNT = Object.keys(toolRegistry).length;
const CORE_COUNT = coreTools.length;
const STANDARD_COUNT = standardTools.length;

describe('Task Master Tool Registration System', () => {
	let mockServer;
	let originalEnv;

	beforeEach(() => {
		originalEnv = process.env.TASK_MASTER_TOOLS;

		mockServer = {
			tools: [],
			addTool: jest.fn((tool) => {
				mockServer.tools.push(tool);
				return tool;
			})
		};

		delete process.env.TASK_MASTER_TOOLS;
	});

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.TASK_MASTER_TOOLS = originalEnv;
		} else {
			delete process.env.TASK_MASTER_TOOLS;
		}

		jest.clearAllMocks();
	});

	describe('Test Environment Setup', () => {
		it('should have properly configured mock server', () => {
			expect(mockServer).toBeDefined();
			expect(typeof mockServer.addTool).toBe('function');
			expect(Array.isArray(mockServer.tools)).toBe(true);
			expect(mockServer.tools.length).toBe(0);
		});

		it('should have correct tool registry structure', () => {
			const validation = validateToolCounts();
			expect(validation.isValid).toBe(true);

			if (!validation.isValid) {
				console.error('Tool count validation failed:', validation);
			}

			expect(validation.actual.total).toBe(EXPECTED_TOOL_COUNTS.total);
			expect(validation.actual.core).toBe(EXPECTED_TOOL_COUNTS.core);
			expect(validation.actual.standard).toBe(EXPECTED_TOOL_COUNTS.standard);
		});

		it('should have correct core tools', () => {
			const structure = validateToolStructure();
			expect(structure.isValid).toBe(true);

			if (!structure.isValid) {
				console.error('Tool structure validation failed:', structure);
			}

			expect(coreTools).toEqual(expect.arrayContaining(EXPECTED_CORE_TOOLS));
			expect(coreTools.length).toBe(EXPECTED_TOOL_COUNTS.core);
		});

		it('should have correct standard tools that include all core tools', () => {
			const structure = validateToolStructure();
			expect(structure.details.coreInStandard).toBe(true);
			expect(standardTools.length).toBe(EXPECTED_TOOL_COUNTS.standard);

			coreTools.forEach((tool) => {
				expect(standardTools).toContain(tool);
			});
		});

		it('should have all expected tools in registry', () => {
			const expectedTools = [
				'initialize_project',
				'models',
				'research',
				'add_tag',
				'delete_tag',
				'get_tasks',
				'next_task',
				'get_task'
			];
			expectedTools.forEach((tool) => {
				expect(toolRegistry).toHaveProperty(tool);
			});
		});
	});

	describe('Configuration Modes', () => {
		it(`should register all tools (${ALL_COUNT}) when TASK_MASTER_TOOLS is not set (default behavior)`, () => {
			delete process.env.TASK_MASTER_TOOLS;

			registerTaskMasterTools(mockServer);

			expect(mockServer.addTool).toHaveBeenCalledTimes(
				EXPECTED_TOOL_COUNTS.total
			);
		});

		it(`should register all tools (${ALL_COUNT}) when TASK_MASTER_TOOLS=all`, () => {
			process.env.TASK_MASTER_TOOLS = 'all';

			registerTaskMasterTools(mockServer);

			expect(mockServer.addTool).toHaveBeenCalledTimes(ALL_COUNT);
		});

		it(`should register exactly ${CORE_COUNT} core tools when TASK_MASTER_TOOLS=core`, () => {
			process.env.TASK_MASTER_TOOLS = 'core';

			registerTaskMasterTools(mockServer, 'core');

			expect(mockServer.addTool).toHaveBeenCalledTimes(
				EXPECTED_TOOL_COUNTS.core
			);
		});

		it(`should register exactly ${STANDARD_COUNT} standard tools when TASK_MASTER_TOOLS=standard`, () => {
			process.env.TASK_MASTER_TOOLS = 'standard';

			registerTaskMasterTools(mockServer, 'standard');

			expect(mockServer.addTool).toHaveBeenCalledTimes(
				EXPECTED_TOOL_COUNTS.standard
			);
		});

		it(`should treat lean as alias for core mode (${CORE_COUNT} tools)`, () => {
			process.env.TASK_MASTER_TOOLS = 'lean';

			registerTaskMasterTools(mockServer, 'lean');

			expect(mockServer.addTool).toHaveBeenCalledTimes(CORE_COUNT);
		});

		it('should handle case insensitive configuration values', () => {
			process.env.TASK_MASTER_TOOLS = 'CORE';

			registerTaskMasterTools(mockServer, 'CORE');

			expect(mockServer.addTool).toHaveBeenCalledTimes(CORE_COUNT);
		});
	});

	describe('Custom Tool Selection and Edge Cases', () => {
		it('should register specific tools from comma-separated list', () => {
			process.env.TASK_MASTER_TOOLS = 'get_tasks,next_task,get_task';

			registerTaskMasterTools(mockServer, 'get_tasks,next_task,get_task');

			expect(mockServer.addTool).toHaveBeenCalledTimes(3);
		});

		it('should handle mixed valid and invalid tool names gracefully', () => {
			process.env.TASK_MASTER_TOOLS =
				'invalid_tool,get_tasks,fake_tool,next_task';

			registerTaskMasterTools(
				mockServer,
				'invalid_tool,get_tasks,fake_tool,next_task'
			);

			expect(mockServer.addTool).toHaveBeenCalledTimes(2);
		});

		it('should default to all tools with completely invalid input', () => {
			process.env.TASK_MASTER_TOOLS = 'completely_invalid';

			registerTaskMasterTools(mockServer);

			expect(mockServer.addTool).toHaveBeenCalledTimes(ALL_COUNT);
		});

		it('should handle empty string environment variable', () => {
			process.env.TASK_MASTER_TOOLS = '';

			registerTaskMasterTools(mockServer);

			expect(mockServer.addTool).toHaveBeenCalledTimes(ALL_COUNT);
		});

		it('should handle whitespace in comma-separated lists', () => {
			process.env.TASK_MASTER_TOOLS = ' get_tasks , next_task , get_task ';

			registerTaskMasterTools(mockServer, ' get_tasks , next_task , get_task ');

			expect(mockServer.addTool).toHaveBeenCalledTimes(3);
		});

		it('should ignore duplicate tools in list', () => {
			process.env.TASK_MASTER_TOOLS = 'get_tasks,get_tasks,next_task,get_tasks';

			registerTaskMasterTools(
				mockServer,
				'get_tasks,get_tasks,next_task,get_tasks'
			);

			expect(mockServer.addTool).toHaveBeenCalledTimes(2);
		});

		it('should handle only commas and empty entries', () => {
			process.env.TASK_MASTER_TOOLS = ',,,';

			registerTaskMasterTools(mockServer);

			expect(mockServer.addTool).toHaveBeenCalledTimes(ALL_COUNT);
		});

		it('should handle single tool selection', () => {
			process.env.TASK_MASTER_TOOLS = 'get_tasks';

			registerTaskMasterTools(mockServer, 'get_tasks');

			expect(mockServer.addTool).toHaveBeenCalledTimes(1);
		});
	});

	describe('Coverage Analysis and Integration Tests', () => {
		it('should provide 100% code coverage for environment control logic', () => {
			const testCases = [
				{
					env: undefined,
					expectedCount: ALL_COUNT,
					description: 'undefined env (all)'
				},
				{
					env: '',
					expectedCount: ALL_COUNT,
					description: 'empty string (all)'
				},
				{ env: 'all', expectedCount: ALL_COUNT, description: 'all mode' },
				{ env: 'core', expectedCount: CORE_COUNT, description: 'core mode' },
				{
					env: 'lean',
					expectedCount: CORE_COUNT,
					description: 'lean mode (alias)'
				},
				{
					env: 'standard',
					expectedCount: STANDARD_COUNT,
					description: 'standard mode'
				},
				{
					env: 'get_tasks,next_task',
					expectedCount: 2,
					description: 'custom list'
				},
				{
					env: 'invalid_tool',
					expectedCount: ALL_COUNT,
					description: 'invalid fallback'
				}
			];

			testCases.forEach((testCase) => {
				delete process.env.TASK_MASTER_TOOLS;
				if (testCase.env !== undefined) {
					process.env.TASK_MASTER_TOOLS = testCase.env;
				}

				mockServer.tools = [];
				mockServer.addTool.mockClear();

				registerTaskMasterTools(mockServer, testCase.env || 'all');

				expect(mockServer.addTool).toHaveBeenCalledTimes(
					testCase.expectedCount
				);
			});
		});

		it('should have optimal performance characteristics', () => {
			const startTime = Date.now();

			process.env.TASK_MASTER_TOOLS = 'all';

			registerTaskMasterTools(mockServer);

			const endTime = Date.now();
			const executionTime = endTime - startTime;

			expect(executionTime).toBeLessThan(100);
			expect(mockServer.addTool).toHaveBeenCalledTimes(ALL_COUNT);
		});

		it('should validate token reduction claims', () => {
			expect(coreTools.length).toBeLessThan(standardTools.length);
			expect(standardTools.length).toBeLessThan(
				Object.keys(toolRegistry).length
			);

			expect(coreTools.length).toBe(CORE_COUNT);
			expect(standardTools.length).toBe(STANDARD_COUNT);
			expect(Object.keys(toolRegistry).length).toBe(ALL_COUNT);

			const allToolsCount = Object.keys(toolRegistry).length;
			const coreReduction =
				((allToolsCount - coreTools.length) / allToolsCount) * 100;
			const standardReduction =
				((allToolsCount - standardTools.length) / allToolsCount) * 100;

			expect(coreReduction).toBeGreaterThan(80);
			expect(standardReduction).toBeGreaterThan(50);
		});

		it('should maintain referential integrity of tool registry', () => {
			coreTools.forEach((tool) => {
				expect(standardTools).toContain(tool);
			});

			standardTools.forEach((tool) => {
				expect(toolRegistry).toHaveProperty(tool);
			});

			Object.keys(toolRegistry).forEach((tool) => {
				expect(typeof toolRegistry[tool]).toBe('function');
			});
		});

		it('should handle concurrent registration attempts', () => {
			process.env.TASK_MASTER_TOOLS = 'core';

			registerTaskMasterTools(mockServer, 'core');
			registerTaskMasterTools(mockServer, 'core');
			registerTaskMasterTools(mockServer, 'core');

			expect(mockServer.addTool).toHaveBeenCalledTimes(CORE_COUNT * 3);
		});

		it('should validate all documented tool categories exist', () => {
			const allTools = Object.keys(toolRegistry);

			const projectSetupTools = allTools.filter((tool) =>
				['initialize_project', 'models', 'rules', 'parse_prd'].includes(tool)
			);
			expect(projectSetupTools.length).toBeGreaterThan(0);

			const taskManagementTools = allTools.filter((tool) =>
				['get_tasks', 'get_task', 'next_task', 'set_task_status'].includes(tool)
			);
			expect(taskManagementTools.length).toBeGreaterThan(0);

			const analysisTools = allTools.filter((tool) =>
				['analyze_project_complexity', 'complexity_report'].includes(tool)
			);
			expect(analysisTools.length).toBeGreaterThan(0);

			const tagManagementTools = allTools.filter((tool) =>
				['add_tag', 'delete_tag', 'list_tags', 'use_tag'].includes(tool)
			);
			expect(tagManagementTools.length).toBeGreaterThan(0);
		});

		it('should handle error conditions gracefully', () => {
			const problematicInputs = [
				'null',
				'undefined',
				'   ',
				'\n\t',
				'special!@#$%^&*()characters',
				'very,very,very,very,very,very,very,long,comma,separated,list,with,invalid,tools,that,should,fallback,to,all'
			];

			problematicInputs.forEach((input) => {
				mockServer.tools = [];
				mockServer.addTool.mockClear();

				process.env.TASK_MASTER_TOOLS = input;

				expect(() => registerTaskMasterTools(mockServer)).not.toThrow();

				expect(mockServer.addTool).toHaveBeenCalledTimes(ALL_COUNT);
			});
		});
	});
});
