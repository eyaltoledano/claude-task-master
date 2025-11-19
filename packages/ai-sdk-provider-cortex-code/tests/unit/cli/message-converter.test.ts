/**
 * Unit tests for message conversion utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
	convertToCortexCodeMessages,
	convertFromCortexCodeResponse,
	createPromptFromMessages,
	escapeShellArg,
	buildCliArgs,
	formatConversationContext
} from '../../../src/cli/message-converter.js';
import type { CortexCodeMessage, CortexCodeResponse } from '../../../src/core/types.js';

describe('convertToCortexCodeMessages', () => {
	it('should convert simple user message', () => {
		const prompt = [
			{ role: 'user', content: 'Hello, world!' }
		];

		const result = convertToCortexCodeMessages(prompt as any);

		expect(result).toEqual([
			{ role: 'user', content: 'Hello, world!' }
		]);
	});

	it('should convert system message', () => {
		const prompt = [
			{ role: 'system', content: 'You are a helpful assistant.' }
		];

		const result = convertToCortexCodeMessages(prompt as any);

		expect(result).toEqual([
			{ role: 'system', content: 'You are a helpful assistant.' }
		]);
	});

	it('should convert assistant message', () => {
		const prompt = [
			{ role: 'assistant', content: 'I am here to help.' }
		];

		const result = convertToCortexCodeMessages(prompt as any);

		expect(result).toEqual([
			{ role: 'assistant', content: 'I am here to help.' }
		]);
	});

	it('should handle multi-part user content', () => {
		const prompt = [
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'First part' },
					{ type: 'text', text: 'Second part' }
				]
			}
		];

		const result = convertToCortexCodeMessages(prompt as any);

		expect(result).toEqual([
			{ role: 'user', content: 'First part\nSecond part' }
		]);
	});

	it('should handle image content with placeholder', () => {
		const prompt = [
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'Look at this:' },
					{ type: 'image', image: 'base64data' }
				]
			}
		];

		const result = convertToCortexCodeMessages(prompt as any);

		expect(result[0].content).toContain('Look at this:');
		expect(result[0].content).toContain('[Image content not supported in CLI mode]');
	});

	it('should handle assistant with tool calls', () => {
		const prompt = [
			{
				role: 'assistant',
				content: [
					{ type: 'text', text: 'Let me check that' },
					{ type: 'tool-call', toolName: 'search', args: {} }
				]
			}
		];

		const result = convertToCortexCodeMessages(prompt as any);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ role: 'assistant', content: 'Let me check that' });
		expect(result[1].content).toContain('tool call');
	});

	it('should handle tool results', () => {
		const prompt = [
			{
				role: 'tool',
				content: [
					{ toolName: 'search', result: { data: 'result' } }
				]
			}
		];

		const result = convertToCortexCodeMessages(prompt as any);

		expect(result).toHaveLength(1);
		expect(result[0].role).toBe('user');
		expect(result[0].content).toContain('Tool result for search');
	});

	it('should handle conversation with multiple messages', () => {
		const prompt = [
			{ role: 'system', content: 'You are helpful.' },
			{ role: 'user', content: 'Hello!' },
			{ role: 'assistant', content: 'Hi there!' },
			{ role: 'user', content: 'How are you?' }
		];

		const result = convertToCortexCodeMessages(prompt as any);

		expect(result).toHaveLength(4);
		expect(result[0].role).toBe('system');
		expect(result[1].role).toBe('user');
		expect(result[2].role).toBe('assistant');
		expect(result[3].role).toBe('user');
	});
});

describe('convertFromCortexCodeResponse', () => {
	it('should convert response with usage data', () => {
		const response: CortexCodeResponse = {
			content: 'Hello, world!',
			usage: {
				prompt_tokens: 10,
				completion_tokens: 5
			}
		};

		const result = convertFromCortexCodeResponse(response);

		expect(result).toEqual({
			text: 'Hello, world!',
			usage: {
				promptTokens: 10,
				completionTokens: 5
			}
		});
	});

	it('should handle response without usage data', () => {
		const response: CortexCodeResponse = {
			content: 'Hello, world!'
		};

		const result = convertFromCortexCodeResponse(response);

		expect(result).toEqual({
			text: 'Hello, world!',
			usage: undefined
		});
	});

	it('should handle missing token counts', () => {
		const response: CortexCodeResponse = {
			content: 'Test',
			usage: {} as any
		};

		const result = convertFromCortexCodeResponse(response);

		expect(result.usage).toEqual({
			promptTokens: 0,
			completionTokens: 0
		});
	});
});

describe('createPromptFromMessages', () => {
	it('should create formatted prompt from messages', () => {
		const prompt = [
			{ role: 'system', content: 'You are helpful.' },
			{ role: 'user', content: 'Hello!' },
			{ role: 'assistant', content: 'Hi there!' }
		];

		const result = createPromptFromMessages(prompt as any);

		expect(result).toBe('System: You are helpful.\n\nUser: Hello!\n\nAssistant: Hi there!');
	});

	it('should handle single message', () => {
		const prompt = [
			{ role: 'user', content: 'Test message' }
		];

		const result = createPromptFromMessages(prompt as any);

		expect(result).toBe('User: Test message');
	});

	it('should handle empty messages', () => {
		const prompt: any[] = [];

		const result = createPromptFromMessages(prompt as any);

		expect(result).toBe('');
	});
});

describe('escapeShellArg', () => {
	const originalPlatform = process.platform;

	afterEach(() => {
		Object.defineProperty(process, 'platform', {
			value: originalPlatform
		});
	});

	describe('Unix-like systems', () => {
		beforeEach(() => {
			Object.defineProperty(process, 'platform', {
				value: 'linux'
			});
		});

		it('should wrap simple strings in single quotes', () => {
			expect(escapeShellArg('hello')).toBe("'hello'");
		});

		it('should escape single quotes', () => {
			expect(escapeShellArg("it's")).toBe("'it'\\''s'");
		});

		it('should handle multiple single quotes', () => {
			expect(escapeShellArg("'test' 'value'")).toBe("''\\''test'\\'' '\\''value'\\'''");
		});

		it('should handle strings with special characters', () => {
			expect(escapeShellArg('hello $world')).toBe("'hello $world'");
			expect(escapeShellArg('test & command')).toBe("'test & command'");
			expect(escapeShellArg('pipe | test')).toBe("'pipe | test'");
		});

		it('should handle backticks', () => {
			expect(escapeShellArg('`command`')).toBe("'`command`'");
		});

		it('should handle semicolons', () => {
			expect(escapeShellArg('cmd1; cmd2')).toBe("'cmd1; cmd2'");
		});
	});

	describe('Windows', () => {
		beforeEach(() => {
			Object.defineProperty(process, 'platform', {
				value: 'win32'
			});
		});

		it('should wrap simple strings in double quotes', () => {
			expect(escapeShellArg('hello')).toBe('"hello"');
		});

		it('should escape double quotes', () => {
			expect(escapeShellArg('say "hello"')).toBe('"say ""hello"""');
		});

		it('should handle multiple double quotes', () => {
			expect(escapeShellArg('"test" "value"')).toBe('"""test"" ""value"""');
		});
	});

	describe('Edge cases', () => {
		it('should handle empty string', () => {
			expect(escapeShellArg('')).toBe("''");
		});

		it('should handle null/undefined', () => {
			expect(escapeShellArg(null as any)).toBe("''");
			expect(escapeShellArg(undefined as any)).toBe("''");
		});

		it('should handle non-string input', () => {
			expect(escapeShellArg(123 as any)).toBe("''");
			expect(escapeShellArg({} as any)).toBe("''");
		});

		it('should handle newlines', () => {
			Object.defineProperty(process, 'platform', { value: 'linux' });
			expect(escapeShellArg('line1\nline2')).toBe("'line1\nline2'");
		});

		it('should handle tabs', () => {
			Object.defineProperty(process, 'platform', { value: 'linux' });
			expect(escapeShellArg('col1\tcol2')).toBe("'col1\tcol2'");
		});
	});

	describe('Security - Command Injection Prevention', () => {
		beforeEach(() => {
			Object.defineProperty(process, 'platform', { value: 'linux' });
		});

		it('should prevent command injection with semicolon', () => {
			const malicious = 'test; rm -rf /';
			expect(escapeShellArg(malicious)).toBe("'test; rm -rf /'");
		});

		it('should prevent command injection with pipe', () => {
			const malicious = 'test | cat /etc/passwd';
			expect(escapeShellArg(malicious)).toBe("'test | cat /etc/passwd'");
		});

		it('should prevent command injection with ampersand', () => {
			const malicious = 'test && malicious_command';
			expect(escapeShellArg(malicious)).toBe("'test && malicious_command'");
		});

		it('should prevent command injection with backticks', () => {
			const malicious = 'test `whoami`';
			expect(escapeShellArg(malicious)).toBe("'test `whoami`'");
		});

		it('should prevent command injection with $() substitution', () => {
			const malicious = 'test $(whoami)';
			expect(escapeShellArg(malicious)).toBe("'test $(whoami)'");
		});

		it('should prevent command injection with redirect', () => {
			const malicious = 'test > /tmp/file';
			expect(escapeShellArg(malicious)).toBe("'test > /tmp/file'");
		});
	});
});

describe('buildCliArgs', () => {
	it('should build CLI arguments with --print flag', () => {
		const prompt = [
			{ role: 'user', content: 'Hello!' }
		];

		const result = buildCliArgs(prompt as any);

		expect(result).toHaveLength(2);
		expect(result[0]).toBe('--print');
		expect(result[1]).toContain('User: Hello!');
	});

	it('should format complex conversation', () => {
		const prompt = [
			{ role: 'system', content: 'Be helpful.' },
			{ role: 'user', content: 'Hi!' },
			{ role: 'assistant', content: 'Hello!' }
		];

		const result = buildCliArgs(prompt as any);

		expect(result[1]).toContain('System: Be helpful.');
		expect(result[1]).toContain('User: Hi!');
		expect(result[1]).toContain('Assistant: Hello!');
	});
});

describe('formatConversationContext', () => {
	it('should format conversation context', () => {
		const messages: CortexCodeMessage[] = [
			{ role: 'system', content: 'Be helpful.' },
			{ role: 'user', content: 'Hello!' },
			{ role: 'assistant', content: 'Hi there!' }
		];

		const result = formatConversationContext(messages);

		expect(result).toBe('System: Be helpful.\n\nUser: Hello!\n\nAssistant: Hi there!');
	});

	it('should capitalize role names', () => {
		const messages: CortexCodeMessage[] = [
			{ role: 'user', content: 'Test' }
		];

		const result = formatConversationContext(messages);

		expect(result).toContain('User:');
	});

	it('should handle empty messages array', () => {
		const result = formatConversationContext([]);

		expect(result).toBe('');
	});

	it('should handle single message', () => {
		const messages: CortexCodeMessage[] = [
			{ role: 'user', content: 'Single message' }
		];

		const result = formatConversationContext(messages);

		expect(result).toBe('User: Single message');
	});
});

