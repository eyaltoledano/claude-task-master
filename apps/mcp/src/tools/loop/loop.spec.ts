/**
 * @fileoverview Unit tests for loop MCP tools
 *
 * Tests the loop_start and loop_presets MCP tools with mocked TmCore.
 * Verifies correct parameter passing, response formatting, and error handling.
 */

import type { FastMCP } from 'fastmcp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerLoopPresetsTool } from './presets.tool.js';
import { registerLoopStartTool } from './start.tool.js';

// Mock the shared utils module
vi.mock('../../shared/utils.js', async () => {
	const actual = await vi.importActual('../../shared/utils.js');
	return {
		...actual,
		withToolContext: (
			_commandName: string,
			executeFn: (args: any, context: any) => Promise<any>
		) => {
			// Return a function that calls executeFn with mock context
			return async (args: any, context: any) => {
				// Create mock tmCore if not provided
				const mockTmCore = context?.tmCore ?? {
					loop: {
						run: vi.fn().mockResolvedValue({
							totalIterations: 3,
							tasksCompleted: 2,
							finalStatus: 'all_complete',
							iterations: [
								{
									iteration: 1,
									duration: 1000,
									status: 'success',
									output: 'Task 1 completed'
								},
								{
									iteration: 2,
									duration: 1500,
									status: 'success',
									output: 'Task 2 completed'
								},
								{
									iteration: 3,
									duration: 1200,
									status: 'complete',
									output: '<loop-complete>ALL_DONE</loop-complete>'
								}
							]
						}),
						getAvailablePresets: vi.fn().mockReturnValue([
							'default',
							'test-coverage',
							'linting',
							'duplication',
							'entropy'
						])
					}
				};

				const mockContext = {
					log: {
						info: vi.fn(),
						debug: vi.fn(),
						error: vi.fn(),
						warn: vi.fn()
					},
					session: {},
					tmCore: mockTmCore,
					...context
				};

				// Ensure projectRoot is set
				const argsWithRoot = {
					projectRoot: '/test/project',
					...args
				};

				return executeFn(argsWithRoot, mockContext);
			};
		},
		handleApiResult: vi.fn().mockImplementation(async (options) => {
			const { result } = options;
			if (result.success) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ data: result.data, version: { version: '1.0.0', name: 'test' } },
								null,
								2
							)
						}
					]
				};
			}
			return {
				content: [
					{
						type: 'text',
						text: `Error: ${result.error?.message || 'Unknown error'}`
					}
				],
				isError: true
			};
		})
	};
});

