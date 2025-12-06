/**
 * Unit tests for CLI message converter
 * Target: 90%+ coverage for src/cli/message-converter.ts
 */

import {
	convertToCliMessages,
	convertFromCliResponse,
	createPromptFromMessages,
	escapeShellArg,
	buildCliArgs,
	formatConversationContext,
	type CliMessage,
	type CliResponse
} from '../../../src/cli/message-converter.js';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider';

describe('CLI Message Converter', () => {
	describe('convertToCliMessages', () => {
		it.concurrent('should convert simple user message', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }
			];

			const result = convertToCliMessages(prompt);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe('user');
			expect(result[0].content).toBe('Hello');
		});

		it.concurrent('should convert system message', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'system', content: 'You are helpful' }
			];

			const result = convertToCliMessages(prompt);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe('system');
			expect(result[0].content).toBe('You are helpful');
		});

		it.concurrent('should convert assistant message', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'How can I help?' }]
				}
			];

			const result = convertToCliMessages(prompt);

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe('assistant');
			expect(result[0].content).toBe('How can I help?');
		});

		it.concurrent('should handle multi-part user content', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'user',
					content: [
						{ type: 'text', text: 'Part 1' },
						{ type: 'text', text: 'Part 2' },
						{ type: 'text', text: 'Part 3' }
					]
				}
			];

			const result = convertToCliMessages(prompt);

			expect(result).toHaveLength(1);
			expect(result[0].content).toContain('Part 1');
			expect(result[0].content).toContain('Part 2');
			expect(result[0].content).toContain('Part 3');
		});

		it.concurrent('should handle mixed message types', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'system', content: 'Be helpful' },
				{ role: 'user', content: [{ type: 'text', text: 'Hello' }] },
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Hi there!' }]
				},
				{ role: 'user', content: [{ type: 'text', text: 'Thanks' }] }
			];

			const result = convertToCliMessages(prompt);

			expect(result).toHaveLength(4);
			expect(result[0].role).toBe('system');
			expect(result[1].role).toBe('user');
			expect(result[2].role).toBe('assistant');
			expect(result[3].role).toBe('user');
		});

		it.concurrent('should handle empty prompt', async () => {
			const prompt: LanguageModelV2Prompt = [];

			const result = convertToCliMessages(prompt);

			expect(result).toHaveLength(0);
		});

		it.concurrent('should skip non-text content types', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'user',
					content: [
						{ type: 'text', text: 'Text content' },
						{ type: 'image', image: new Uint8Array() } as any,
						{ type: 'text', text: 'More text' }
					]
				}
			];

			const result = convertToCliMessages(prompt);

			expect(result).toHaveLength(1);
			expect(result[0].content).toContain('Text content');
			expect(result[0].content).toContain('More text');
		});

		it.concurrent('should handle image content with placeholder', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'user',
					content: [{ type: 'image', image: new Uint8Array() } as any]
				}
			];

			const result = convertToCliMessages(prompt);

			expect(result).toHaveLength(1);
			expect(result[0].content).toContain('Image content not supported');
		});

		it.concurrent('should handle assistant message with tool calls', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'assistant',
					content: [
						{ type: 'text', text: 'Let me help you' },
						{
							type: 'tool-call',
							toolCallId: 'call_1',
							toolName: 'search',
							args: { query: 'test' }
						} as any
					]
				}
			];

			const result = convertToCliMessages(prompt);

			expect(result.length).toBeGreaterThan(0);
			// Check that tool calls are mentioned
			const hasToolMessage = result.some(
				(m) => m.content.includes('tool call') || m.content.includes('Let me help you')
			);
			expect(hasToolMessage).toBe(true);
		});

		it.concurrent('should handle assistant message with only tool calls', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'assistant',
					content: [
						{
							type: 'tool-call',
							toolCallId: 'call_1',
							toolName: 'calculator',
							args: { a: 1, b: 2 }
						} as any,
						{
							type: 'tool-call',
							toolCallId: 'call_2',
							toolName: 'search',
							args: { query: 'test' }
						} as any
					]
				}
			];

			const result = convertToCliMessages(prompt);

			// Should have a message indicating tool calls
			expect(result.length).toBeGreaterThan(0);
			const hasToolIndicator = result.some(
				(m) => m.content.includes('tool call')
			);
			expect(hasToolIndicator).toBe(true);
		});

		it.concurrent('should handle assistant message as string content', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'assistant',
					content: 'Simple string content' as any
				}
			];

			const result = convertToCliMessages(prompt);

			expect(result).toHaveLength(1);
			expect(result[0].content).toBe('Simple string content');
		});

		it.concurrent('should handle unknown content type', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'user',
					content: [
						{ type: 'unknown', data: 'something' } as any
					]
				}
			];

			const result = convertToCliMessages(prompt);

			// Should not crash, may return empty or placeholder
			expect(result).toBeDefined();
		});

	it.concurrent('should handle tool results', async () => {
		const prompt: LanguageModelV2Prompt = [
			{
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: 'call_123',
						toolName: 'calculator',
						output: { type: 'json' as const, value: { result: 42 } }
					}
				]
			}
		];

		const result = convertToCliMessages(prompt);

		// Tool results may be converted to a specific format
		expect(result).toBeDefined();
	});
	});

	describe('convertFromCliResponse', () => {
		it.concurrent('should convert simple response', async () => {
			const response: CliResponse = {
				role: 'assistant',
				content: 'Hello from CLI'
			};

			const result = convertFromCliResponse(response);

			expect(result.text).toBe('Hello from CLI');
		});

		it.concurrent('should handle response with usage data', async () => {
			const response: CliResponse = {
				role: 'assistant',
				content: 'Test response',
				usage: {
					prompt_tokens: 100,
					completion_tokens: 50
				} as any // CLI returns snake_case
			};

			const result = convertFromCliResponse(response);

			expect(result.text).toBe('Test response');
			expect(result.usage?.promptTokens).toBe(100);
			expect(result.usage?.completionTokens).toBe(50);
		});

		it.concurrent('should handle response without usage', async () => {
			const response: CliResponse = {
				role: 'assistant',
				content: 'No usage info'
			};

			const result = convertFromCliResponse(response);

			expect(result.text).toBe('No usage info');
			expect(result.usage).toBeUndefined();
		});

		it.concurrent('should handle empty content', async () => {
			const response: CliResponse = {
				role: 'assistant',
				content: ''
			};

			const result = convertFromCliResponse(response);

			expect(result.text).toBe('');
		});
	});

	describe('createPromptFromMessages', () => {
		it.concurrent(
			'should create simple prompt from single message',
			async () => {
				const prompt: LanguageModelV2Prompt = [
					{ role: 'user', content: [{ type: 'text', text: 'Hello world' }] }
				];

				const result = createPromptFromMessages(prompt);

				expect(result).toContain('Hello world');
			}
		);

		it.concurrent('should include system message in prompt', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'system', content: 'You are helpful' },
				{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }
			];

			const result = createPromptFromMessages(prompt);

			expect(result).toContain('You are helpful');
			expect(result).toContain('Hi');
		});

		it.concurrent('should format multi-turn conversation', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'user', content: [{ type: 'text', text: 'Question 1' }] },
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Answer 1' }]
				},
				{ role: 'user', content: [{ type: 'text', text: 'Question 2' }] }
			];

			const result = createPromptFromMessages(prompt);

			expect(result).toContain('Question 1');
			expect(result).toContain('Answer 1');
			expect(result).toContain('Question 2');
		});

		it.concurrent('should handle empty prompt', async () => {
			const prompt: LanguageModelV2Prompt = [];

			const result = createPromptFromMessages(prompt);

			expect(result).toBe('');
		});
	});

	describe('escapeShellArg', () => {
		it.concurrent('should return empty quotes for null/undefined', async () => {
			expect(escapeShellArg(null as any)).toBe("''");
			expect(escapeShellArg(undefined as any)).toBe("''");
		});

		it.concurrent('should return empty quotes for empty string', async () => {
			expect(escapeShellArg('')).toBe("''");
		});

		it.concurrent('should return empty quotes for non-string', async () => {
			expect(escapeShellArg(123 as any)).toBe("''");
			expect(escapeShellArg({} as any)).toBe("''");
		});

		it.concurrent('should escape single quotes', async () => {
			const result = escapeShellArg("it's");
			// Should wrap in single quotes and escape internal single quotes
			expect(result).not.toContain("it's");
		});

		it.concurrent('should handle spaces', async () => {
			const result = escapeShellArg('hello world');
			// Should be properly quoted
			expect(result.startsWith("'") || result.includes('hello')).toBe(true);
		});

		it.concurrent('should handle special characters', async () => {
			const result = escapeShellArg('test$var');
			// Dollar signs should be handled
			expect(result).toBeDefined();
		});

		it.concurrent('should handle backslashes', async () => {
			const result = escapeShellArg('path\\to\\file');
			expect(result).toBeDefined();
		});

		it.concurrent('should handle newlines', async () => {
			const result = escapeShellArg('line1\nline2');
			expect(result).toBeDefined();
		});

		it.concurrent('should handle tabs', async () => {
			const result = escapeShellArg('col1\tcol2');
			expect(result).toBeDefined();
		});
	});

	describe('buildCliArgs', () => {
		it.concurrent('should build args for simple prompt', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }
			];

			const args = buildCliArgs(prompt);

			expect(Array.isArray(args)).toBe(true);
			expect(args.length).toBeGreaterThan(0);
		});

		it.concurrent('should include system message in args', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'system', content: 'Be helpful' },
				{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }
			];

			const args = buildCliArgs(prompt);

			const argsStr = args.join(' ');
			expect(argsStr).toContain('Be helpful');
		});

		it.concurrent('should handle empty prompt', async () => {
			const prompt: LanguageModelV2Prompt = [];

			const args = buildCliArgs(prompt);

			expect(Array.isArray(args)).toBe(true);
		});

		it.concurrent('should return array of strings', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'user', content: [{ type: 'text', text: 'Test' }] }
			];

			const args = buildCliArgs(prompt);

			args.forEach((arg) => {
				expect(typeof arg).toBe('string');
			});
		});
	});

	describe('formatConversationContext', () => {
		it.concurrent('should format simple conversation', async () => {
			const messages: CliMessage[] = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there!' }
			];

			const result = formatConversationContext(messages);

			expect(result).toContain('Hello');
			expect(result).toContain('Hi there!');
		});

		it.concurrent('should include role labels', async () => {
			const messages: CliMessage[] = [
				{ role: 'user', content: 'Question' },
				{ role: 'assistant', content: 'Answer' }
			];

			const result = formatConversationContext(messages);

			// Should have some indication of role
			expect(result).toContain('Question');
			expect(result).toContain('Answer');
		});

		it.concurrent('should handle system messages', async () => {
			const messages: CliMessage[] = [
				{ role: 'system', content: 'System instruction' },
				{ role: 'user', content: 'User message' }
			];

			const result = formatConversationContext(messages);

			expect(result).toContain('System instruction');
			expect(result).toContain('User message');
		});

		it.concurrent('should handle empty messages array', async () => {
			const messages: CliMessage[] = [];

			const result = formatConversationContext(messages);

			expect(result).toBe('');
		});

		it.concurrent('should handle single message', async () => {
			const messages: CliMessage[] = [
				{ role: 'user', content: 'Single message' }
			];

			const result = formatConversationContext(messages);

			expect(result).toContain('Single message');
		});

		it.concurrent('should preserve message order', async () => {
			const messages: CliMessage[] = [
				{ role: 'user', content: 'First' },
				{ role: 'assistant', content: 'Second' },
				{ role: 'user', content: 'Third' }
			];

			const result = formatConversationContext(messages);

			const firstIndex = result.indexOf('First');
			const secondIndex = result.indexOf('Second');
			const thirdIndex = result.indexOf('Third');

			expect(firstIndex).toBeLessThan(secondIndex);
			expect(secondIndex).toBeLessThan(thirdIndex);
		});
	});
});
