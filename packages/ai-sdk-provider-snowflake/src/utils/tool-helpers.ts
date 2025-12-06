/**
 * Tool Conversion Utilities
 *
 * Converts AI SDK tools to Snowflake Cortex REST API format and handles
 * tool call responses.
 */

import type {
	CortexToolSpec,
	CortexToolCall,
	CortexToolResult
} from '../tools/types.js';

/**
 * AI SDK tool definition (simplified interface)
 */
export interface AiSdkTool {
	description?: string;
	parameters?:
		| {
				_def?: {
					typeName?: string;
				};
				shape?: Record<string, unknown>;
		  }
		| Record<string, unknown>;
	execute?: (input: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Convert a Zod schema to JSON Schema format
 * This is a simplified conversion that handles common cases
 */
function zodToJsonSchema(
	zodSchema: Record<string, unknown>
): Record<string, unknown> {
	// If it's already in JSON Schema format, return as-is
	if (zodSchema.type || zodSchema.properties) {
		return zodSchema;
	}

	// Handle Zod object schema
	if (zodSchema._def) {
		const def = zodSchema._def as Record<string, unknown>;

		if (def.typeName === 'ZodObject' && def.shape) {
			const shape = def.shape as () => Record<string, unknown>;
			const properties: Record<string, unknown> = {};
			const required: string[] = [];

			const shapeObj = typeof shape === 'function' ? shape() : shape;

			for (const [key, value] of Object.entries(shapeObj)) {
				const propDef =
					(value as { _def?: Record<string, unknown> })?._def || {};
				properties[key] = convertZodType(propDef);

				// Check if required (not optional)
				if (
					propDef.typeName !== 'ZodOptional' &&
					propDef.typeName !== 'ZodDefault'
				) {
					required.push(key);
				}
			}

			return {
				type: 'object',
				properties,
				required: required.length > 0 ? required : undefined
			};
		}
	}

	// Fallback - return empty object schema
	return { type: 'object', properties: {} };
}

/**
 * Convert a single Zod type to JSON Schema
 */
function convertZodType(def: Record<string, unknown>): Record<string, unknown> {
	const typeName = def.typeName as string;

	switch (typeName) {
		case 'ZodString':
			return { type: 'string', description: def.description as string };

		case 'ZodNumber':
			return { type: 'number', description: def.description as string };

		case 'ZodBoolean':
			return { type: 'boolean', description: def.description as string };

		case 'ZodArray': {
			const innerType =
				(def.type as { _def?: Record<string, unknown> })?._def || {};
			return {
				type: 'array',
				items: convertZodType(innerType),
				description: def.description as string
			};
		}

		case 'ZodOptional':
		case 'ZodDefault': {
			const innerType =
				(def.innerType as { _def?: Record<string, unknown> })?._def || {};
			return convertZodType(innerType);
		}

		case 'ZodEnum': {
			const values = def.values as string[];
			return {
				type: 'string',
				enum: values,
				description: def.description as string
			};
		}

		case 'ZodObject': {
			// def is already _def, so handle shape directly
			if (def.shape) {
				const shape = def.shape as
					| (() => Record<string, unknown>)
					| Record<string, unknown>;
				const properties: Record<string, unknown> = {};
				const required: string[] = [];
				const shapeObj = typeof shape === 'function' ? shape() : shape;

				for (const [key, value] of Object.entries(shapeObj)) {
					const propDef =
						(value as { _def?: Record<string, unknown> })?._def || {};
					properties[key] = convertZodType(propDef);

					// Check if required (not optional)
					if (
						propDef.typeName !== 'ZodOptional' &&
						propDef.typeName !== 'ZodDefault'
					) {
						required.push(key);
					}
				}

				return {
					type: 'object',
					properties,
					description: def.description as string | undefined,
					required: required.length > 0 ? required : undefined
				};
			}
			return { type: 'object', properties: {} };
		}

		default:
			return { type: 'string' };
	}
}

/**
 * Convert AI SDK tools to Snowflake Cortex REST API format
 *
 * Cortex REST API expects:
 * ```json
 * {
 *   "tools": [{
 *     "tool_spec": {
 *       "type": "generic",
 *       "name": "tool_name",
 *       "description": "What this tool does",
 *       "input_schema": { ... JSON Schema ... }
 *     }
 *   }]
 * }
 * ```
 *
 * @param tools - AI SDK tools object (Record<string, Tool>)
 * @param enableCaching - Whether to add cache_control for prompt caching
 * @returns Array of Cortex tool specifications
 */
export function convertToolsToSnowflakeFormat(
	tools: Record<string, AiSdkTool>,
	enableCaching = false
): CortexToolSpec[] {
	return Object.entries(tools).map(([name, tool]) => {
		// Convert parameters to JSON Schema
		let inputSchema: Record<string, unknown> = {
			type: 'object',
			properties: {}
		};

		if (tool.parameters) {
			inputSchema = zodToJsonSchema(tool.parameters as Record<string, unknown>);
		}

		const spec: CortexToolSpec = {
			tool_spec: {
				type: 'generic',
				name,
				description: tool.description || `Tool: ${name}`,
				input_schema: inputSchema
			}
		};

		// Add cache control for prompt caching if enabled
		if (enableCaching) {
			spec.cache_control = { type: 'ephemeral' };
		}

		return spec;
	});
}

/**
 * Parse tool calls from Cortex API response
 *
 * The API can return tool calls in multiple formats:
 *
 * Format 1 (content_list with nested tool_use - Claude via Cortex):
 * ```json
 * {
 *   "choices": [{
 *     "message": {
 *       "content_list": [{
 *         "type": "tool_use",
 *         "tool_use": {
 *           "tool_use_id": "tool_call_id",
 *           "name": "tool_name",
 *           "input": { ... }
 *         }
 *       }]
 *     }
 *   }]
 * }
 * ```
 *
 * Format 2 (content array with flat tool_use):
 * ```json
 * {
 *   "choices": [{
 *     "message": {
 *       "content": [{
 *         "type": "tool_use",
 *         "id": "tool_call_id",
 *         "name": "tool_name",
 *         "input": { ... }
 *       }]
 *     }
 *   }]
 * }
 * ```
 *
 * @param response - Cortex API response
 * @returns Array of tool calls
 */
export function parseToolCalls(
	response: Record<string, unknown>
): CortexToolCall[] {
	const toolCalls: CortexToolCall[] = [];

	// Handle structured_output format first (always check this regardless of message presence)
	const structuredOutput = response.structured_output as
		| Array<{ type?: string; tool_use?: CortexToolCall }>
		| undefined;
	if (structuredOutput) {
		for (const item of structuredOutput) {
			if (item.type === 'tool_use' && item.tool_use) {
				toolCalls.push(item.tool_use);
			}
		}
	}

	// Handle choices array format
	const choices = response.choices as
		| Array<{
				message?: {
					content?: unknown[];
					content_list?: unknown[];
				};
		  }>
		| undefined;

	const message = choices?.[0]?.message;
	// If no message, return any tool calls found in structured_output
	if (!message) return toolCalls;

	// Format 1: content_list with nested tool_use (Claude via Cortex)
	if (message.content_list && Array.isArray(message.content_list)) {
		for (const item of message.content_list) {
			const typedItem = item as {
				type?: string;
				tool_use?: {
					tool_use_id?: string;
					name?: string;
					input?: Record<string, unknown>;
				};
			};

			if (
				typedItem.type === 'tool_use' &&
				typedItem.tool_use?.tool_use_id &&
				typedItem.tool_use?.name
			) {
				toolCalls.push({
					id: typedItem.tool_use.tool_use_id,
					type: 'tool_use',
					name: typedItem.tool_use.name,
					input: typedItem.tool_use.input || {}
				});
			}
		}
	}

	// Format 2: content array with flat tool_use
	if (message.content && Array.isArray(message.content)) {
		for (const item of message.content) {
			const typedItem = item as {
				type?: string;
				id?: string;
				name?: string;
				input?: Record<string, unknown>;
			};
			if (typedItem.type === 'tool_use' && typedItem.id && typedItem.name) {
				toolCalls.push({
					id: typedItem.id,
					type: 'tool_use',
					name: typedItem.name,
					input: typedItem.input || {}
				});
			}
		}
	}

	return toolCalls;
}

/**
 * Create a tool result message for sending back to the API
 *
 * @param toolCallId - ID of the tool call being responded to
 * @param result - Result from executing the tool
 * @returns Tool result object
 */
export function createToolResult(
	toolCallId: string,
	result: unknown
): CortexToolResult {
	return {
		type: 'tool_result',
		tool_use_id: toolCallId,
		content: typeof result === 'string' ? result : JSON.stringify(result)
	};
}

/**
 * Execute a tool and return the result
 *
 * @param tool - AI SDK tool definition
 * @param input - Input parameters for the tool
 * @returns Tool execution result
 */
export async function executeTool(
	tool: AiSdkTool,
	input: Record<string, unknown>
): Promise<unknown> {
	if (!tool.execute) {
		throw new Error('Tool does not have an execute function');
	}

	try {
		return await tool.execute(input);
	} catch (error) {
		// Return error as string for the model to handle
		return {
			error: true,
			message: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Check if a response contains tool calls
 *
 * @param response - Cortex API response
 * @returns True if response contains tool calls
 */
export function hasToolCalls(response: Record<string, unknown>): boolean {
	return parseToolCalls(response).length > 0;
}

/**
 * Get the finish reason from a Cortex API response
 *
 * @param response - Cortex API response
 * @returns Finish reason string
 */
export function getFinishReason(response: Record<string, unknown>): string {
	const choices = response.choices as
		| Array<{ finish_reason?: string }>
		| undefined;
	if (choices?.[0]?.finish_reason) {
		return choices[0].finish_reason;
	}

	// Check for tool_use indicator
	if (hasToolCalls(response)) {
		return 'tool_calls';
	}

	return 'stop';
}

// Named exports are preferred over default exports
// All functions are exported individually above
