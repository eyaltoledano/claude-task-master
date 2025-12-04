/**
 * Unit Tests for Tool Helper Functions
 */

import { describe, it, expect } from '@jest/globals';
import {
	convertToolsToSnowflakeFormat,
	parseToolCalls,
	createToolResult,
	hasToolCalls,
	getFinishReason
} from '../../../src/utils/tool-helpers.js';

describe('Tool Helpers', () => {
	describe('convertToolsToSnowflakeFormat', () => {
		it('should convert simple tool to Cortex format', () => {
			const tools = {
				test_tool: {
					description: 'A test tool',
					parameters: {
						type: 'object',
						properties: {
							query: { type: 'string' }
						}
					}
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result).toHaveLength(1);
			expect(result[0].tool_spec.type).toBe('generic');
			expect(result[0].tool_spec.name).toBe('test_tool');
			expect(result[0].tool_spec.description).toBe('A test tool');
			expect(result[0].tool_spec.input_schema).toBeDefined();
		});

		it('should add cache_control when enableCaching is true', () => {
			const tools = {
				cached_tool: {
					description: 'A cached tool',
					parameters: { type: 'object', properties: {} }
				}
			};

			const result = convertToolsToSnowflakeFormat(tools, true);

			expect(result[0].cache_control).toEqual({ type: 'ephemeral' });
		});

		it('should not add cache_control when enableCaching is false', () => {
			const tools = {
				uncached_tool: {
					description: 'An uncached tool',
					parameters: { type: 'object', properties: {} }
				}
			};

			const result = convertToolsToSnowflakeFormat(tools, false);

			expect(result[0].cache_control).toBeUndefined();
		});

		it('should convert multiple tools', () => {
			const tools = {
				tool1: { description: 'Tool 1', parameters: { type: 'object', properties: {} } },
				tool2: { description: 'Tool 2', parameters: { type: 'object', properties: {} } },
				tool3: { description: 'Tool 3', parameters: { type: 'object', properties: {} } }
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result).toHaveLength(3);
			expect(result.map(r => r.tool_spec.name)).toEqual(['tool1', 'tool2', 'tool3']);
		});

		it('should use default description if not provided', () => {
			const tools = {
				no_desc_tool: {
					parameters: { type: 'object', properties: {} }
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result[0].tool_spec.description).toBe('Tool: no_desc_tool');
		});
	});

	describe('parseToolCalls', () => {
		it('should parse tool calls from choices format', () => {
			const response = {
				choices: [{
					message: {
						content: [
							{
								type: 'tool_use',
								id: 'call_123',
								name: 'web_search',
								input: { query: 'test query' }
							}
						]
					}
				}]
			};

			const result = parseToolCalls(response);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('call_123');
			expect(result[0].type).toBe('tool_use');
			expect(result[0].name).toBe('web_search');
			expect(result[0].input).toEqual({ query: 'test query' });
		});

		it('should parse multiple tool calls', () => {
			const response = {
				choices: [{
					message: {
						content: [
							{ type: 'tool_use', id: 'call_1', name: 'tool1', input: {} },
							{ type: 'tool_use', id: 'call_2', name: 'tool2', input: {} },
							{ type: 'text', text: 'some text' }, // Should be ignored
							{ type: 'tool_use', id: 'call_3', name: 'tool3', input: {} }
						]
					}
				}]
			};

			const result = parseToolCalls(response);

			expect(result).toHaveLength(3);
			expect(result.map(r => r.name)).toEqual(['tool1', 'tool2', 'tool3']);
		});

		it('should return empty array for no tool calls', () => {
			const response = {
				choices: [{
					message: {
						content: [{ type: 'text', text: 'No tools used' }]
					}
				}]
			};

			const result = parseToolCalls(response);

			expect(result).toEqual([]);
		});

		it('should handle missing message content', () => {
			const response = {
				choices: [{ message: {} }]
			};

			const result = parseToolCalls(response);

			expect(result).toEqual([]);
		});

		it('should handle empty response', () => {
			expect(parseToolCalls({})).toEqual([]);
		});
	});

	describe('createToolResult', () => {
		it('should create tool result with string content', () => {
			const result = createToolResult('call_123', 'The result is 42');

			expect(result.type).toBe('tool_result');
			expect(result.tool_use_id).toBe('call_123');
			expect(result.content).toBe('The result is 42');
		});

		it('should stringify object results', () => {
			const result = createToolResult('call_456', { answer: 42, data: [1, 2, 3] });

			expect(result.type).toBe('tool_result');
			expect(result.tool_use_id).toBe('call_456');
			expect(result.content).toBe(JSON.stringify({ answer: 42, data: [1, 2, 3] }));
		});

		it('should handle null result', () => {
			const result = createToolResult('call_789', null);

			expect(result.content).toBe('null');
		});
	});

	describe('hasToolCalls', () => {
		it('should return true when tool calls exist', () => {
			const response = {
				choices: [{
					message: {
						content: [{ type: 'tool_use', id: 'call_1', name: 'tool1', input: {} }]
					}
				}]
			};

			expect(hasToolCalls(response)).toBe(true);
		});

		it('should return false when no tool calls', () => {
			const response = {
				choices: [{
					message: {
						content: [{ type: 'text', text: 'Hello' }]
					}
				}]
			};

			expect(hasToolCalls(response)).toBe(false);
		});
	});

	describe('getFinishReason', () => {
		it('should return stop for normal completion', () => {
			const response = {
				choices: [{ finish_reason: 'stop' }]
			};

			expect(getFinishReason(response)).toBe('stop');
		});

		it('should return tool_calls when tool calls present', () => {
			const response = {
				choices: [{
					message: {
						content: [{ type: 'tool_use', id: 'call_1', name: 'tool1', input: {} }]
					}
				}]
			};

			expect(getFinishReason(response)).toBe('tool_calls');
		});

		it('should return finish_reason from response', () => {
			const response = {
				choices: [{ finish_reason: 'length' }]
			};

			expect(getFinishReason(response)).toBe('length');
		});

		it('should return stop for empty response', () => {
			expect(getFinishReason({})).toBe('stop');
		});
	});
});

