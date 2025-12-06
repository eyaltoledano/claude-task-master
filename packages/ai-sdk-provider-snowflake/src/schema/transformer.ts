/**
 * Shared schema transformation utilities for Snowflake Cortex providers
 *
 * This module provides JSON Schema cleaning and transformation logic required
 * for compatibility with Snowflake Cortex's structured output constraints.
 *
 * Reference: https://docs.snowflake.com/en/user-guide/snowflake-cortex/complete-structured-outputs
 */

/**
 * JSON Schema type definitions
 */
export type JSONSchemaType =
	| 'null'
	| 'boolean'
	| 'object'
	| 'array'
	| 'number'
	| 'string'
	| 'integer';

export interface JSONSchema {
	type?: JSONSchemaType | JSONSchemaType[];
	description?: string;
	properties?: Record<string, JSONSchema>;
	required?: string[];
	items?: JSONSchema;
	anyOf?: JSONSchema[];
	oneOf?: JSONSchema[];
	additionalProperties?: boolean | JSONSchema;
	default?: any;
	$schema?: string;
	// Number constraints
	multipleOf?: number;
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
	exclusiveMaximum?: number;
	// String constraints
	minLength?: number;
	maxLength?: number;
	format?: string;
	pattern?: string;
	// Array constraints
	uniqueItems?: boolean;
	contains?: JSONSchema;
	minContains?: number;
	maxContains?: number;
	minItems?: number;
	maxItems?: number;
	// Object constraints
	patternProperties?: Record<string, JSONSchema>;
	minProperties?: number;
	maxProperties?: number;
	propertyNames?: JSONSchema;
	// Internal marker for optional fields
	_isOptional?: boolean;
	// Allow other properties
	[key: string]: any;
}

// Performance optimization: Cache transformed schemas
const _schemaCache = new WeakMap<JSONSchema, JSONSchema>();

/**
 * Snowflake-unsupported JSON Schema constraint keywords
 * These keywords must be removed before sending schemas to Snowflake Cortex API
 */
export const UNSUPPORTED_KEYWORDS = [
	// General
	'default',
	'$schema',

	// Number constraints
	'multipleOf',
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',

	// String constraints
	'minLength',
	'maxLength',
	'format',
	'pattern',

	// Array constraints
	'uniqueItems',
	'contains',
	'minContains',
	'maxContains',
	'minItems',
	'maxItems',

	// Object constraints
	'patternProperties',
	'minProperties',
	'maxProperties',
	'propertyNames'
];

/**
 * Build description text from unsupported constraints
 * This converts removed constraint keywords into human-readable descriptions
 * that can be appended to the schema description.
 *
 * @param schema - JSON Schema object
 * @returns Constraint description to append (e.g., " (3-10 characters, format: email)")
 */
export function buildConstraintDescription(schema: JSONSchema): string {
	const constraints: string[] = [];

	// String constraints
	if (schema.minLength !== undefined || schema.maxLength !== undefined) {
		if (schema.minLength !== undefined && schema.maxLength !== undefined) {
			constraints.push(`${schema.minLength}-${schema.maxLength} characters`);
		} else if (schema.minLength !== undefined) {
			constraints.push(`minimum ${schema.minLength} characters`);
		} else if (schema.maxLength !== undefined) {
			constraints.push(`maximum ${schema.maxLength} characters`);
		}
	}

	if (schema.format) {
		constraints.push(`format: ${schema.format}`);
	}

	if (schema.pattern) {
		constraints.push(`pattern: ${schema.pattern}`);
	}

	// Number constraints
	if (schema.minimum !== undefined || schema.maximum !== undefined) {
		if (schema.minimum !== undefined && schema.maximum !== undefined) {
			constraints.push(`range: ${schema.minimum}-${schema.maximum}`);
		} else if (schema.minimum !== undefined) {
			constraints.push(`minimum: ${schema.minimum}`);
		} else if (schema.maximum !== undefined) {
			constraints.push(`maximum: ${schema.maximum}`);
		}
	}

	if (schema.exclusiveMinimum !== undefined) {
		constraints.push(`> ${schema.exclusiveMinimum}`);
	}

	if (schema.exclusiveMaximum !== undefined) {
		constraints.push(`< ${schema.exclusiveMaximum}`);
	}

	if (schema.multipleOf !== undefined) {
		constraints.push(`multiple of ${schema.multipleOf}`);
	}

	// Array constraints
	if (schema.minItems !== undefined || schema.maxItems !== undefined) {
		if (schema.minItems !== undefined && schema.maxItems !== undefined) {
			constraints.push(`${schema.minItems}-${schema.maxItems} items`);
		} else if (schema.minItems !== undefined) {
			constraints.push(`minimum ${schema.minItems} items`);
		} else if (schema.maxItems !== undefined) {
			constraints.push(`maximum ${schema.maxItems} items`);
		}
	}

	if (schema.uniqueItems) {
		constraints.push('unique items');
	}

	// Object constraints
	if (
		schema.minProperties !== undefined ||
		schema.maxProperties !== undefined
	) {
		if (
			schema.minProperties !== undefined &&
			schema.maxProperties !== undefined
		) {
			constraints.push(
				`${schema.minProperties}-${schema.maxProperties} properties`
			);
		} else if (schema.minProperties !== undefined) {
			constraints.push(`minimum ${schema.minProperties} properties`);
		} else if (schema.maxProperties !== undefined) {
			constraints.push(`maximum ${schema.maxProperties} properties`);
		}
	}

	return constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
}