describe('loop MCP tools', () => {
	let mockServer: FastMCP;
	let registeredTools: Map<string, any>;

	beforeEach(() => {
		vi.clearAllMocks();
		registeredTools = new Map();

		// Create mock FastMCP server
		mockServer = {
			addTool: vi.fn((toolConfig) => {
				registeredTools.set(toolConfig.name, toolConfig);
			})
		} as unknown as FastMCP;
	});

	describe('loop_start tool', () => {
		beforeEach(() => {
			registerLoopStartTool(mockServer);
		});

		it('should register tool with correct name and description', () => {
			expect(mockServer.addTool).toHaveBeenCalled();
			const tool = registeredTools.get('loop_start');
			expect(tool).toBeDefined();
			expect(tool.name).toBe('loop_start');
			expect(tool.description).toContain('loop');
		});

		it('should have destructiveHint annotation', () => {
			const tool = registeredTools.get('loop_start');
			expect(tool.annotations).toBeDefined();
			expect(tool.annotations.destructiveHint).toBe(true);
		});

		it('should define correct parameter schema', () => {
			const tool = registeredTools.get('loop_start');
			expect(tool.parameters).toBeDefined();

			// Parse the schema shape
			const shape = tool.parameters.shape;
			expect(shape.projectRoot).toBeDefined();
			expect(shape.iterations).toBeDefined();
			expect(shape.prompt).toBeDefined();
			expect(shape.progressFile).toBeDefined();
			expect(shape.sleepSeconds).toBeDefined();
			expect(shape.tag).toBeDefined();
			expect(shape.status).toBeDefined();
		});

		it('should execute successfully with default parameters', async () => {
			const tool = registeredTools.get('loop_start');
			const mockContext = {
				log: { info: vi.fn(), debug: vi.fn(), error: vi.fn() }
			};

			const result = await tool.execute(
				{ projectRoot: '/test/project' },
				mockContext
			);

			expect(result).toBeDefined();
			expect(result.content).toBeDefined();
			expect(result.content[0].type).toBe('text');

			// Parse the response to verify structure
			const responseData = JSON.parse(result.content[0].text);
			expect(responseData.data).toBeDefined();
			expect(responseData.data.success).toBe(true);
			expect(responseData.data.totalIterations).toBe(3);
			expect(responseData.data.tasksCompleted).toBe(2);
			expect(responseData.data.finalStatus).toBe('all_complete');
		});

		it('should pass custom parameters to tmCore.loop.run()', async () => {
			const tool = registeredTools.get('loop_start');

			const customRunFn = vi.fn().mockResolvedValue({
				totalIterations: 5,
				tasksCompleted: 3,
				finalStatus: 'completed',
				iterations: []
			});

			const mockContext = {
				log: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
				tmCore: {
					loop: {
						run: customRunFn,
						getAvailablePresets: vi.fn().mockReturnValue([])
					}
				}
			};

			await tool.execute(
				{
					projectRoot: '/test/project',
					iterations: 5,
					prompt: 'test-coverage',
					progressFile: '/custom/progress.txt',
					sleepSeconds: 10,
					tag: 'feature-branch',
					status: 'in-progress'
				},
				mockContext
			);

			expect(customRunFn).toHaveBeenCalledWith({
				iterations: 5,
				prompt: 'test-coverage',
				progressFile: '/custom/progress.txt',
				sleepSeconds: 10,
				tag: 'feature-branch',
				status: 'in-progress'
			});
		});

		it('should handle errors from tmCore.loop.run()', async () => {
			const tool = registeredTools.get('loop_start');

			const mockContext = {
				log: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
				tmCore: {
					loop: {
						run: vi.fn().mockRejectedValue(new Error('Loop execution failed')),
						getAvailablePresets: vi.fn().mockReturnValue([])
					}
				}
			};

			const result = await tool.execute(
				{ projectRoot: '/test/project' },
				mockContext
			);

			expect(result).toBeDefined();
			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain('Loop execution failed');
		});

		it('should log info about loop start', async () => {
			const tool = registeredTools.get('loop_start');
			const mockLog = { info: vi.fn(), debug: vi.fn(), error: vi.fn() };

			const mockContext = {
				log: mockLog,
				tmCore: {
					loop: {
						run: vi.fn().mockResolvedValue({
							totalIterations: 1,
							tasksCompleted: 1,
							finalStatus: 'complete',
							iterations: []
						}),
						getAvailablePresets: vi.fn().mockReturnValue([])
					}
				}
			};

			await tool.execute(
				{ projectRoot: '/test/project', prompt: 'linting', iterations: 3 },
				mockContext
			);

			expect(mockLog.info).toHaveBeenCalledWith(
				expect.stringContaining('linting')
			);
		});
	});

	describe('loop_presets tool', () => {
		beforeEach(() => {
			registerLoopPresetsTool(mockServer);
		});

		it('should register tool with correct name and description', () => {
			expect(mockServer.addTool).toHaveBeenCalled();
			const tool = registeredTools.get('loop_presets');
			expect(tool).toBeDefined();
			expect(tool.name).toBe('loop_presets');
			expect(tool.description).toContain('preset');
		});

		it('should have readOnlyHint annotation', () => {
			const tool = registeredTools.get('loop_presets');
			expect(tool.annotations).toBeDefined();
			expect(tool.annotations.readOnlyHint).toBe(true);
		});

		it('should return all available presets', async () => {
			const tool = registeredTools.get('loop_presets');
			const mockContext = {
				log: { info: vi.fn(), debug: vi.fn(), error: vi.fn() }
			};

			const result = await tool.execute(
				{ projectRoot: '/test/project' },
				mockContext
			);

			expect(result).toBeDefined();
			expect(result.content).toBeDefined();

			const responseData = JSON.parse(result.content[0].text);
			expect(responseData.data).toBeDefined();
			expect(responseData.data.presets).toHaveLength(5);

			const presetNames = responseData.data.presets.map(
				(p: { name: string }) => p.name
			);
			expect(presetNames).toContain('default');
			expect(presetNames).toContain('test-coverage');
			expect(presetNames).toContain('linting');
			expect(presetNames).toContain('duplication');
			expect(presetNames).toContain('entropy');
		});

		it('should include descriptions for each preset', async () => {
			const tool = registeredTools.get('loop_presets');
			const mockContext = {
				log: { info: vi.fn(), debug: vi.fn(), error: vi.fn() }
			};

			const result = await tool.execute(
				{ projectRoot: '/test/project' },
				mockContext
			);

			const responseData = JSON.parse(result.content[0].text);
			const presets = responseData.data.presets;

			// Each preset should have a name and description
			for (const preset of presets) {
				expect(preset.name).toBeDefined();
				expect(preset.description).toBeDefined();
				expect(typeof preset.description).toBe('string');
				expect(preset.description.length).toBeGreaterThan(0);
			}
		});

		it('should return count of presets', async () => {
			const tool = registeredTools.get('loop_presets');
			const mockContext = {
				log: { info: vi.fn(), debug: vi.fn(), error: vi.fn() }
			};

			const result = await tool.execute(
				{ projectRoot: '/test/project' },
				mockContext
			);

			const responseData = JSON.parse(result.content[0].text);
			expect(responseData.data.count).toBe(5);
		});

		it('should handle errors from tmCore.loop.getAvailablePresets()', async () => {
			const tool = registeredTools.get('loop_presets');

			const mockContext = {
				log: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
				tmCore: {
					loop: {
						run: vi.fn(),
						getAvailablePresets: vi
							.fn()
							.mockImplementation(() => {
								throw new Error('Failed to get presets');
							})
					}
				}
			};

			const result = await tool.execute(
				{ projectRoot: '/test/project' },
				mockContext
			);

			expect(result).toBeDefined();
			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain('Failed to get presets');
		});

		it('should log info about fetching presets', async () => {
			const tool = registeredTools.get('loop_presets');
			const mockLog = { info: vi.fn(), debug: vi.fn(), error: vi.fn() };

			const mockContext = {
				log: mockLog,
				tmCore: {
					loop: {
						run: vi.fn(),
						getAvailablePresets: vi.fn().mockReturnValue(['default'])
					}
				}
			};

			await tool.execute({ projectRoot: '/test/project' }, mockContext);

			expect(mockLog.info).toHaveBeenCalledWith(
				expect.stringContaining('preset')
			);
		});
	});

	describe('tool registration exports', () => {
		it('should export registerLoopStartTool function', () => {
			expect(typeof registerLoopStartTool).toBe('function');
		});

		it('should export registerLoopPresetsTool function', () => {
			expect(typeof registerLoopPresetsTool).toBe('function');
		});
	});
});
