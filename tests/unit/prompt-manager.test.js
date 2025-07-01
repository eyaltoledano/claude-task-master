import {
	jest,
	beforeEach,
	afterEach,
	describe,
	it,
	expect
} from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

// Create mock functions
const mockReadFile = jest.fn();

// Mock fs/promises before importing modules that use it
jest.unstable_mockModule('fs/promises', () => ({
	default: {
		readFile: mockReadFile
	},
	readFile: mockReadFile
}));

// Import after mocking
const { getPromptManager } = await import(
	'../../scripts/modules/prompt-manager.js'
);

describe('PromptManager', () => {
	let promptManager;
	// Calculate expected templates directory
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const expectedTemplatesDir = path.join(
		__dirname,
		'..',
		'..',
		'src',
		'prompts'
	);

	beforeEach(() => {
		// Clear all mocks
		jest.clearAllMocks();

		// Get the singleton instance
		promptManager = getPromptManager();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('loadPrompt', () => {
		it('should load and render a simple prompt template', async () => {
			const mockTemplate = {
				id: 'test-prompt',
				prompts: {
					default: {
						system: 'You are a helpful assistant',
						user: 'Hello {{name}}, please {{action}}'
					}
				}
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			const result = await promptManager.loadPrompt('test-prompt', {
				name: 'Alice',
				action: 'help me'
			});

			expect(result.systemPrompt).toBe('You are a helpful assistant');
			expect(result.userPrompt).toBe('Hello Alice, please help me');
			expect(mockReadFile).toHaveBeenCalledWith(
				path.join(expectedTemplatesDir, 'test-prompt.json'),
				'utf-8'
			);
		});

		it('should handle conditional content', async () => {
			const mockTemplate = {
				id: 'conditional-prompt',
				prompts: {
					default: {
						system: 'System prompt',
						user: '{{#if useResearch}}Research and {{/if}}analyze the task'
					}
				}
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			// Test with useResearch = true
			let result = await promptManager.loadPrompt('conditional-prompt', {
				useResearch: true
			});
			expect(result.userPrompt).toBe('Research and analyze the task');

			// Test with useResearch = false
			result = await promptManager.loadPrompt('conditional-prompt', {
				useResearch: false
			});
			expect(result.userPrompt).toBe('analyze the task');
		});

		it('should handle array iteration with {{#each}}', async () => {
			const mockTemplate = {
				id: 'loop-prompt',
				prompts: {
					default: {
						system: 'System prompt',
						user: 'Tasks:\n{{#each tasks}}- {{id}}: {{title}}\n{{/each}}'
					}
				}
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			const result = await promptManager.loadPrompt('loop-prompt', {
				tasks: [
					{ id: 1, title: 'First task' },
					{ id: 2, title: 'Second task' }
				]
			});

			expect(result.userPrompt).toBe(
				'Tasks:\n- 1: First task\n- 2: Second task\n'
			);
		});

		it('should handle JSON serialization with triple braces', async () => {
			const mockTemplate = {
				id: 'json-prompt',
				prompts: {
					default: {
						system: 'System prompt',
						user: 'Analyze these tasks: {{{json tasks}}}'
					}
				}
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			const tasks = [
				{ id: 1, title: 'Task 1' },
				{ id: 2, title: 'Task 2' }
			];

			const result = await promptManager.loadPrompt('json-prompt', { tasks });

			expect(result.userPrompt).toBe(
				`Analyze these tasks: ${JSON.stringify(tasks, null, 2)}`
			);
		});

		it('should select variants based on conditions', async () => {
			const mockTemplate = {
				id: 'variant-prompt',
				prompts: {
					default: {
						system: 'Default system',
						user: 'Default user'
					},
					research: {
						condition: 'useResearch === true',
						system: 'Research system',
						user: 'Research user'
					},
					highComplexity: {
						condition: 'complexity >= 8',
						system: 'Complex system',
						user: 'Complex user'
					}
				}
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			// Test default variant
			let result = await promptManager.loadPrompt('variant-prompt', {
				useResearch: false,
				complexity: 5
			});
			expect(result.systemPrompt).toBe('Default system');

			// Test research variant
			result = await promptManager.loadPrompt('variant-prompt', {
				useResearch: true,
				complexity: 5
			});
			expect(result.systemPrompt).toBe('Research system');

			// Test high complexity variant
			result = await promptManager.loadPrompt('variant-prompt', {
				useResearch: false,
				complexity: 9
			});
			expect(result.systemPrompt).toBe('Complex system');
		});

		it('should use specified variant key over conditions', async () => {
			const mockTemplate = {
				id: 'variant-prompt',
				prompts: {
					default: {
						system: 'Default system',
						user: 'Default user'
					},
					research: {
						condition: 'useResearch === true',
						system: 'Research system',
						user: 'Research user'
					}
				}
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			// Force research variant even though useResearch is false
			const result = await promptManager.loadPrompt(
				'variant-prompt',
				{ useResearch: false },
				'research'
			);

			expect(result.systemPrompt).toBe('Research system');
		});

		it('should handle nested properties with dot notation', async () => {
			const mockTemplate = {
				id: 'nested-prompt',
				prompts: {
					default: {
						system: 'System',
						user: 'Project: {{project.name}}, Version: {{project.version}}'
					}
				}
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			const result = await promptManager.loadPrompt('nested-prompt', {
				project: {
					name: 'TaskMaster',
					version: '1.0.0'
				}
			});

			expect(result.userPrompt).toBe('Project: TaskMaster, Version: 1.0.0');
		});

		it('should handle complex nested structures', async () => {
			const mockTemplate = {
				id: 'complex-prompt',
				prompts: {
					default: {
						system: 'System',
						user: '{{#if hasSubtasks}}Task has subtasks:\n{{#each subtasks}}- {{title}} ({{status}})\n{{/each}}{{/if}}'
					}
				}
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			const result = await promptManager.loadPrompt('complex-prompt', {
				hasSubtasks: true,
				subtasks: [
					{ title: 'Subtask 1', status: 'pending' },
					{ title: 'Subtask 2', status: 'done' }
				]
			});

			expect(result.userPrompt).toBe(
				'Task has subtasks:\n- Subtask 1 (pending)\n- Subtask 2 (done)\n'
			);
		});

		it('should cache loaded templates', async () => {
			const mockTemplate = {
				id: 'cached-prompt',
				prompts: {
					default: {
						system: 'System',
						user: 'User {{value}}'
					}
				}
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			// First load
			await promptManager.loadPrompt('cached-prompt', { value: 'test1' });
			expect(mockReadFile).toHaveBeenCalledTimes(1);

			// Second load with same params should use cache
			await promptManager.loadPrompt('cached-prompt', { value: 'test1' });
			expect(mockReadFile).toHaveBeenCalledTimes(1);

			// Third load with different params should NOT use cache
			await promptManager.loadPrompt('cached-prompt', { value: 'test2' });
			expect(mockReadFile).toHaveBeenCalledTimes(2);
		});

		it('should throw error for non-existent template', async () => {
			const error = new Error('File not found');
			error.code = 'ENOENT';
			mockReadFile.mockRejectedValue(error);

			await expect(
				promptManager.loadPrompt('non-existent', {})
			).rejects.toThrow();
		});

		it('should throw error for invalid JSON', async () => {
			mockReadFile.mockResolvedValue('{ invalid json');

			await expect(
				promptManager.loadPrompt('invalid-json', {})
			).rejects.toThrow();
		});

		it('should handle missing prompts section', async () => {
			const mockTemplate = {
				id: 'no-prompts'
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			await expect(
				promptManager.loadPrompt('no-prompts', {})
			).rejects.toThrow();
		});

		it('should handle special characters in templates', async () => {
			const mockTemplate = {
				id: 'special-chars',
				prompts: {
					default: {
						system: 'System with "quotes" and \'apostrophes\'',
						user: 'User with newlines\nand\ttabs'
					}
				}
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockTemplate));

			const result = await promptManager.loadPrompt('special-chars', {});

			expect(result.systemPrompt).toBe(
				'System with "quotes" and \'apostrophes\''
			);
			expect(result.userPrompt).toBe('User with newlines\nand\ttabs');
		});
	});

	describe('singleton behavior', () => {
		it('should return the same instance on multiple calls', () => {
			const instance1 = getPromptManager();
			const instance2 = getPromptManager();

			expect(instance1).toBe(instance2);
		});
	});
});
