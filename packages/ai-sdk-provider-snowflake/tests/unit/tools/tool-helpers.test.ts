/**
 * Unit Tests for Tool Helper Functions
 * Target: 90%+ coverage for src/utils/tool-helpers.ts
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
	convertToolsToSnowflakeFormat,
	parseToolCalls,
	createToolResult,
	executeTool,
	hasToolCalls,
	getFinishReason,
	type AiSdkTool
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
				tool1: {
					description: 'Tool 1',
					parameters: { type: 'object', properties: {} }
				},
				tool2: {
					description: 'Tool 2',
					parameters: { type: 'object', properties: {} }
				},
				tool3: {
					description: 'Tool 3',
					parameters: { type: 'object', properties: {} }
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result).toHaveLength(3);
			expect(result.map((r) => r.tool_spec.name)).toEqual([
				'tool1',
				'tool2',
				'tool3'
			]);
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

		it('should handle tool without parameters', () => {
			const tools = {
				no_params_tool: {
					description: 'No params'
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result[0].tool_spec.input_schema).toEqual({
				type: 'object',
				properties: {}
			});
		});

		it('should convert Zod-like object schema', () => {
			// Simulate a Zod object schema structure
			const zodLikeSchema = {
				_def: {
					typeName: 'ZodObject',
					shape: () => ({
						query: {
							_def: {
								typeName: 'ZodString',
								description: 'Search query'
							}
						},
						count: {
							_def: {
								typeName: 'ZodNumber',
								description: 'Result count'
							}
						},
						enabled: {
							_def: {
								typeName: 'ZodBoolean'
							}
						}
					})
				}
			};

			const tools = {
				zod_tool: {
					description: 'Zod tool',
					parameters: zodLikeSchema
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result[0].tool_spec.input_schema.type).toBe('object');
			expect(result[0].tool_spec.input_schema.properties).toBeDefined();
			expect(result[0].tool_spec.input_schema.required).toContain('query');
		});

		it('should handle Zod optional and default types', () => {
			const zodLikeSchema = {
				_def: {
					typeName: 'ZodObject',
					shape: () => ({
						required_field: {
							_def: { typeName: 'ZodString' }
						},
						optional_field: {
							_def: {
								typeName: 'ZodOptional',
								innerType: { _def: { typeName: 'ZodString' } }
							}
						},
						default_field: {
							_def: {
								typeName: 'ZodDefault',
								innerType: { _def: { typeName: 'ZodNumber' } }
							}
						}
					})
				}
			};

			const tools = {
				optional_tool: {
					description: 'Optional tool',
					parameters: zodLikeSchema
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			// Only required_field should be in required array
			expect(result[0].tool_spec.input_schema.required).toEqual([
				'required_field'
			]);
		});

		it('should handle Zod array type', () => {
			const zodLikeSchema = {
				_def: {
					typeName: 'ZodObject',
					shape: () => ({
						items: {
							_def: {
								typeName: 'ZodArray',
								type: { _def: { typeName: 'ZodString' } }
							}
						}
					})
				}
			};

			const tools = {
				array_tool: {
					description: 'Array tool',
					parameters: zodLikeSchema
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result[0].tool_spec.input_schema.properties.items.type).toBe(
				'array'
			);
		});

		it('should handle Zod enum type', () => {
			const zodLikeSchema = {
				_def: {
					typeName: 'ZodObject',
					shape: () => ({
						status: {
							_def: {
								typeName: 'ZodEnum',
								values: ['pending', 'done', 'cancelled'],
								description: 'Task status'
							}
						}
					})
				}
			};

			const tools = {
				enum_tool: {
					description: 'Enum tool',
					parameters: zodLikeSchema
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result[0].tool_spec.input_schema.properties.status.type).toBe(
				'string'
			);
			expect(result[0].tool_spec.input_schema.properties.status.enum).toEqual([
				'pending',
				'done',
				'cancelled'
			]);
		});

		it('should handle nested Zod objects', () => {
			const zodLikeSchema = {
				_def: {
					typeName: 'ZodObject',
					shape: () => ({
						nested: {
							_def: {
								typeName: 'ZodObject',
								shape: () => ({
									inner: { _def: { typeName: 'ZodString' } }
								})
							}
						}
					})
				}
			};

			const tools = {
				nested_tool: {
					description: 'Nested tool',
					parameters: zodLikeSchema
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result[0].tool_spec.input_schema.properties.nested.type).toBe(
				'object'
			);
		});

		it('should handle deeply nested Zod objects with correct property conversion', () => {
			const zodLikeSchema = {
				_def: {
					typeName: 'ZodObject',
					shape: () => ({
						level1: {
							_def: {
								typeName: 'ZodObject',
								description: 'First level',
								shape: () => ({
									level2: {
										_def: {
											typeName: 'ZodObject',
											description: 'Second level',
											shape: () => ({
												deepValue: {
													_def: {
														typeName: 'ZodString',
														description: 'Deep string value'
													}
												},
												deepNumber: {
													_def: {
														typeName: 'ZodNumber',
														description: 'Deep number value'
													}
												}
											})
										}
									},
									siblingValue: {
										_def: { typeName: 'ZodBoolean' }
									}
								})
							}
						}
					})
				}
			};

			const tools = {
				deep_nested_tool: {
					description: 'Deeply nested tool',
					parameters: zodLikeSchema
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);
			const inputSchema = result[0].tool_spec.input_schema;

			// Verify top-level structure
			expect(inputSchema.type).toBe('object');
			expect(inputSchema.properties.level1).toBeDefined();
			expect(inputSchema.properties.level1.type).toBe('object');

			// Verify second level
			const level1Props = inputSchema.properties.level1.properties;
			expect(level1Props.level2).toBeDefined();
			expect(level1Props.level2.type).toBe('object');
			expect(level1Props.siblingValue).toBeDefined();
			expect(level1Props.siblingValue.type).toBe('boolean');

			// Verify third level (deepest)
			const level2Props = level1Props.level2.properties;
			expect(level2Props.deepValue).toBeDefined();
			expect(level2Props.deepValue.type).toBe('string');
			expect(level2Props.deepValue.description).toBe('Deep string value');
			expect(level2Props.deepNumber).toBeDefined();
			expect(level2Props.deepNumber.type).toBe('number');
			expect(level2Props.deepNumber.description).toBe('Deep number value');
		});

		it('should handle unknown Zod types with string fallback', () => {
			const zodLikeSchema = {
				_def: {
					typeName: 'ZodObject',
					shape: () => ({
						unknown_field: {
							_def: { typeName: 'ZodUnknownType' }
						}
					})
				}
			};

			const tools = {
				unknown_tool: {
					description: 'Unknown type tool',
					parameters: zodLikeSchema
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result[0].tool_spec.input_schema.properties.unknown_field.type).toBe(
				'string'
			);
		});

		it('should handle shape as object instead of function', () => {
			const zodLikeSchema = {
				_def: {
					typeName: 'ZodObject',
					shape: {
						field: { _def: { typeName: 'ZodString' } }
					}
				}
			};

			const tools = {
				shape_obj_tool: {
					description: 'Shape object tool',
					parameters: zodLikeSchema
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result[0].tool_spec.input_schema.properties.field).toBeDefined();
		});

		it('should return empty schema for non-object Zod types', () => {
			const zodLikeSchema = {
				_def: {
					typeName: 'ZodString'
				}
			};

			const tools = {
				non_object_tool: {
					description: 'Non-object tool',
					parameters: zodLikeSchema
				}
			};

			const result = convertToolsToSnowflakeFormat(tools);

			expect(result[0].tool_spec.input_schema).toEqual({
				type: 'object',
				properties: {}
			});
		});
	});

	describe('parseToolCalls', () => {
		it('should parse tool calls from choices format', () => {
			const response = {
				choices: [
					{
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
					}
				]
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
				choices: [
					{
						message: {
							content: [
								{ type: 'tool_use', id: 'call_1', name: 'tool1', input: {} },
								{ type: 'tool_use', id: 'call_2', name: 'tool2', input: {} },
								{ type: 'text', text: 'some text' }, // Should be ignored
								{ type: 'tool_use', id: 'call_3', name: 'tool3', input: {} }
							]
						}
					}
				]
			};

			const result = parseToolCalls(response);

			expect(result).toHaveLength(3);
			expect(result.map((r) => r.name)).toEqual(['tool1', 'tool2', 'tool3']);
		});

		it('should return empty array for no tool calls', () => {
			const response = {
				choices: [
					{
						message: {
							content: [{ type: 'text', text: 'No tools used' }]
						}
					}
				]
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

		it('should parse content_list format (Claude via Cortex)', () => {
			const response = {
				choices: [
					{
						message: {
							content_list: [
								{
									type: 'tool_use',
									tool_use: {
										tool_use_id: 'claude_call_123',
										name: 'search_tool',
										input: { query: 'Claude query' }
									}
								},
								{
									type: 'tool_use',
									tool_use: {
										tool_use_id: 'claude_call_456',
										name: 'another_tool',
										input: {}
									}
								}
							]
						}
					}
				]
			};

			const result = parseToolCalls(response);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe('claude_call_123');
			expect(result[0].name).toBe('search_tool');
			expect(result[1].id).toBe('claude_call_456');
		});

		it('should handle content_list with missing tool_use_id', () => {
			const response = {
				choices: [
					{
						message: {
							content_list: [
								{
									type: 'tool_use',
									tool_use: {
										// Missing tool_use_id
										name: 'incomplete_tool'
									}
								}
							]
						}
					}
				]
			};

			const result = parseToolCalls(response);

			expect(result).toEqual([]);
		});

		it('should handle content_list with missing tool_use.name', () => {
			const response = {
				choices: [
					{
						message: {
							content_list: [
								{
									type: 'tool_use',
									tool_use: {
										tool_use_id: 'id_123'
										// Missing name
									}
								}
							]
						}
					}
				]
			};

			const result = parseToolCalls(response);

			expect(result).toEqual([]);
		});

		it('should use empty input when input is undefined', () => {
			const response = {
				choices: [
					{
						message: {
							content: [
								{
									type: 'tool_use',
									id: 'call_no_input',
									name: 'tool_no_input'
									// No input field
								}
							]
						}
					}
				]
			};

			const result = parseToolCalls(response);

			expect(result[0].input).toEqual({});
		});

		it('should use empty input for content_list when input is undefined', () => {
			const response = {
				choices: [
					{
						message: {
							content_list: [
								{
									type: 'tool_use',
									tool_use: {
										tool_use_id: 'id_123',
										name: 'tool_name'
										// No input field
									}
								}
							]
						}
					}
				]
			};

			const result = parseToolCalls(response);

			expect(result[0].input).toEqual({});
		});

		it('should parse structured_output format (requires message to be present)', () => {
			// Note: The implementation requires choices[0].message to exist
			// before processing structured_output
			const response = {
				choices: [{ message: {} }],
				structured_output: [
					{
						type: 'tool_use',
						tool_use: {
							id: 'struct_call_1',
							type: 'tool_use' as const,
							name: 'structured_tool',
							input: { data: 'value' }
						}
					}
				]
			};

			const result = parseToolCalls(response);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('structured_tool');
		});

		it('should ignore non-tool_use items in structured_output', () => {
			const response = {
				choices: [{ message: {} }],
				structured_output: [
					{ type: 'text' }, // Not tool_use type
					{
						type: 'tool_use',
						tool_use: {
							id: 'call_1',
							type: 'tool_use' as const,
							name: 'tool1',
							input: {}
						}
					}
				]
			};

			const result = parseToolCalls(response);

			expect(result).toHaveLength(1);
		});

		it('should ignore structured_output items without tool_use object', () => {
			const response = {
				choices: [{ message: {} }],
				structured_output: [
					{ type: 'tool_use' } // Missing tool_use object
				]
			};

			const result = parseToolCalls(response);

			expect(result).toHaveLength(0);
		});

		it('should process structured_output even when no message exists', () => {
			// structured_output is processed regardless of message presence
			const response = {
				choices: [],
				structured_output: [
					{
						type: 'tool_use',
						tool_use: {
							id: 'call_1',
							type: 'tool_use' as const,
							name: 'tool1',
							input: {}
						}
					}
				]
			};

			const result = parseToolCalls(response);

			// structured_output is processed first, regardless of message presence
			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: 'call_1',
				name: 'tool1',
				input: {}
			});
		});

		it('should combine tool calls from multiple formats', () => {
			const response = {
				choices: [
					{
						message: {
							content: [
								{ type: 'tool_use', id: 'content_call', name: 'content_tool', input: {} }
							],
							content_list: [
								{
									type: 'tool_use',
									tool_use: {
										tool_use_id: 'list_call',
										name: 'list_tool',
										input: {}
									}
								}
							]
						}
					}
				],
				structured_output: [
					{
						type: 'tool_use',
						tool_use: {
							id: 'struct_call',
							type: 'tool_use' as const,
							name: 'struct_tool',
							input: {}
						}
					}
				]
			};

			const result = parseToolCalls(response);

			// Should collect from all formats (content_list, content, structured_output)
			expect(result.length).toBe(3);
			expect(result.map((r) => r.name).sort()).toEqual(
				['content_tool', 'list_tool', 'struct_tool']
			);
		});

		it('should handle content item with missing id', () => {
			const response = {
				choices: [
					{
						message: {
							content: [
								{
									type: 'tool_use',
									// Missing id
									name: 'incomplete_tool',
									input: {}
								}
							]
						}
					}
				]
			};

			const result = parseToolCalls(response);

			expect(result).toEqual([]);
		});

		it('should handle content item with missing name', () => {
			const response = {
				choices: [
					{
						message: {
							content: [
								{
									type: 'tool_use',
									id: 'call_id'
									// Missing name
								}
							]
						}
					}
				]
			};

			const result = parseToolCalls(response);

			expect(result).toEqual([]);
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
			const result = createToolResult('call_456', {
				answer: 42,
				data: [1, 2, 3]
			});

			expect(result.type).toBe('tool_result');
			expect(result.tool_use_id).toBe('call_456');
			expect(result.content).toBe(
				JSON.stringify({ answer: 42, data: [1, 2, 3] })
			);
		});

		it('should handle null result', () => {
			const result = createToolResult('call_789', null);

			expect(result.content).toBe('null');
		});

		it('should handle array results', () => {
			const result = createToolResult('id', [1, 2, 3]);

			expect(result.content).toBe('[1,2,3]');
		});

		it('should handle numeric results', () => {
			const result = createToolResult('id', 42);

			expect(result.content).toBe('42');
		});

		it('should handle boolean results', () => {
			const result = createToolResult('id', true);

			expect(result.content).toBe('true');
		});

		it('should handle undefined results', () => {
			const result = createToolResult('id', undefined);

			// undefined becomes undefined when stringified
			expect(result.content).toBeUndefined();
		});

		it('should handle empty string results', () => {
			const result = createToolResult('id', '');

			expect(result.content).toBe('');
		});

		it('should handle empty object results', () => {
			const result = createToolResult('id', {});

			expect(result.content).toBe('{}');
		});
	});

	describe('hasToolCalls', () => {
		it('should return true when tool calls exist', () => {
			const response = {
				choices: [
					{
						message: {
							content: [
								{ type: 'tool_use', id: 'call_1', name: 'tool1', input: {} }
							]
						}
					}
				]
			};

			expect(hasToolCalls(response)).toBe(true);
		});

		it('should return false when no tool calls', () => {
			const response = {
				choices: [
					{
						message: {
							content: [{ type: 'text', text: 'Hello' }]
						}
					}
				]
			};

			expect(hasToolCalls(response)).toBe(false);
		});

		it('should return true for content_list format', () => {
			const response = {
				choices: [
					{
						message: {
							content_list: [
								{
									type: 'tool_use',
									tool_use: {
										tool_use_id: 'id',
										name: 'tool',
										input: {}
									}
								}
							]
						}
					}
				]
			};

			expect(hasToolCalls(response)).toBe(true);
		});

		it('should return true for structured_output format (requires message)', () => {
			// Note: parseToolCalls requires choices[0].message to exist
			const response = {
				choices: [{ message: {} }],
				structured_output: [
					{
						type: 'tool_use',
						tool_use: {
							id: 'id',
							type: 'tool_use' as const,
							name: 'tool',
							input: {}
						}
					}
				]
			};

			expect(hasToolCalls(response)).toBe(true);
		});

		it('should return false for empty response', () => {
			expect(hasToolCalls({})).toBe(false);
		});

		it('should return false when choices is empty array', () => {
			expect(hasToolCalls({ choices: [] })).toBe(false);
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
				choices: [
					{
						message: {
							content: [
								{ type: 'tool_use', id: 'call_1', name: 'tool1', input: {} }
							]
						}
					}
				]
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

		it('should return stop when no choices', () => {
			expect(getFinishReason({ choices: [] })).toBe('stop');
		});

		it('should return finish_reason when both finish_reason and tool calls exist', () => {
			// Per implementation: finish_reason is checked first, then tool calls
			const response = {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: [
								{ type: 'tool_use', id: 'call_1', name: 'tool', input: {} }
							]
						}
					}
				]
			};

			// The implementation returns finish_reason first if present
			expect(getFinishReason(response)).toBe('stop');
		});

		it('should return tool_calls when no finish_reason but tool calls exist', () => {
			const response = {
				choices: [
					{
						message: {
							content: [
								{ type: 'tool_use', id: 'call_1', name: 'tool', input: {} }
							]
						}
					}
				]
			};

			expect(getFinishReason(response)).toBe('tool_calls');
		});

		it('should handle content_complete finish reason', () => {
			const response = {
				choices: [{ finish_reason: 'content_complete' }]
			};

			expect(getFinishReason(response)).toBe('content_complete');
		});
	});

	describe('executeTool', () => {
		it('should execute a tool and return result', async () => {
			const mockExecute = jest.fn().mockResolvedValue('executed result');
			const tool: AiSdkTool = {
				description: 'Test tool',
				parameters: { type: 'object', properties: {} },
				execute: mockExecute
			};

			const result = await executeTool(tool, { param: 'value' });

			expect(mockExecute).toHaveBeenCalledWith({ param: 'value' });
			expect(result).toBe('executed result');
		});

		it('should return error object when execute throws', async () => {
			const tool: AiSdkTool = {
				description: 'A failing tool',
				parameters: { type: 'object', properties: {} },
				execute: jest.fn().mockRejectedValue(new Error('Tool execution failed'))
			};

			const result = await executeTool(tool, {});

			expect(result).toEqual({
				error: true,
				message: 'Tool execution failed'
			});
		});

		it('should throw when tool has no execute function', async () => {
			const tool: AiSdkTool = {
				description: 'No execute',
				parameters: { type: 'object', properties: {} }
				// No execute function
			};

			await expect(executeTool(tool, {})).rejects.toThrow(
				'Tool does not have an execute function'
			);
		});

		it('should handle non-Error exceptions', async () => {
			const tool: AiSdkTool = {
				description: 'Tool with string error',
				parameters: { type: 'object', properties: {} },
				execute: jest.fn().mockRejectedValue('String error')
			};

			const result = await executeTool(tool, {});

			expect(result).toEqual({
				error: true,
				message: 'Unknown error'
			});
		});

		it('should pass through complex results', async () => {
			const complexResult = {
				data: [1, 2, 3],
				nested: { value: 'test' }
			};
			const tool: AiSdkTool = {
				description: 'Complex result tool',
				parameters: { type: 'object', properties: {} },
				execute: jest.fn().mockResolvedValue(complexResult)
			};

			const result = await executeTool(tool, {});

			expect(result).toEqual(complexResult);
		});

		it('should handle async execution', async () => {
			const tool: AiSdkTool = {
				description: 'Async tool',
				parameters: { type: 'object', properties: {} },
				execute: jest.fn().mockImplementation(
					async (input) =>
						new Promise((resolve) =>
							setTimeout(() => resolve(`Input was: ${JSON.stringify(input)}`), 10)
						)
				)
			};

			const result = await executeTool(tool, { key: 'value' });

			expect(result).toBe('Input was: {"key":"value"}');
		});
	});
});