/**
 * Recursively removes Snowflake-unsupported features from JSON Schema
 * and adds constraint information to descriptions.
 *
 * This function performs several transformations:
 * 1. Removes unsupported constraint keywords
 * 2. Converts constraints to description text
 * 3. Flattens anyOf with null to optional fields
 * 4. Converts type arrays with null to optional fields
 * 5. Adds additionalProperties: false to all objects (required by Snowflake)
 * 6. Properly maintains required arrays, excluding optional fields
 * 7. Recursively processes nested schemas
 *
 * @param schema - JSON Schema object to clean
 * @returns Cleaned schema compatible with Snowflake Cortex
 *
 * @example
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     email: {
 *       type: 'string',
 *       format: 'email',
 *       minLength: 5,
 *       maxLength: 100
 *     },
 *     age: {
 *       anyOf: [{ type: 'number' }, { type: 'null' }]
 *     }
 *   }
 * };
 *
 * const cleaned = removeUnsupportedFeatures(schema);
 * // Result:
 * // {
 * //   type: 'object',
 * //   additionalProperties: false,
 * //   properties: {
 * //     email: {
 * //       type: 'string',
 * //       description: ' (5-100 characters, format: email)'
 * //     },
 * //     age: {
 * //       type: 'number'
 * //     }
 * //   },
 * //   required: ['email']  // age is optional
 * // }
 */
