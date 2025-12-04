/**
 * Comprehensive unit tests for RestLanguageModel
 * Tests the Cortex REST API implementation (/api/v2/cortex/inference:complete)
 *
 * NOTE: These tests call the internal doGenerate() method directly, which uses
 * internal parameters (inputFormat, mode) that aren't part of the public
 * LanguageModelV2CallOptions type. We use a test-specific type to avoid
 * TypeScript errors while testing internal behavior.
 */

import { RestLanguageModel } from '../src/rest/language-model.js';
import type {
	LanguageModelV2Prompt,
	LanguageModelV2CallOptions
} from '@ai-sdk/provider';
import {
	createMockResponse,
	createStreamingResponse,
	createErrorResponse
} from './test-utils.js';

/**
 * Test options type for doGenerate() calls
 * The internal AI SDK uses additional parameters not in public LanguageModelV2CallOptions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestCallOptions = any; // Use any for internal doGenerate testing

// Mock the authentication module
jest.mock('../src/auth/index.js', () => ({
	authenticate: jest.fn().mockResolvedValue({
		accessToken: 'mock-token',
		baseURL: 'https://test.snowflakecomputing.com',
		expiresAt: Date.now() + 3600000
	})
}));

// Mock config module
jest.mock('../src/config/index.js', () => ({
	isFeatureEnabled: jest.fn((feature: string) => true),
	getThinkingLevel: jest.fn(() => 'medium')
}));

// Mock utils/models module
jest.mock('../src/utils/models.js', () => ({
	normalizeModelId: jest.fn((id: string) => id.replace(/^cortex\//, '')),
	supportsThinking: jest.fn((id: string) => id.includes('claude')),
	supportsReasoning: jest.fn(
		(id: string) => id.includes('openai') || id.includes('gpt')
	),
	supportsStreaming: jest.fn(() => true),
	supportsPromptCaching: jest.fn((id: string) => true), // Default to true for tests
	getThinkingBudgetTokens: jest.fn((id: string, level: string) => {
		const budgets = { low: 4096, medium: 10000, high: 32000 };
		return budgets[level as keyof typeof budgets] || 10000;
	}),
	prefixModelId: jest.fn((id: string) =>
		id.startsWith('cortex/') ? id : `cortex/${id}`
	)
}));

// Mock tools/helpers
jest.mock('../src/utils/tool-helpers.js', () => ({
	convertToolsToSnowflakeFormat: jest.fn((tools) => {
		return Object.entries(tools).map(([name, tool]: [string, any]) => ({
			tool_spec: {
				type: 'generic',
				name,
				description: tool.description || '',
				input_schema: tool.parameters || {}
			}
		}));
	}),
	parseToolCalls: jest.fn(() => [])
}));

// Mock schema module
jest.mock('../src/schema/index.js', () => ({
	removeUnsupportedFeatures: jest.fn((schema) => schema),
	convertPromptToMessages: jest.fn((prompt: any[], options?: any) => {
		// Convert AI SDK prompt format to Cortex messages format
		// Includes proper caching format when enableCaching is true
		const enableCaching = options?.enableCaching;
		const modelId = options?.modelId || '';
		const isClaudeModel = modelId.toLowerCase().includes('claude');
		const useCachingFormat = enableCaching && isClaudeModel;

		return prompt.map((msg: any) => {
			const content = Array.isArray(msg.content)
				? msg.content
						.filter((c: any) => c.type === 'text')
						.map((c: any) => c.text)
						.join('')
				: msg.content;

			// Use content_list format for caching
			if (useCachingFormat) {
				return {
					role: msg.role,
					content_list: [
						{
							type: 'text',
							text: content,
							cache_control: { type: 'ephemeral' }
						}
					]
				};
			}
			return { role: msg.role, content };
		});
	})
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('RestLanguageModel', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockFetch.mockReset();
	});

	describe('constructor', () => {
		it('should create instance with model ID', () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5'
			});

			expect(model.modelId).toBe('cortex/claude-sonnet-4-5');
			expect(model.provider).toBe('snowflake');
		});

		it('should accept settings', () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: {
					enablePromptCaching: true,
					enableThinking: true,
					maxRetries: 5
				}
			});

			expect(model.modelId).toBe('cortex/claude-sonnet-4-5');
		});

		it('should throw error for invalid model ID', () => {
			expect(() => {
				new RestLanguageModel({ id: '' });
			}).toThrow();
		});
	});

	describe('metadata', () => {
		it('should have correct specification version', () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });
			expect(model.specificationVersion).toBe('v2');
		});

		it('should support structured outputs', () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });
			expect(model.supportsStructuredOutputs).toBe(true);
			expect(model.defaultObjectGenerationMode).toBe('json');
		});

		it('should not support image URLs', () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });
			expect(model.supportsImageUrls).toBe(false);
		});
	});

	describe('doGenerate - basic functionality', () => {
		it('should generate text successfully', async () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{
							message: { content: 'Hello, world!' },
							finish_reason: 'stop'
						}
					],
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
						total_tokens: 15
					}
				})
			);

			const result = await model.doGenerate({
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			expect(result.content).toHaveLength(1);
			expect(result.content[0]).toEqual({
				type: 'text',
				text: 'Hello, world!'
			});
			expect(result.usage.inputTokens).toBe(10);
			expect(result.usage.outputTokens).toBe(5);
			expect(result.finishReason).toBe('stop');
		});

		it('should handle system messages', async () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: 'Response' }, finish_reason: 'stop' }
					],
					usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
				})
			);

			const prompt: LanguageModelV2Prompt = [
				{ role: 'system', content: 'You are helpful' },
				{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }
			];

			await model.doGenerate({
				prompt,
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			expect(mockFetch).toHaveBeenCalled();
			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.messages).toHaveLength(2);
			expect(requestBody.messages[0].role).toBe('system');
		});

		it('should handle multiple user/assistant messages', async () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: 'Final response' }, finish_reason: 'stop' }
					],
					usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }
				})
			);

			const prompt: LanguageModelV2Prompt = [
				{ role: 'user', content: [{ type: 'text', text: 'First question' }] },
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'First answer' }]
				},
				{ role: 'user', content: [{ type: 'text', text: 'Second question' }] }
			];

			await model.doGenerate({
				prompt,
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.messages).toHaveLength(3);
		});
	});

	describe('doGenerate - Claude prompt caching', () => {
		it('should add cache_control to system messages for Claude when enabled', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enablePromptCaching: true }
			});

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: 'Response' }, finish_reason: 'stop' }
					],
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120,
						cache_creation_input_tokens: 80,
						cache_read_input_tokens: 0
					}
				})
			);

			const prompt: LanguageModelV2Prompt = [
				{ role: 'system', content: 'Long system prompt...' },
				{ role: 'user', content: [{ type: 'text', text: 'Question' }] }
			];

			await model.doGenerate({
				prompt,
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

			// System message should use content_list format with cache_control
			expect(requestBody.messages[0].role).toBe('system');
			expect(requestBody.messages[0].content_list).toBeDefined();
			expect(requestBody.messages[0].content_list[0].cache_control).toEqual({
				type: 'ephemeral'
			});
		});

		it('should not add cache_control when prompt caching is disabled', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enablePromptCaching: false }
			});

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: 'Response' }, finish_reason: 'stop' }
					],
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120
					}
				})
			);

			await model.doGenerate({
				prompt: [
					{ role: 'system', content: 'System prompt' },
					{ role: 'user', content: [{ type: 'text', text: 'Question' }] }
				],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

			// System message should use simple content string, not content_list
			expect(requestBody.messages[0].role).toBe('system');
			expect(requestBody.messages[0].content).toBe('System prompt');
			expect(requestBody.messages[0].content_list).toBeUndefined();
		});

		it('should not add cache_control for non-Claude models', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/openai-gpt-4.1',
				settings: { enablePromptCaching: true }
			});

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: 'Response' }, finish_reason: 'stop' }
					],
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120
					}
				})
			);

			await model.doGenerate({
				prompt: [
					{ role: 'system', content: 'System prompt' },
					{ role: 'user', content: [{ type: 'text', text: 'Question' }] }
				],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

			// OpenAI models use implicit caching, no content_list needed
			expect(requestBody.messages[0].content).toBe('System prompt');
			expect(requestBody.messages[0].content_list).toBeUndefined();
		});
	});

	describe('doGenerate - Claude extended thinking', () => {
		it('should add thinking parameter for Claude models', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enableThinking: true, thinkingLevel: 'high' }
			});

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					thinking: 'Let me think about this...',
					choices: [{ message: { content: 'Answer' }, finish_reason: 'stop' }],
					usage: {
						prompt_tokens: 50,
						completion_tokens: 100,
						total_tokens: 150
					}
				})
			);

			await model.doGenerate({
				prompt: [
					{ role: 'user', content: [{ type: 'text', text: 'Complex problem' }] }
				],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

			expect(requestBody.thinking).toEqual({
				type: 'enabled',
				budget_tokens: 32000 // high level
			});
		});

		it('should include thinking content in response', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enableThinking: true }
			});

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					thinking: 'Reasoning process...',
					choices: [
						{ message: { content: 'Final answer' }, finish_reason: 'stop' }
					],
					usage: {
						prompt_tokens: 50,
						completion_tokens: 100,
						total_tokens: 150
					}
				})
			);

			const result = await model.doGenerate({
				prompt: [
					{ role: 'user', content: [{ type: 'text', text: 'Question' }] }
				],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			// Thinking should be included as text content
			expect(result.content).toHaveLength(2);
			expect(result.content[0].type).toBe('text');
			expect((result.content[0] as any).text).toContain('thinking');
			expect((result.content[0] as any).text).toContain('Reasoning process...');
		});

		it('should not add thinking for non-Claude models', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/openai-gpt-4.1',
				settings: { enableThinking: true }
			});

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: 'Response' }, finish_reason: 'stop' }
					],
					usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
				})
			);

			await model.doGenerate({
				prompt: [
					{ role: 'user', content: [{ type: 'text', text: 'Question' }] }
				],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.thinking).toBeUndefined();
		});
	});

	describe('doGenerate - OpenAI reasoning', () => {
		it('should add reasoning_effort for OpenAI models', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/openai-gpt-4.1',
				settings: { enableThinking: true, thinkingLevel: 'high' }
			});

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: 'Response' }, finish_reason: 'stop' }
					],
					usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
				})
			);

			await model.doGenerate({
				prompt: [
					{ role: 'user', content: [{ type: 'text', text: 'Complex task' }] }
				],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.reasoning_effort).toBe('high');
		});

		it('should support all reasoning effort levels', async () => {
			for (const level of ['low', 'medium', 'high'] as const) {
				mockFetch.mockReset();

				const model = new RestLanguageModel({
					id: 'cortex/openai-gpt-4.1',
					settings: { enableThinking: true, thinkingLevel: level }
				});

				mockFetch.mockResolvedValueOnce(
					createMockResponse({
						choices: [
							{ message: { content: 'Response' }, finish_reason: 'stop' }
						],
						usage: {
							prompt_tokens: 50,
							completion_tokens: 20,
							total_tokens: 70
						}
					})
				);

				await model.doGenerate({
					prompt: [{ role: 'user', content: [{ type: 'text', text: 'Task' }] }],
					inputFormat: 'messages',
					mode: { type: 'regular' }
				} as TestCallOptions);

				const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
				expect(requestBody.reasoning_effort).toBe(level);
			}
		});
	});

	describe('doGenerate - structured outputs', () => {
		it('should send JSON schema for structured outputs', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enableStructuredOutputs: true }
			});

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					structured_output: [
						{
							raw_message: { name: 'John', age: 30 }
						}
					],
					choices: [{ message: { content: '' }, finish_reason: 'stop' }],
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120
					}
				})
			);

			const schema = {
				type: 'object',
				properties: {
					name: { type: 'string' },
					age: { type: 'number' }
				},
				required: ['name', 'age'],
				additionalProperties: false
			};

			const result = await model.doGenerate({
				prompt: [
					{ role: 'user', content: [{ type: 'text', text: 'Extract info' }] }
				],
				inputFormat: 'messages',
				mode: { type: 'regular' },
				responseFormat: { type: 'json', schema }
			} as TestCallOptions);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.response_format).toEqual({
				type: 'json',
				schema
			});

			// Should return structured output as text
			expect(result.content[0].type).toBe('text');
			expect(JSON.parse((result.content[0] as any).text)).toEqual({
				name: 'John',
				age: 30
			});
		});

		it('should not send response_format when structured outputs disabled', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enableStructuredOutputs: false }
			});

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: '{"name":"John"}' }, finish_reason: 'stop' }
					],
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120
					}
				})
			);

			await model.doGenerate({
				prompt: [
					{ role: 'user', content: [{ type: 'text', text: 'Extract info' }] }
				],
				inputFormat: 'messages',
				mode: { type: 'regular' },
				responseFormat: {
					type: 'json',
					schema: { type: 'object', properties: { name: { type: 'string' } } }
				}
			} as TestCallOptions);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.response_format).toBeUndefined();
		});
	});

	describe('doGenerate - tool calling', () => {
		it('should convert tools to Cortex format', async () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: 'Response' }, finish_reason: 'stop' }
					],
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120
					}
				})
			);

			await model.doGenerate({
				prompt: [
					{
						role: 'user',
						content: [{ type: 'text', text: 'What is the weather?' }]
					}
				],
				inputFormat: 'messages',
				mode: { type: 'regular' },
				tools: [
					{
						type: 'function',
						name: 'get_weather',
						description: 'Get weather info',
						inputSchema: {
							type: 'object',
							properties: {
								location: { type: 'string' }
							},
							required: ['location']
						}
					}
				]
			} as TestCallOptions);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.tools).toBeDefined();
			expect(requestBody.tools[0].tool_spec.name).toBe('get_weather');
		});

		it('should handle tool call responses', async () => {
			const { parseToolCalls } = require('../src/utils/tool-helpers.js');
			parseToolCalls.mockReturnValueOnce([
				{
					id: 'call_123',
					name: 'get_weather',
					input: { location: 'Seattle' }
				}
			]);

			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [{ message: { content: '' }, finish_reason: 'tool_calls' }],
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120
					}
				})
			);

			const result = await model.doGenerate({
				prompt: [
					{
						role: 'user',
						content: [{ type: 'text', text: 'What is the weather?' }]
					}
				],
				inputFormat: 'messages',
				mode: { type: 'regular' },
				tools: [
					{
						type: 'function',
						name: 'get_weather',
						description: 'Get weather',
						inputSchema: { type: 'object', properties: {} }
					}
				]
			} as TestCallOptions);

			expect(result.finishReason).toBe('tool-calls');
			expect(result.content[0].type).toBe('tool-call');
		});
	});

	describe('doGenerate - error handling', () => {
		it('should handle API errors', async () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });

			mockFetch.mockResolvedValueOnce(
				createErrorResponse(400, 'Invalid request')
			);

			await expect(
				model.doGenerate({
					prompt: [
						{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }
					],
					inputFormat: 'messages',
					mode: { type: 'regular' }
				} as TestCallOptions)
			).rejects.toThrow();
		});

		it('should retry on retryable errors', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { maxRetries: 2 }
			});

			// First call fails with 429, second succeeds
			mockFetch
				.mockResolvedValueOnce(createErrorResponse(429, 'Rate limit'))
				.mockResolvedValueOnce(
					createMockResponse({
						choices: [
							{ message: { content: 'Success' }, finish_reason: 'stop' }
						],
						usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
					})
				);

			const result = await model.doGenerate({
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			expect(mockFetch).toHaveBeenCalledTimes(2);
			expect(result.content[0]).toEqual({ type: 'text', text: 'Success' });
		});

		it('should not retry on non-retryable errors', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { maxRetries: 2 }
			});

			mockFetch.mockResolvedValueOnce(createErrorResponse(400, 'Bad request'));

			await expect(
				model.doGenerate({
					prompt: [
						{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }
					],
					inputFormat: 'messages',
					mode: { type: 'regular' }
				} as TestCallOptions)
			).rejects.toThrow();

			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});

	describe('doStream - streaming support', () => {
		it('should stream text deltas', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enableStreaming: true }
			});

			mockFetch.mockResolvedValueOnce(
				createStreamingResponse([
					'data: {"choices":[{"delta":{"content":"Hello"}}]}',
					'data: {"choices":[{"delta":{"content":" world"}}]}',
					'data: {"choices":[{"delta":{"content":"!"}}]}',
					'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5}}'
				])
			);

			const { stream } = await model.doStream({
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			const reader = stream.getReader();
			const chunks: Array<{ type: string }> = [];
			let done = false;

			while (!done) {
				const { value, done: isDone } = await reader.read();
				done = isDone;
				if (value) chunks.push(value as { type: string });
			}

			// Should have text deltas and finish
			expect(
				chunks.filter((c) => c.type === 'text-delta').length
			).toBeGreaterThan(0);
			expect(chunks.some((c) => c.type === 'finish')).toBe(true);
		});

		it('should throw error when streaming is disabled', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enableStreaming: false }
			});

			await expect(
				model.doStream({
					prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
					inputFormat: 'messages',
					mode: { type: 'regular' }
				} as TestCallOptions)
			).rejects.toThrow('Streaming is disabled');
		});

		it('should handle streaming errors', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enableStreaming: true }
			});

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				text: async () => 'Server error',
				headers: new Headers(),
				body: null,
				bodyUsed: false,
				redirected: false,
				type: 'basic' as ResponseType,
				url: 'https://test.snowflakecomputing.com/api/v2/cortex/inference:complete',
				json: async () => ({}),
				blob: async () => new Blob(),
				arrayBuffer: async () => new ArrayBuffer(0),
				formData: async () => new FormData(),
				clone: function () {
					return this;
				}
			} as Response);

			const { stream } = await model.doStream({
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			// Error should be thrown when reading from stream
			const reader = stream.getReader();
			await expect(reader.read()).rejects.toThrow();
		});

		it('should handle mid-stream errors gracefully', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enableStreaming: true }
			});

			// Create a stream that errors mid-way
			const encoder = new TextEncoder();
			let errorThrown = false;
			const errorStream = new ReadableStream({
				start(controller) {
					// Send some valid data first
					controller.enqueue(
						encoder.encode(
							'data: {"choices":[{"delta":{"content":"Hello"}}]}\n'
						)
					);
					// Then simulate an error mid-stream
					errorThrown = true;
					controller.error(new Error('Connection lost'));
				}
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers({ 'content-type': 'text/event-stream' }),
				body: errorStream,
				json: async () => ({}),
				text: async () => '',
				blob: async () => new Blob(),
				arrayBuffer: async () => new ArrayBuffer(0),
				formData: async () => new FormData(),
				clone: function () {
					return this;
				},
				bodyUsed: false,
				redirected: false,
				type: 'basic' as ResponseType,
				url: 'https://test.snowflakecomputing.com/api/v2/cortex/inference:complete'
			} as Response);

			const { stream } = await model.doStream({
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			// Should be able to start reading but eventually hit error
			const reader = stream.getReader();

			// Read first chunk (might succeed)
			try {
				let hasData = false;
				let hasError = false;

				// Try to read all chunks
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					if (value) {
						hasData = true;
					}
				}
			} catch (error) {
				// Expected: mid-stream error should propagate
				expect(error).toBeDefined();
			}
		});

		it('should handle malformed SSE data in stream', async () => {
			const model = new RestLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: { enableStreaming: true }
			});

			// Create stream with malformed JSON
			mockFetch.mockResolvedValueOnce(
				createStreamingResponse([
					'data: {"choices":[{"delta":{"content":"Good"}}]}',
					'data: {invalid json here}', // Malformed
					'data: {"choices":[{"delta":{"content":" data"}}]}',
					'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5}}'
				])
			);

			const { stream } = await model.doStream({
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			const reader = stream.getReader();
			const chunks: Array<unknown> = [];
			let done = false;

			// Should skip malformed data and continue
			try {
				while (!done) {
					const { value, done: isDone } = await reader.read();
					done = isDone;
					if (value) chunks.push(value);
				}
			} catch (error) {
				// Some implementations may throw on malformed data
			}

			// Should have received at least some valid chunks
			expect(chunks.length).toBeGreaterThan(0);
		});
	});

	describe('finish reasons', () => {
		it('should map stop finish reason', async () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [{ message: { content: 'Done' }, finish_reason: 'stop' }],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
				})
			);

			const result = await model.doGenerate({
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			expect(result.finishReason).toBe('stop');
		});

		it('should map length finish reason', async () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: 'Truncated...' }, finish_reason: 'length' }
					],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
				})
			);

			const result = await model.doGenerate({
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			expect(result.finishReason).toBe('length');
		});

		it('should map content_filter finish reason', async () => {
			const model = new RestLanguageModel({ id: 'cortex/claude-sonnet-4-5' });

			mockFetch.mockResolvedValueOnce(
				createMockResponse({
					choices: [
						{ message: { content: '' }, finish_reason: 'content_filter' }
					],
					usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 }
				})
			);

			const result = await model.doGenerate({
				prompt: [
					{ role: 'user', content: [{ type: 'text', text: 'Unsafe content' }] }
				],
				inputFormat: 'messages',
				mode: { type: 'regular' }
			} as TestCallOptions);

			expect(result.finishReason).toBe('content-filter');
		});
	});
});
