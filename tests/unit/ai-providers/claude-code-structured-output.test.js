import { jest } from '@jest/globals';
import { z } from 'zod';

/**
 * Tests for Claude Code native structured output support (v2.2.0+)
 *
 * ai-sdk-provider-claude-code v2.2.0 introduced native structured outputs via
 * the Claude Agent SDK's outputFormat option. When using generateObject() with
 * a schema, the SDK now guarantees schema-compliant JSON through constrained decoding.
 *
 * Key behaviors tested:
 * 1. Schema is passed correctly to the SDK
 * 2. mode: 'json' is used (which enables native outputFormat in the SDK)
 * 3. SDK error handling for schema validation failures
 */

// Mock generateObject from 'ai' SDK
const mockGenerateObject = jest.fn();

jest.unstable_mockModule('ai', () => ({
	generateObject: mockGenerateObject,
	generateText: jest.fn(),
	streamText: jest.fn(),
	streamObject: jest.fn(),
	zodSchema: jest.fn((schema) => schema),
	JSONParseError: class JSONParseError extends Error {
		constructor(message, text) {
			super(message);
			this.text = text;
		}
	},
	NoObjectGeneratedError: class NoObjectGeneratedError extends Error {
		static isInstance(error) {
			return error instanceof NoObjectGeneratedError;
		}
	}
}));

// Mock jsonrepair
jest.unstable_mockModule('jsonrepair', () => ({
	jsonrepair: jest.fn((text) => text)
}));

// Mock the ai-sdk-provider-claude-code package
jest.unstable_mockModule('ai-sdk-provider-claude-code', () => ({
	createClaudeCode: jest.fn(() => {
		const provider = (modelId) => ({
			id: modelId,
			specificationVersion: 'v1',
			provider: 'claude-code',
			modelId
		});
		provider.languageModel = provider;
		provider.chat = provider;
		return provider;
	})
}));

// Mock config getters
jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	getClaudeCodeSettingsForCommand: jest.fn(() => ({})),
	getSupportedModelsForProvider: jest.fn(() => ['opus', 'sonnet', 'haiku']),
	getDebugFlag: jest.fn(() => false),
	getLogLevel: jest.fn(() => 'info'),
	isProxyEnabled: jest.fn(() => false),
	getAnonymousTelemetryEnabled: jest.fn(() => true)
}));

// Mock utils
jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	findProjectRoot: jest.fn(() => '/test/project'),
	resolveEnvVariable: jest.fn((key) => process.env[key])
}));

// Import after mocking
const { ClaudeCodeProvider } = await import(
	'../../../src/ai-providers/claude-code.js'
);