export function removeUnsupportedFeatures(schema: JSONSchema): JSONSchema {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	// Check cache first for performance
	if (_schemaCache.has(schema)) {
		return _schemaCache.get(schema)!;
	}

	const cleaned: JSONSchema = { ...schema };

	// Build constraint description before removing keywords
	const constraintDesc = buildConstraintDescription(schema);

	// Add constraints to description if they exist
	if (constraintDesc && cleaned.description) {
		// Only add if not already present
		if (!cleaned.description.includes(constraintDesc)) {
			cleaned.description = cleaned.description + constraintDesc;
		}
	}

	// Remove Snowflake-unsupported keywords
	UNSUPPORTED_KEYWORDS.forEach((keyword) => {
		delete cleaned[keyword];
	});

	// Handle anyOf with null (convert to optional by flattening)
	if (cleaned.anyOf) {
		const nonNullTypes = cleaned.anyOf.filter(
			(item) =>
				!(
					item.type === 'null' ||
					(Array.isArray(item.type) && item.type.includes('null'))
				)
		);
		if (nonNullTypes.length === 1) {
			// Single non-null type - flatten it and mark as optional
			Object.assign(cleaned, nonNullTypes[0]);
			delete cleaned.anyOf;
			// Mark as optional so parent object excludes it from required array
			cleaned._isOptional = true;
		} else if (nonNullTypes.length > 1) {
			cleaned.anyOf = nonNullTypes.map((item) =>
				removeUnsupportedFeatures(item)
			);
		}
	}

	// Handle type: [<any-type>, "null"] pattern - convert to type: <any-type> and mark as optional
	// Examples: ["string", "null"] → "string", ["object", "null"] → "object", etc.
	if (Array.isArray(cleaned.type) && cleaned.type.includes('null')) {
		const nonNullTypes = cleaned.type.filter((t) => t !== 'null');
		if (nonNullTypes.length === 1) {
			cleaned.type = nonNullTypes[0];
			// Mark this field as optional (will be used in parent object processing)
			cleaned._isOptional = true;
		} else if (nonNullTypes.length > 1) {
			cleaned.type = nonNullTypes as JSONSchemaType[];
			cleaned._isOptional = true;
		}
	}

	// Normalize objects
	if (cleaned.type === 'object') {
		// CRITICAL: Snowflake requires additionalProperties: false in EVERY object node
		cleaned.additionalProperties = false;

		if (cleaned.properties) {
			const cleanedProps: Record<string, JSONSchema> = {};
			const optionalFields = new Set<string>();

			for (const [key, value] of Object.entries(cleaned.properties)) {
				const processedValue = removeUnsupportedFeatures(value);
				cleanedProps[key] = processedValue;

				// Track fields that should be optional
				if (processedValue._isOptional) {
					optionalFields.add(key);
					// Remove the temporary marker
					delete processedValue._isOptional;
				}
			}
			cleaned.properties = cleanedProps;

			// Handle required array properly
			// Snowflake/OpenAI requires the `required` array to be present.
			// If no required array exists in the original schema, make all non-optional fields required.
			// This matches the working logic from the cortex-code package.
			if (!cleaned.required || cleaned.required.length === 0) {
				// If no required array exists, make all non-optional fields required
				cleaned.required = Object.keys(cleanedProps).filter(
					(key) => !optionalFields.has(key)
				);
			} else {
				// Filter required array to:
				// 1. Only include keys that exist in properties
				// 2. Exclude fields marked as optional
				cleaned.required = cleaned.required.filter(
					(key) => key in cleanedProps && !optionalFields.has(key)
				);
			}
		} else {
			// CRITICAL: Always provide required array, even if empty
			// This ensures consistency across all object schemas
			if (!cleaned.required) {
				cleaned.required = [];
			}
		}
	}

	// Handle arrays
	if (cleaned.type === 'array' && cleaned.items) {
		cleaned.items = removeUnsupportedFeatures(cleaned.items);
	}

	// Handle oneOf
	if (cleaned.oneOf) {
		cleaned.oneOf = cleaned.oneOf.map((item) =>
			removeUnsupportedFeatures(item)
		);
	}

	// Cache the result for future calls
	_schemaCache.set(schema, cleaned);

	return cleaned;
}

// ==================== Token Management ====================
// Unified token handling for both Snowflake and Cortex Code providers

/**
 * Model information from supported-models.json
 */
export interface ModelInfo {
	id: string;
	max_tokens: number;
	[key: string]: any;
}

/**
 * Get the maximum output tokens for a model from supported-models.json
 *
 * @param modelId - The model ID (e.g., "claude-haiku-4-5" or "cortex/claude-haiku-4-5")
 * @param providerPrefix - The provider prefix (e.g., "snowflake" or "cortex")
 * @param supportedModels - The models array from supported-models.json for the provider
 * @returns Maximum output tokens for the model (defaults to 8192 if not found)
 */
export function getModelMaxTokens(
	modelId: string,
	providerPrefix: string,
	supportedModels: ModelInfo[]
): number {
	// Normalize model ID - remove provider prefix if present
	const normalizedId = modelId.startsWith(`${providerPrefix}/`)
		? modelId
		: `${providerPrefix}/${modelId}`;

	// Find model in supported models
	const modelInfo = supportedModels.find((m) => m.id === normalizedId);

	// Return max_tokens or default to 8192
	return modelInfo?.max_tokens || 8192;
}

/**
 * Normalize token parameters for a request
 * Enforces minimum of 8192 tokens and caps at model maximum
 *
 * @param params - Request parameters object (will be modified in place)
 * @param modelId - The model ID
 * @param providerPrefix - The provider prefix (e.g., "snowflake" or "cortex")
 * @param supportedModels - The models array from supported-models.json for the provider
 * @returns The modified params object
 */
export function normalizeTokenParams(
	params: any,
	modelId: string,
	providerPrefix: string,
	supportedModels: ModelInfo[]
): any {
	const modelMaxTokens = getModelMaxTokens(
		modelId,
		providerPrefix,
		supportedModels
	);
	const MIN_TOKENS = 8192;

	// Set maxTokens if not present
	if (!params.maxTokens) {
		params.maxTokens = modelMaxTokens;
	} else if (params.maxTokens < MIN_TOKENS) {
		// Enforce minimum of 8192
		params.maxTokens = MIN_TOKENS;
	} else if (params.maxTokens > modelMaxTokens) {
		// Cap at model's maximum
		params.maxTokens = modelMaxTokens;
	}

	return params;
}

