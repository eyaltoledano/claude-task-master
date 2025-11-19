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
	if (schema.minProperties !== undefined || schema.maxProperties !== undefined) {
		if (schema.minProperties !== undefined && schema.maxProperties !== undefined) {
			constraints.push(`${schema.minProperties}-${schema.maxProperties} properties`);
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
			cleaned.anyOf = nonNullTypes.map((item) => removeUnsupportedFeatures(item));
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
		cleaned.oneOf = cleaned.oneOf.map((item) => removeUnsupportedFeatures(item));
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
	const modelMaxTokens = getModelMaxTokens(modelId, providerPrefix, supportedModels);
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
	const modelMaxTokens = getModelMaxTokens(modelId, 'snowflake', supportedModels);

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
	if (body.response_format?.type === 'json_schema' && body.response_format.json_schema?.schema) {
		const originalSchema = body.response_format.json_schema.schema;
		const cleanedSchema = removeUnsupportedFeatures(originalSchema);
		body.response_format.json_schema.schema = cleanedSchema;
		modified = true;
	}

	return { modified, body };
}

