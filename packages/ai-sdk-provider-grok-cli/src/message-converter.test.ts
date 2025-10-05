/**
 * Tests for message conversion utilities
 */

import { describe, expect, it } from 'vitest';
import {
	convertFromGrokCliResponse,
	convertToGrokCliMessages,
	createPromptFromMessages,
	escapeShellArg
} from './message-converter.js';

describe('convertToGrokCliMessages', () => {
	it('should convert string content messages', () => {
		const messages = [
			{ role: 'user', content: 'Hello, world!' },
			{ role: 'assistant', content: 'Hi there!' }
		];

		const result = convertToGrokCliMessages(messages);

		expect(result).toEqual([
			{ role: 'user', content: 'Hello, world!' },
			{ role: 'assistant', content: 'Hi there!' }
		]);
	});

	it('should convert array content messages', () => {
		const messages = [
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'Hello' },
					{ type: 'text', text: 'World' }
				]
			}
		];

		const result = convertToGrokCliMessages(messages);

		expect(result).toEqual([{ role: 'user', content: 'Hello\nWorld' }]);
	});

	it('should convert object content messages', () => {
		const messages = [
			{
				role: 'user',
				content: { text: 'Hello from object' }
			}
		];

		const result = convertToGrokCliMessages(messages);

		expect(result).toEqual([{ role: 'user', content: 'Hello from object' }]);
	});
});

describe('convertFromGrokCliResponse', () => {
	it('should parse JSONL response format', () => {
		const responseText = `{"role": "assistant", "content": "Hello there!", "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}}`;

		const result = convertFromGrokCliResponse(responseText);

		expect(result).toEqual({
			text: 'Hello there!',
			usage: {
				promptTokens: 10,
				completionTokens: 5,
				totalTokens: 15
			}
		});
	});

	it('should handle multiple lines in JSONL format', () => {
		const responseText = `{"role": "user", "content": "Hello"}
{"role": "assistant", "content": "Hi there!", "usage": {"prompt_tokens": 5, "completion_tokens": 3}}`;

		const result = convertFromGrokCliResponse(responseText);

		expect(result).toEqual({
			text: 'Hi there!',
			usage: {
				promptTokens: 5,
				completionTokens: 3,
				totalTokens: 0
			}
		});
	});

	it('should fallback to raw text when parsing fails', () => {
		const responseText = 'Invalid JSON response';

		const result = convertFromGrokCliResponse(responseText);

		expect(result).toEqual({
			text: 'Invalid JSON response',
			usage: undefined
		});
	});
});

describe('createPromptFromMessages', () => {
	it('should create formatted prompt from messages', () => {
		const messages = [
			{ role: 'system', content: 'You are a helpful assistant.' },
			{ role: 'user', content: 'What is 2+2?' },
			{ role: 'assistant', content: '2+2 equals 4.' }
		];

		const result = createPromptFromMessages(messages);

		expect(result).toBe(
			'System: You are a helpful assistant.\n\nUser: What is 2+2?\n\nAssistant: 2+2 equals 4.'
		);
	});

	it('should handle custom role names', () => {
		const messages = [{ role: 'custom', content: 'Custom message' }];

		const result = createPromptFromMessages(messages);

		expect(result).toBe('custom: Custom message');
	});

	it('should trim whitespace from message content', () => {
		const messages = [
			{ role: 'user', content: '  Hello with spaces  ' },
			{ role: 'assistant', content: '\n\nResponse with newlines\n\n' }
		];

		const result = createPromptFromMessages(messages);

		expect(result).toBe(
			'User: Hello with spaces\n\nAssistant: Response with newlines'
		);
	});
});

describe('escapeShellArg', () => {
	it('should escape single quotes', () => {
		const arg = "It's a test";
		const result = escapeShellArg(arg);
		expect(result).toBe("'It'\\''s a test'");
	});

	it('should handle strings without special characters', () => {
		const arg = 'simple string';
		const result = escapeShellArg(arg);
		expect(result).toBe("'simple string'");
	});

	it('should convert non-string values to strings', () => {
		const arg = 123;
		const result = escapeShellArg(arg);
		expect(result).toBe("'123'");
	});

	it('should handle empty strings', () => {
		const arg = '';
		const result = escapeShellArg(arg);
		expect(result).toBe("''");
	});
});
