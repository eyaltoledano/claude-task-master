import { jest } from '@jest/globals';

// Import the module under test
const { convertToMcpSamplingMessages, extractTextFromResponse } = await import(
	'../../../../../src/ai-providers/custom-sdk/mcp-sampling/message-converter.js'
);

describe('MCP Sampling Message Converter', () => {
	describe('convertToMcpSamplingMessages', () => {
		it('should convert simple string prompt', () => {
			const prompt = 'Hello, world!';
			const result = convertToMcpSamplingMessages(prompt);

			expect(result).toEqual({
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: 'Hello, world!'
						}
					}
				],
				systemPrompt: ''
			});
		});

		it('should convert array of messages', () => {
			const prompt = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there!' },
				{ role: 'user', content: 'How are you?' }
			];

			const result = convertToMcpSamplingMessages(prompt);

			expect(result).toEqual({
				messages: [
					{
						role: 'user',
						content: { type: 'text', text: 'Hello' }
					},
					{
						role: 'assistant',
						content: { type: 'text', text: 'Hi there!' }
					},
					{
						role: 'user',
						content: { type: 'text', text: 'How are you?' }
					}
				],
				systemPrompt: ''
			});
		});

		it('should extract system prompt from messages array', () => {
			// Note: System message filtering only works with prompt objects, not plain arrays
			const prompt = {
				messages: [
					{ role: 'system', content: 'You are a helpful assistant' },
					{ role: 'user', content: 'Hello' }
				]
			};

			const result = convertToMcpSamplingMessages(prompt);

			// System messages are filtered out when using prompt object
			expect(result.messages).toHaveLength(1);
			expect(result.messages[0]).toEqual({
				role: 'user',
				content: { type: 'text', text: 'Hello' }
			});
			expect(result.systemPrompt).toBe('You are a helpful assistant');
		});

		it('should handle prompt object with messages', () => {
			const prompt = {
				messages: [{ role: 'user', content: 'Test message' }],
				system: 'System prompt from object'
			};

			const result = convertToMcpSamplingMessages(prompt);

			expect(result).toEqual({
				messages: [
					{
						role: 'user',
						content: { type: 'text', text: 'Test message' }
					}
				],
				systemPrompt: 'System prompt from object'
			});
		});

		it('should prioritize first system message over prompt.system', () => {
			const prompt = {
				messages: [
					{ role: 'system', content: 'First system message' },
					{ role: 'user', content: 'User message' }
				],
				system: 'Should be ignored'
			};

			const result = convertToMcpSamplingMessages(prompt);

			expect(result.systemPrompt).toBe('First system message');
		});

		it('should handle array of content parts', () => {
			const prompt = [
				{
					role: 'user',
					content: [
						{ type: 'text', text: 'Part 1' },
						{ type: 'text', text: 'Part 2' },
						{ type: 'tool-call', toolName: 'calculator', args: { a: 1, b: 2 } },
						{ type: 'tool-result', result: { sum: 3 } }
					]
				}
			];

			const result = convertToMcpSamplingMessages(prompt);

			expect(result.messages[0]).toEqual({
				role: 'user',
				content: {
					type: 'text',
					text: 'Part 1\nPart 2\n[Tool Call: calculator({"a":1,"b":2})]\n[Tool Result: {"sum":3}]'
				}
			});
		});

		it('should handle object content with type text', () => {
			const prompt = [
				{
					role: 'user',
					content: {
						type: 'text',
						text: 'Object text content'
					}
				}
			];

			const result = convertToMcpSamplingMessages(prompt);

			expect(result.messages[0]).toEqual({
				role: 'user',
				content: {
					type: 'text',
					text: 'Object text content'
				}
			});
		});

		it('should handle object content with content property', () => {
			const prompt = [
				{
					role: 'user',
					content: {
						type: 'text',
						content: 'Legacy content format' // content property inside text object
					}
				}
			];

			const result = convertToMcpSamplingMessages(prompt);

			// The converter looks for message.content.content when type is 'text'
			expect(result.messages[0].role).toBe('user');
			expect(result.messages[0].content.type).toBe('text');
			expect(result.messages[0].content.text).toBe('Legacy content format');
		});

		it('should add JSON instructions for object mode', () => {
			const prompt = [{ role: 'user', content: 'Generate an object' }];

			const result = convertToMcpSamplingMessages(prompt, {
				type: 'object-json'
			});

			expect(result.messages[0].content.text).toContain(
				'Please respond with a valid JSON object only, no additional text or markdown.'
			);
		});

		it('should not add JSON instructions if not last message or not user role', () => {
			const prompt = [
				{ role: 'user', content: 'First message' },
				{ role: 'assistant', content: 'Response' }
			];

			const result = convertToMcpSamplingMessages(prompt, {
				type: 'object-json'
			});

			expect(result.messages[0].content.text).toBe('First message');
			expect(result.messages[1].content.text).toBe('Response');
		});

		it('should handle empty or null content', () => {
			const prompt = [
				{ role: 'user', content: null },
				{ role: 'assistant', content: undefined },
				{ role: 'user', content: '' }
			];

			const result = convertToMcpSamplingMessages(prompt);

			expect(result.messages).toEqual([
				{ role: 'user', content: { type: 'text', text: '' } },
				{ role: 'assistant', content: { type: 'text', text: '' } },
				{ role: 'user', content: { type: 'text', text: '' } }
			]);
		});

		it('should handle multiple system messages', () => {
			// System filtering only works with prompt objects
			const prompt = {
				messages: [
					{ role: 'system', content: 'First system' },
					{ role: 'system', content: 'Second system' },
					{ role: 'user', content: 'User message' }
				]
			};

			const result = convertToMcpSamplingMessages(prompt);

			// Only first system message becomes systemPrompt
			expect(result.systemPrompt).toBe('First system');
			// Second system message is included, only first is filtered
			expect(result.messages).toHaveLength(2);
			expect(result.messages[0].role).toBe('system');
			expect(result.messages[0].content.text).toBe('Second system');
			expect(result.messages[1].role).toBe('user');
			expect(result.messages[1].content.text).toBe('User message');
		});
	});

	describe('extractTextFromResponse', () => {
		it('should extract text from response.content.text', () => {
			const response = {
				content: { text: 'Response text' }
			};

			expect(extractTextFromResponse(response)).toBe('Response text');
		});

		it('should extract text from response.content string', () => {
			const response = {
				content: 'Direct content string'
			};

			expect(extractTextFromResponse(response)).toBe('Direct content string');
		});

		it('should extract text from response.text', () => {
			const response = {
				text: 'Text property'
			};

			expect(extractTextFromResponse(response)).toBe('Text property');
		});

		it('should return empty string for invalid responses', () => {
			expect(extractTextFromResponse(null)).toBe('');
			expect(extractTextFromResponse(undefined)).toBe('');
			expect(extractTextFromResponse({})).toBe('');
			expect(extractTextFromResponse({ content: {} })).toBe('');
			expect(extractTextFromResponse({ content: null })).toBe('');
		});

		it('should handle nested response structures', () => {
			const response = {
				content: {
					type: 'text',
					text: 'Nested text'
				}
			};

			expect(extractTextFromResponse(response)).toBe('Nested text');
		});
	});
});