describe('ClaudeCodeProvider structured outputs (v2.2.0+)', () => {
	let provider;

	beforeEach(() => {
		provider = new ClaudeCodeProvider();
		jest.clearAllMocks();
	});

	describe('needsExplicitJsonSchema flag', () => {
		it('should have needsExplicitJsonSchema set to true', () => {
			// This flag triggers mode: 'json' in base-provider.js generateObject()
			// which in turn enables the SDK's native outputFormat with constrained decoding
			expect(provider.needsExplicitJsonSchema).toBe(true);
		});

		it('should not support temperature parameter', () => {
			// Claude Code SDK doesn't support temperature
			expect(provider.supportsTemperature).toBe(false);
		});
	});

	describe('generateObject with schema', () => {
		const testSchema = z.object({
			name: z.string(),
			age: z.number(),
			email: z.string().email()
		});

		const testMessages = [
			{ role: 'system', content: 'You are a helpful assistant.' },
			{ role: 'user', content: 'Generate a user profile' }
		];

		beforeEach(() => {
			// Mock successful generateObject response
			mockGenerateObject.mockResolvedValue({
				object: { name: 'Test User', age: 25, email: 'test@example.com' },
				usage: {
					promptTokens: 100,
					completionTokens: 50,
					totalTokens: 150
				}
			});
		});

		it('should pass schema to generateObject call', async () => {
			await provider.generateObject({
				apiKey: 'test-key',
				modelId: 'sonnet',
				messages: testMessages,
				schema: testSchema,
				objectName: 'user_profile'
			});

			expect(mockGenerateObject).toHaveBeenCalledWith(
				expect.objectContaining({
					schema: testSchema
				})
			);
		});

		it('should use json mode for Claude Code (enables native outputFormat)', async () => {
			await provider.generateObject({
				apiKey: 'test-key',
				modelId: 'sonnet',
				messages: testMessages,
				schema: testSchema,
				objectName: 'user_profile'
			});

			// mode: 'json' is set when needsExplicitJsonSchema is true
			// This triggers the SDK to use outputFormat: { type: 'json_schema', schema: ... }
			expect(mockGenerateObject).toHaveBeenCalledWith(
				expect.objectContaining({
					mode: 'json'
				})
			);
		});

		it('should pass schemaName for better SDK context', async () => {
			await provider.generateObject({
				apiKey: 'test-key',
				modelId: 'sonnet',
				messages: testMessages,
				schema: testSchema,
				objectName: 'user_profile'
			});

			expect(mockGenerateObject).toHaveBeenCalledWith(
				expect.objectContaining({
					schemaName: 'user_profile'
				})
			);
		});

		it('should return structured object from SDK', async () => {
			const result = await provider.generateObject({
				apiKey: 'test-key',
				modelId: 'sonnet',
				messages: testMessages,
				schema: testSchema,
				objectName: 'user_profile'
			});

			expect(result.object).toEqual({
				name: 'Test User',
				age: 25,
				email: 'test@example.com'
			});
		});

		it('should return usage information', async () => {
			const result = await provider.generateObject({
				apiKey: 'test-key',
				modelId: 'sonnet',
				messages: testMessages,
				schema: testSchema,
				objectName: 'user_profile'
			});

			expect(result.usage).toEqual({
				inputTokens: 100,
				outputTokens: 50,
				totalTokens: 150
			});
		});
	});

	describe('complex schemas', () => {
		it('should handle nested object schemas', async () => {
			const complexSchema = z.object({
				tasks: z.array(
					z.object({
						id: z.number(),
						title: z.string(),
						subtasks: z.array(
							z.object({
								id: z.number(),
								title: z.string()
							})
						)
					})
				)
			});

			mockGenerateObject.mockResolvedValue({
				object: {
					tasks: [
						{
							id: 1,
							title: 'Main Task',
							subtasks: [{ id: 1, title: 'Subtask 1' }]
						}
					]
				},
				usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 }
			});

			const result = await provider.generateObject({
				apiKey: 'test-key',
				modelId: 'sonnet',
				messages: [{ role: 'user', content: 'Generate tasks' }],
				schema: complexSchema,
				objectName: 'task_list'
			});

			expect(result.object.tasks).toHaveLength(1);
			expect(result.object.tasks[0].subtasks).toHaveLength(1);
		});

		it('should handle enum schemas (like task priority)', async () => {
			const prioritySchema = z.object({
				priority: z.enum(['high', 'medium', 'low']),
				title: z.string()
			});

			mockGenerateObject.mockResolvedValue({
				object: { priority: 'high', title: 'Important Task' },
				usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 }
			});

			const result = await provider.generateObject({
				apiKey: 'test-key',
				modelId: 'sonnet',
				messages: [{ role: 'user', content: 'Create a task' }],
				schema: prioritySchema,
				objectName: 'task'
			});

			expect(result.object.priority).toBe('high');
		});
	});

	describe('error handling', () => {
		it('should throw error when schema is missing', async () => {
			await expect(
				provider.generateObject({
					apiKey: 'test-key',
					modelId: 'sonnet',
					messages: [{ role: 'user', content: 'test' }],
					objectName: 'test'
					// schema is missing
				})
			).rejects.toThrow('Schema is required');
		});

		it('should throw error when objectName is missing', async () => {
			await expect(
				provider.generateObject({
					apiKey: 'test-key',
					modelId: 'sonnet',
					messages: [{ role: 'user', content: 'test' }],
					schema: z.object({ name: z.string() })
					// objectName is missing
				})
			).rejects.toThrow('Object name is required');
		});

		it('should handle SDK errors gracefully', async () => {
			mockGenerateObject.mockRejectedValue(
				new Error('SDK error: Failed to generate')
			);

			await expect(
				provider.generateObject({
					apiKey: 'test-key',
					modelId: 'sonnet',
					messages: [{ role: 'user', content: 'test' }],
					schema: z.object({ name: z.string() }),
					objectName: 'test'
				})
			).rejects.toThrow();
		});
	});

	describe('v2.2.0 native structured output benefits', () => {
		/**
		 * These tests document the expected behavior with v2.2.0's native schema support.
		 * The SDK now handles schema validation internally through constrained decoding,
		 * so the jsonrepair fallback in base-provider.js should rarely be triggered
		 * for Claude Code operations.
		 */

		it('should work with Task Master command schemas', async () => {
			// This simulates the expand-task schema pattern
			const expandTaskSchema = z.object({
				subtasks: z.array(
					z.object({
						id: z.number().int().positive(),
						title: z.string().min(1),
						description: z.string().min(1),
						dependencies: z.array(z.number().int()),
						details: z.string(),
						testStrategy: z.string()
					})
				)
			});

			mockGenerateObject.mockResolvedValue({
				object: {
					subtasks: [
						{
							id: 1,
							title: 'Implement feature X',
							description: 'Description for feature X',
							dependencies: [],
							details: 'Implementation details',
							testStrategy: 'Unit tests for feature X'
						}
					]
				},
				usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 }
			});

			const result = await provider.generateObject({
				apiKey: 'test-key',
				modelId: 'sonnet',
				messages: [{ role: 'user', content: 'Expand task into subtasks' }],
				schema: expandTaskSchema,
				objectName: 'subtasks'
			});

			expect(result.object.subtasks).toHaveLength(1);
			expect(result.object.subtasks[0].id).toBe(1);
			expect(result.object.subtasks[0].title).toBe('Implement feature X');
		});
	});
});