/**
 * Transform request body for Snowflake API
 * Handles token parameters and schema transformation
 *
 * @param body - Request body object (will be modified in place)
 * @param modelId - The normalized model ID (without snowflake/ prefix)
 * @param supportedModels - The models array from supported-models.json for snowflake provider
 * @returns Object with { modified: boolean, body: transformedBody }
 */
export function transformSnowflakeRequestBody(
	body: any,
	modelId: string,
	supportedModels: ModelInfo[]
): { modified: boolean; body: any } {
	let modified = false;

	// 1. Inject max_completion_tokens based on model from supported-models.json
	const modelMaxTokens = getModelMaxTokens(
		modelId,
		'snowflake',
		supportedModels
	);

	// Always set max_completion_tokens to the model's maximum capability
	if (!body.max_completion_tokens) {
		body.max_completion_tokens = modelMaxTokens;
		modified = true;
	} else if (body.max_completion_tokens > modelMaxTokens) {
		// Cap at model's maximum
		body.max_completion_tokens = modelMaxTokens;
		modified = true;
	}

	// Remove max_tokens if present (Snowflake uses max_completion_tokens)
	if (body.max_tokens) {
		delete body.max_tokens;
		modified = true;
	}

	// 2. Handle schema transformation for structured outputs
	if (
		body.response_format?.type === 'json_schema' &&
		body.response_format.json_schema?.schema
	) {
		const originalSchema = body.response_format.json_schema.schema;
		const cleanedSchema = removeUnsupportedFeatures(originalSchema);
		body.response_format.json_schema.schema = cleanedSchema;
		modified = true;
	}

	return { modified, body };
}

/**
 * Message type for Snowflake Cortex API
 * Supports both simple string content and content_list for prompt caching, tool calls, and tool results
 */
export interface CortexMessage {
	role: string;
	content?: string;
	content_list?: Array<{
		type: string;
		text?: string;
		cache_control?: { type: string };
		tool_use?: {
			tool_use_id: string;
			name: string;
			input: unknown;
		};
		tool_result?: {
			tool_use_id: string;
			content: string;
		};
	}>;
}

/**
 * Options for converting AI SDK prompts to Cortex messages
 */
export interface ConvertPromptOptions {
	/** Whether to enable prompt caching for Claude models */
	enableCaching?: boolean;
	/** Model ID to check if Claude model (for caching support) */
	modelId?: string;
}

/**
 * Check if a model ID represents a Claude/Anthropic model
 */
export function isClaudeModel(modelId: string | undefined): boolean {
	if (!modelId) return false;
	const lowerModelId = modelId.toLowerCase();
	return lowerModelId.includes('claude') || lowerModelId.includes('anthropic');
}

/**
 * Convert AI SDK prompt to Snowflake Cortex message format
 *
 * This is the unified prompt conversion function used by both REST API and CLI.
 *
 * Prompt Caching is enabled when:
 * - enableCaching=true AND model is Claude
 *
 * Note: Not all Claude models support prompt caching (e.g., claude-4-opus doesn't).
 * The caller should only enable caching for models known to support it.
 *
 * When caching is enabled, uses content_list format with cache_control:
 * {
 *   "role": "system",
 *   "content_list": [
 *     { "type": "text", "text": "<long system message>", "cache_control": { "type": "ephemeral" } }
 *   ]
 * }
 *
 * When caching is disabled, uses simple content format:
 * { "role": "system", "content": "<message text>" }
 *
 * @param prompt - AI SDK LanguageModelV2Prompt (array of messages)
 * @param options - Conversion options (caching, modelId)
 * @returns Array of messages in Cortex format
 */
