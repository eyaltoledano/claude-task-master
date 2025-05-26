import { jest } from '@jest/globals';

// Create a more complete mock of child process
class MockChildProcess {
	constructor() {
		this.stdin = {
			write: jest.fn(),
			end: jest.fn()
		};
		this.stdout = {
			on: jest.fn()
		};
		this.stderr = {
			on: jest.fn()
		};
		this.on = jest.fn();
	}
}

// Mock spawn globally
global.mockSpawn = jest.fn();

// Mock child_process module before importing claude-code
jest.unstable_mockModule('child_process', () => ({
	spawn: global.mockSpawn
}));

// Import after mocking
const claudeCode = await import('../../../src/ai-providers/claude-code.js');
const {
	generateClaudeCodeText,
	generateClaudeCodeObject,
	streamClaudeCodeText
} = claudeCode;

describe('Claude Code Provider', () => {
	let mockChildProcess;

	beforeEach(() => {
		jest.clearAllMocks();
		mockChildProcess = new MockChildProcess();
		global.mockSpawn.mockReturnValue(mockChildProcess);
	});

	describe('generateClaudeCodeText', () => {
		it('should generate text successfully', async () => {
			const messages = [
				{ role: 'system', content: 'You are a helpful assistant.' },
				{ role: 'user', content: 'Hello, Claude!' }
			];

			// Mock successful response
			const mockResponse = {
				result: 'Hello! How can I help you today?',
				cost_usd: 0
			};

			// Mock the command execution
			global.mockSpawn.mockImplementation(() => {
				const child = new MockChildProcess();

				// Mock stdout data event
				child.stdout.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						// Emit data immediately
						setTimeout(() => callback(JSON.stringify(mockResponse)), 0);
					}
				});

				// Mock close event
				child.on.mockImplementation((event, callback) => {
					if (event === 'close') {
						// Emit close immediately after data
						setTimeout(() => callback(0), 10);
					}
				});

				return child;
			});

			const result = await generateClaudeCodeText({
				messages,
				maxTokens: 1000,
				temperature: 0.7
			});

			expect(result).toEqual({
				text: 'Hello! How can I help you today?',
				usage: {
					inputTokens: 0,
					outputTokens: 0,
					costUSD: 0
				}
			});

			expect(global.mockSpawn).toHaveBeenCalledWith('claude', [
				'--print',
				'--output-format',
				'json'
			]);
		});

		it('should handle Claude Code not installed error', async () => {
			const messages = [{ role: 'user', content: 'Test' }];

			// Mock spawn error (command not found)
			global.mockSpawn.mockImplementation(() => {
				const error = new Error('spawn claude ENOENT');
				error.code = 'ENOENT';
				throw error;
			});

			await expect(generateClaudeCodeText({ messages })).rejects.toThrow(
				'Claude Code CLI not found. Please install it first'
			);
		});

		it('should handle non-zero exit code', async () => {
			const messages = [{ role: 'user', content: 'Test' }];

			global.mockSpawn.mockImplementation(() => {
				const child = new MockChildProcess();

				child.stderr.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						setTimeout(() => callback('Error: Something went wrong'), 0);
					}
				});

				child.on.mockImplementation((event, callback) => {
					if (event === 'close') {
						setTimeout(() => callback(1), 10);
					}
				});

				return child;
			});

			await expect(generateClaudeCodeText({ messages })).rejects.toThrow(
				'Claude Code CLI exited with code 1'
			);
		});

		it('should handle JSON parse errors', async () => {
			const messages = [{ role: 'user', content: 'Test' }];

			global.mockSpawn.mockImplementation(() => {
				const child = new MockChildProcess();

				child.stdout.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						setTimeout(() => callback('Invalid JSON response'), 0);
					}
				});

				child.on.mockImplementation((event, callback) => {
					if (event === 'close') {
						setTimeout(() => callback(0), 10);
					}
				});

				return child;
			});

			await expect(generateClaudeCodeText({ messages })).rejects.toThrow(
				'Unexpected token'
			);
		});
	});

	describe('generateClaudeCodeObject', () => {
		it('should generate structured object successfully', async () => {
			const messages = [{ role: 'user', content: 'Generate a task object' }];
			const schema = {
				type: 'object',
				properties: {
					title: { type: 'string' },
					description: { type: 'string' }
				}
			};

			const mockResponse = {
				result: '{"title": "Test Task", "description": "A test task"}',
				cost_usd: 0
			};

			global.mockSpawn.mockImplementation(() => {
				const child = new MockChildProcess();

				child.stdout.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						setTimeout(() => callback(JSON.stringify(mockResponse)), 0);
					}
				});

				child.on.mockImplementation((event, callback) => {
					if (event === 'close') {
						setTimeout(() => callback(0), 10);
					}
				});

				return child;
			});

			const result = await generateClaudeCodeObject({ messages, schema });

			expect(result).toEqual({
				object: {
					title: 'Test Task',
					description: 'A test task'
				},
				usage: {
					inputTokens: 0,
					outputTokens: 0,
					costUSD: 0
				}
			});
		});

		it('should handle invalid structured response', async () => {
			const messages = [{ role: 'user', content: 'Test' }];
			const schema = { type: 'object' };

			const mockResponse = {
				result: 'Not a valid JSON object',
				cost_usd: 0
			};

			global.mockSpawn.mockImplementation(() => {
				const child = new MockChildProcess();

				child.stdout.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						setTimeout(() => callback(JSON.stringify(mockResponse)), 0);
					}
				});

				child.on.mockImplementation((event, callback) => {
					if (event === 'close') {
						setTimeout(() => callback(0), 10);
					}
				});

				return child;
			});

			await expect(
				generateClaudeCodeObject({ messages, schema })
			).rejects.toThrow('Failed to parse Claude Code response as valid JSON');
		});
	});

	describe('streamClaudeCodeText', () => {
		it('should fallback to non-streaming text generation', async () => {
			const messages = [{ role: 'user', content: 'Stream test' }];

			const mockResponse = {
				result: 'Streaming response',
				cost_usd: 0
			};

			global.mockSpawn.mockImplementation(() => {
				const child = new MockChildProcess();

				child.stdout.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						setTimeout(() => callback(JSON.stringify(mockResponse)), 0);
					}
				});

				child.on.mockImplementation((event, callback) => {
					if (event === 'close') {
						setTimeout(() => callback(0), 10);
					}
				});

				return child;
			});

			const result = await streamClaudeCodeText({
				messages,
				maxTokens: 1000
			});

			// Since it falls back to regular generation, check the structure
			expect(result).toHaveProperty('textStream');
			expect(result).toHaveProperty('usage');

			// Verify the async iterator works
			const chunks = [];
			for await (const chunk of result.textStream) {
				chunks.push(chunk);
			}
			expect(chunks).toEqual(['Streaming response']);
		});
	});
});
