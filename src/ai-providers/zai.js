/**
 * zai.js
 * AI provider implementation for Z.ai (GLM) models.
 * Uses the OpenAI-compatible API endpoint.
 */

import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * Z.ai provider supporting GLM models through OpenAI-compatible API.
 */
export class ZAIProvider extends OpenAICompatibleProvider {
	constructor() {
		super({
			name: 'Z.ai',
			apiKeyEnvVar: 'ZAI_API_KEY',
			requiresApiKey: true,
			defaultBaseURL: 'https://api.z.ai/api/paas/v4/',
			supportsStructuredOutputs: true
		});
	}

	/**
	 * Override token parameter preparation for ZAI
	 * ZAI API doesn't support max_tokens parameter
	 * @returns {object} Empty object for ZAI (doesn't support maxOutputTokens)
	 */
	prepareTokenParam() {
		// ZAI API rejects max_tokens parameter with error code 1210
		return {};
	}

	/**
	 * Introspects a Zod schema to find the property that expects an array
	 * @param {import('zod').ZodType} schema - The Zod schema to introspect
	 * @returns {string|null} The property name that expects an array, or null if not found
	 */
	findArrayPropertyInSchema(schema) {
		try {
			// Check if schema is a ZodObject
			// Note: def is internal Zod API but necessary for schema introspection
			// Different Zod versions use different field names (type vs typeName)
			const isObject = schema?.def?.type === 'object';

			if (!isObject) {
				return null;
			}

			// Get the shape - it can be a function, property, or getter
			let shape = schema._def.shape;
			if (typeof shape === 'function') {
				shape = shape();
			}

			if (!shape || typeof shape !== 'object') {
				return null;
			}

			// Find the first property that is an array
			for (const [key, value] of Object.entries(shape)) {
				// Check if the property is a ZodArray
				// Handle both type and typeName for different Zod versions
				const isArray =
					value?._def?.type === 'array' || value?._def?.typeName === 'ZodArray';

				if (isArray) {
					return key;
				}
			}

			return null;
		} catch (error) {
			// If introspection fails, log and return null
			console.warn('Failed to introspect Zod schema:', error.message);
			return null;
		}
	}

	/**
	 * Override generateObject to normalize GLM's response format
	 * GLM sometimes returns bare arrays instead of objects with properties,
	 * even when the schema has multiple properties.
	 * @param {object} params - Parameters for object generation
	 * @returns {Promise<object>} Normalized response
	 */
	async generateObject(params) {
		const result = await super.generateObject(params);

		// If result.object is an array, wrap it based on schema introspection
		if (Array.isArray(result.object)) {
			// Try to find the array property from the schema
			const wrapperKey = this.findArrayPropertyInSchema(params.schema);

			if (wrapperKey) {
				return {
					...result,
					object: {
						[wrapperKey]: result.object
					}
				};
			}

			// Fallback: if we can't introspect the schema, use the object name
			// This handles edge cases where schema introspection might fail
			console.warn(
				`GLM returned a bare array for '${params.objectName}' but could not determine wrapper property from schema. Using objectName as fallback.`
			);

			return {
				...result,
				object: {
					[params.objectName]: result.object
				}
			};
		}

		return result;
	}
}