export function convertPromptToMessages(
	prompt: Array<{ role: string; content: unknown }>,
	options: ConvertPromptOptions = {}
): CortexMessage[] {
	const { enableCaching = false, modelId } = options;
	const messages: CortexMessage[] = [];

	// Enable caching format when caching is requested AND it's a Claude model
	// Note: Not all Claude models support caching - caller must verify model support
	const useCachingFormat = enableCaching && isClaudeModel(modelId);

	const promptArray = Array.isArray(prompt) ? prompt : [prompt];

	// Debug: log the raw prompt structure
	if (process.env.DEBUG?.includes('snowflake:prompt')) {
		console.log(
			'[DEBUG snowflake:prompt] Raw prompt:',
			JSON.stringify(promptArray, null, 2)
		);
	}

	for (const msg of promptArray) {
		switch (msg.role) {
			case 'system': {
				const systemContent =
					typeof msg.content === 'string'
						? msg.content
						: JSON.stringify(msg.content);

				// For Claude models (REST with caching or CLI), use content_list with cache_control
				// See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#prompt-caching-example
				if (useCachingFormat) {
					messages.push({
						role: 'system',
						content_list: [
							{
								type: 'text',
								text: systemContent,
								cache_control: { type: 'ephemeral' }
							}
						]
					});
				} else {
					// OpenAI models: implicit caching (no special format needed)
					messages.push({ role: 'system', content: systemContent });
				}
				break;
			}

			case 'user': {
				let userContent: string;
				if (Array.isArray(msg.content)) {
					const parts = msg.content as { type: string; text?: string }[];
					const textParts = parts.filter((p) => p.type === 'text');
					userContent = textParts.map((p) => p.text).join('');
				} else {
					userContent = msg.content as string;
				}

				// For Claude models with caching, use content_list for user messages too
				if (useCachingFormat) {
					messages.push({
						role: 'user',
						content_list: [
							{
								type: 'text',
								text: userContent,
								cache_control: { type: 'ephemeral' }
							}
						]
					});
				} else {
					messages.push({ role: 'user', content: userContent });
				}
				break;
			}

			case 'assistant': {
				// Handle assistant messages - may contain text and/or tool calls
				// Cortex format: { role: 'assistant', content: '...', content_list: [{ type: 'tool_use', tool_use: {...} }] }
				if (Array.isArray(msg.content)) {
					const parts = msg.content as Array<{
						type: string;
						text?: string;
						toolCallId?: string;
						toolName?: string;
						input?: unknown; // AI SDK uses 'input' not 'args'
					}>;

					// Check if there are tool calls in the content
					const toolCalls = parts.filter((p) => p.type === 'tool-call');
					const textParts = parts.filter((p) => p.type === 'text');
					const textContent = textParts.map((p) => p.text || '').join('');

					if (toolCalls.length > 0) {
						// Format assistant message with tool calls for Cortex API
						// Cortex expects BOTH content (text) AND content_list (tool_use)
						const contentList: Array<{ type: string; tool_use: unknown }> = [];

						// Add tool calls to content_list
						for (const tc of toolCalls) {
							contentList.push({
								type: 'tool_use',
								tool_use: {
									tool_use_id: tc.toolCallId,
									name: tc.toolName,
									input: tc.input // Already an object from AI SDK
								}
							});
						}

						messages.push({
							role: 'assistant',
							content: textContent || '', // Text goes in 'content'
							content_list: contentList as CortexMessage['content_list'] // Tool calls go in 'content_list'
						});
					} else {
						// No tool calls, just text
						messages.push({ role: 'assistant', content: textContent });
					}
				} else {
					// Simple string content
					messages.push({ role: 'assistant', content: msg.content as string });
				}
				break;
			}

			case 'tool': {
				// Handle tool results from AI SDK v5
				// AI SDK sends: { type: 'tool-result', toolCallId, toolName, output: { type: 'json', value: ... } }
				// Cortex format: { role: 'user', content_list: [{ type: 'tool_results', tool_results: { tool_use_id, name, content: [{type:'text',text:'...'}] } }] }
				const toolResults = msg.content as Array<{
					type: string;
					toolCallId: string;
					toolName: string;
					output?: { type: string; value: unknown };
					result?: unknown; // Fallback for older format
				}>;

				const toolResultsContentList: Array<{
					type: string;
					tool_results: {
						tool_use_id: string;
						name: string;
						content: Array<{ type: string; text: string }>;
					};
				}> = [];

				for (const toolResult of toolResults) {
					if (toolResult.type === 'tool-result') {
						// Extract the actual result value
						let resultValue: unknown;
						if (toolResult.output?.type === 'json') {
							resultValue = toolResult.output.value;
						} else if (toolResult.output) {
							resultValue = toolResult.output;
						} else {
							resultValue = toolResult.result;
						}

						// Format tool result for Cortex API (nested structure with content array)
						toolResultsContentList.push({
							type: 'tool_results', // Note: plural 'tool_results'
							tool_results: {
								tool_use_id: toolResult.toolCallId,
								name: toolResult.toolName,
								content: [{ type: 'text', text: JSON.stringify(resultValue) }]
							}
						});
					}
				}

				if (toolResultsContentList.length > 0) {
					messages.push({
						role: 'user',
						content_list:
							toolResultsContentList as unknown as CortexMessage['content_list']
					});
				}
				break;
			}
		}
	}

	return messages;
}
