/**
 * tests/unit/ai-providers/mcp-components.test.js
 * Unit tests for MCP AI SDK custom components
 */

import { jest } from '@jest/globals';

describe('MCP Custom SDK Components', () => {
	describe('Message Converter', () => {
		let messageConverter;

		beforeAll(async () => {
			const module = await import(
				'../../../mcp-server/src/custom-sdk/message-converter.js'
			);
			messageConverter = module;
		});

		describe('convertToMCPFormat', () => {
			it('should convert AI SDK messages to MCP format', () => {
				const input = [
					{ role: 'system', content: 'You are a helpful assistant.' },
					{ role: 'user', content: 'Hello!' }
				];

				const result = messageConverter.convertToMCPFormat(input);

				expect(result).toBeDefined();
				expect(result.messages).toBeDefined();
				expect(Array.isArray(result.messages)).toBe(true);
				expect(result.systemPrompt).toBe('You are a helpful assistant.');
				expect(result.messages).toHaveLength(1);
				expect(result.messages[0].role).toBe('user');
				expect(result.messages[0].content.text).toBe('Hello!');
			});
		});

		describe('convertFromMCPFormat', () => {
			it('should convert MCP response to AI SDK format', () => {
				const input = {
					content: 'Hello! How can I help you?',
					usage: { inputTokens: 10, outputTokens: 8 }
				};

				const result = messageConverter.convertFromMCPFormat(input);

				expect(result).toBeDefined();
				expect(result.text).toBe('Hello! How can I help you?');
				expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 8 });
				expect(result.finishReason).toBe('stop');
				expect(result.warnings).toBeDefined();
			});
		});
	});

	describe('Language Model', () => {
		let languageModel;

		beforeAll(async () => {
			const module = await import(
				'../../../mcp-server/src/custom-sdk/language-model.js'
			);
			languageModel = module;
		});

		it('should export MCPLanguageModel class', () => {
			expect(languageModel.MCPLanguageModel).toBeDefined();
			expect(typeof languageModel.MCPLanguageModel).toBe('function');
		});
	});

	describe('Error Handling', () => {
		let errors;

		beforeAll(async () => {
			const module = await import(
				'../../../mcp-server/src/custom-sdk/errors.js'
			);
			errors = module;
		});

		it('should export error classes', () => {
			expect(errors.MCPError).toBeDefined();
			expect(typeof errors.MCPError).toBe('function');
		});
	});

	describe('Index Module', () => {
		let index;

		beforeAll(async () => {
			const module = await import(
				'../../../mcp-server/src/custom-sdk/index.js'
			);
			index = module;
		});

		it('should export createMCP function', () => {
			expect(index.createMCP).toBeDefined();
			expect(typeof index.createMCP).toBe('function');
		});
	});
});
