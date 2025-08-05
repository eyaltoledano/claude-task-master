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
const mockReadFileSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockExistsSync = jest.fn();

// Set up default mock for supported-models.json to prevent config-manager from failing
mockReadFileSync.mockImplementation((filePath) => {
	if (filePath.includes('supported-models.json')) {
		return JSON.stringify({
			anthropic: [{ id: 'claude-3-5-sonnet', max_tokens: 8192 }],
			openai: [{ id: 'gpt-4', max_tokens: 8192 }]
		});
	}
	// Default return for other files
	return '{}';
});

// Mock fs before importing modules that use it
jest.unstable_mockModule('fs', () => ({
	default: {
		readFileSync: mockReadFileSync,
		readdirSync: mockReaddirSync,
		existsSync: mockExistsSync
	},
	readFileSync: mockReadFileSync,
	readdirSync: mockReaddirSync,
	existsSync: mockExistsSync
}));

// Mock process.exit to prevent tests from exiting
const mockExit = jest.fn();
jest.unstable_mockModule('process', () => ({
	default: {
		exit: mockExit,
		env: {}
	},
	exit: mockExit
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

		// Re-setup the default mock after clearing
		mockReadFileSync.mockImplementation((filePath) => {
			if (filePath.includes('supported-models.json')) {
				return JSON.stringify({
					anthropic: [{ id: 'claude-3-5-sonnet', max_tokens: 8192 }],
					openai: [{ id: 'gpt-4', max_tokens: 8192 }]
				});
			}
			// Default return for other files
			return '{}';
		});

		// Get the singleton instance
		promptManager = getPromptManager();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('loadPrompt', () => {
		it('should load and render a simple prompt template', () => {
			const mockTemplate = {
				id: 'test-prompt',
				prompts: {
					default: {
						system: 'You are a helpful assistant',
						user: 'Hello {{name}}, please {{action}}'
					}
				}
			};

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			const result = promptManager.loadPrompt('test-prompt', {
				name: 'Alice',
				action: 'help me'
			});

			expect(result.systemPrompt).toBe('You are a helpful assistant');
			expect(result.userPrompt).toBe('Hello Alice, please help me');
			expect(mockReadFileSync).toHaveBeenCalledWith(
				path.join(expectedTemplatesDir, 'test-prompt.json'),
				'utf-8'
			);
		});

		it('should handle conditional content', () => {
			const mockTemplate = {
				id: 'conditional-prompt',
				prompts: {
					default: {
						system: 'System prompt',
						user: '{{#if useResearch}}Research and {{/if}}analyze the task'
					}
				}
			};

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			// Test with useResearch = true
			let result = promptManager.loadPrompt('conditional-prompt', {
				useResearch: true
			});
			expect(result.userPrompt).toBe('Research and analyze the task');

			// Test with useResearch = false
			result = promptManager.loadPrompt('conditional-prompt', {
				useResearch: false
			});
			expect(result.userPrompt).toBe('analyze the task');
		});

		it('should handle array iteration with {{#each}}', () => {
			const mockTemplate = {
				id: 'loop-prompt',
				prompts: {
					default: {
						system: 'System prompt',
						user: 'Tasks:\n{{#each tasks}}- {{id}}: {{title}}\n{{/each}}'
					}
				}
			};

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			const result = promptManager.loadPrompt('loop-prompt', {
				tasks: [
					{ id: 1, title: 'First task' },
					{ id: 2, title: 'Second task' }
				]
			});

			expect(result.userPrompt).toBe(
				'Tasks:\n- 1: First task\n- 2: Second task\n'
			);
		});

		it('should handle JSON serialization with triple braces', () => {
			const mockTemplate = {
				id: 'json-prompt',
				prompts: {
					default: {
						system: 'System prompt',
						user: 'Analyze these tasks: {{{json tasks}}}'
					}
				}
			};

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			const tasks = [
				{ id: 1, title: 'Task 1' },
				{ id: 2, title: 'Task 2' }
			];

			const result = promptManager.loadPrompt('json-prompt', { tasks });

			expect(result.userPrompt).toBe(
				`Analyze these tasks: ${JSON.stringify(tasks, null, 2)}`
			);
		});

		it('should select variants based on conditions', () => {
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

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			// Test default variant
			let result = promptManager.loadPrompt('variant-prompt', {
				useResearch: false,
				complexity: 5
			});
			expect(result.systemPrompt).toBe('Default system');

			// Test research variant
			result = promptManager.loadPrompt('variant-prompt', {
				useResearch: true,
				complexity: 5
			});
			expect(result.systemPrompt).toBe('Research system');

			// Test high complexity variant
			result = promptManager.loadPrompt('variant-prompt', {
				useResearch: false,
				complexity: 9
			});
			expect(result.systemPrompt).toBe('Complex system');
		});

		it('should use specified variant key over conditions', () => {
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

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			// Force research variant even though useResearch is false
			const result = promptManager.loadPrompt(
				'variant-prompt',
				{ useResearch: false },
				'research'
			);

			expect(result.systemPrompt).toBe('Research system');
		});

		it('should handle nested properties with dot notation', () => {
			const mockTemplate = {
				id: 'nested-prompt',
				prompts: {
					default: {
						system: 'System',
						user: 'Project: {{project.name}}, Version: {{project.version}}'
					}
				}
			};

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			const result = promptManager.loadPrompt('nested-prompt', {
				project: {
					name: 'TaskMaster',
					version: '1.0.0'
				}
			});

			expect(result.userPrompt).toBe('Project: TaskMaster, Version: 1.0.0');
		});

		it('should handle complex nested structures', () => {
			const mockTemplate = {
				id: 'complex-prompt',
				prompts: {
					default: {
						system: 'System',
						user: '{{#if hasSubtasks}}Task has subtasks:\n{{#each subtasks}}- {{title}} ({{status}})\n{{/each}}{{/if}}'
					}
				}
			};

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			const result = promptManager.loadPrompt('complex-prompt', {
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

		it('should cache loaded templates', () => {
			const mockTemplate = {
				id: 'cached-prompt',
				prompts: {
					default: {
						system: 'System',
						user: 'User {{value}}'
					}
				}
			};

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			// First load
			promptManager.loadPrompt('cached-prompt', { value: 'test1' });
			expect(mockReadFileSync).toHaveBeenCalledTimes(1);

			// Second load with same params should use cache
			promptManager.loadPrompt('cached-prompt', { value: 'test1' });
			expect(mockReadFileSync).toHaveBeenCalledTimes(1);

			// Third load with different params should NOT use cache
			promptManager.loadPrompt('cached-prompt', { value: 'test2' });
			expect(mockReadFileSync).toHaveBeenCalledTimes(2);
		});

		it('should throw error for non-existent template', () => {
			const error = new Error('File not found');
			error.code = 'ENOENT';
			mockReadFileSync.mockImplementation(() => {
				throw error;
			});

			expect(() => {
				promptManager.loadPrompt('non-existent', {});
			}).toThrow();
		});

		it('should throw error for invalid JSON', () => {
			mockReadFileSync.mockReturnValue('{ invalid json');

			expect(() => {
				promptManager.loadPrompt('invalid-json', {});
			}).toThrow();
		});

		it('should handle missing prompts section', () => {
			const mockTemplate = {
				id: 'no-prompts'
			};

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			expect(() => {
				promptManager.loadPrompt('no-prompts', {});
			}).toThrow();
		});

		it('should handle special characters in templates', () => {
			const mockTemplate = {
				id: 'special-chars',
				prompts: {
					default: {
						system: 'System with "quotes" and \'apostrophes\'',
						user: 'User with newlines\nand\ttabs'
					}
				}
			};

			mockReadFileSync.mockReturnValue(JSON.stringify(mockTemplate));

			const result = promptManager.loadPrompt('special-chars', {});

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
