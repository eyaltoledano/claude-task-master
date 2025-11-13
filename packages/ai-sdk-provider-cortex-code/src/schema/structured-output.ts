/**
 * Unified Structured Output Generator for Cortex Code CLI
 * 
 * This module provides utilities for generating structured JSON outputs using
 * prompt engineering and JSON extraction when native structured output support
 * is not available or reliable.
 * 
 * Combines functionality from:
 * - Prompt engineering and message preparation
 * - JSON extraction and parsing
 * - Complete object generation orchestration
 */

import { removeUnsupportedFeatures, type JSONSchema } from './transformer.js';
import { ModelHelpers } from '../utils/model-helpers.js';

/**
 * Message format for structured output
 */
export interface StructuredOutputMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * Parameters for structured output generation
 */
export interface StructuredOutputParams {
	/** The schema to enforce */
	schema: JSONSchema;
	/** Name of the object being generated */
	objectName: string;
	/** Original messages from the user */
	messages: StructuredOutputMessage[];
	/** Maximum tokens for the response */
	maxTokens?: number;
}

/**
 * Text generation function type that the helper expects
 */
export type GenerateTextFunction = (params: {
	messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
	maxTokens?: number;
}) => Promise<{
	text: string;
	finishReason?: string;
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
	};
	warnings?: string[];
}>;

/**
 * Parameters for structured object generation
 */
export interface GenerateObjectParams {
	/** Function to generate text (typically from the provider's generateText method) */
	generateText: GenerateTextFunction;
	/** The JSON schema to enforce */
	schema: JSONSchema;
	/** Name of the object being generated */
	objectName: string;
	/** Messages array with role and content */
	messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
	/** Optional: Maximum tokens for the response */
	maxTokens?: number;
	/** Optional: Model ID for warning checks */
	modelId?: string;
	/** Optional: Callback for warnings */
	onWarning?: (warning: string) => void;
}

/**
 * Result from structured object generation
 */
export interface GenerateObjectResult {
	/** The parsed JSON object */
	object: any;
	/** Finish reason */
	finishReason: string;
	/** Token usage information */
	usage: {
		promptTokens: number;
		completionTokens: number;
	};
	/** Any warnings generated */
	warnings?: string[];
}

/**
 * Unified Structured Output Generator
 * Provides methods for prompt engineering, JSON extraction, and complete object generation
 */
export class StructuredOutputGenerator {
	// ==================== Prompt Engineering ====================

	/**
	 * Build system prompt for structured output generation
	 * 
	 * @param schema - The JSON schema to enforce
	 * @param objectName - Name of the object being generated
	 * @returns System prompt string
	 */
	static buildSystemPrompt(schema: JSONSchema, objectName: string): string {
		const schemaPrompt = JSON.stringify(schema, null, 2);

		return `You must respond with ONLY a valid JSON object that conforms to this schema. 

CRITICAL: Return ONLY the JSON object itself - no code blocks, no variable declarations, no markdown, no explanations.

Schema for ${objectName}:
${schemaPrompt}

Example correct response format:
{"key": "value", "number": 123}

DO NOT wrap in markdown code blocks.
DO NOT use const/let/var declarations.
DO NOT add semicolons.
Just return the raw JSON object.`;
	}

	/**
	 * Prepare messages for structured output generation
	 * Cleans the schema and adds system prompt
	 * 
	 * @param params - Structured output parameters
	 * @returns Modified messages array with system prompt
	 */
	static prepareMessages(
		params: StructuredOutputParams
	): StructuredOutputMessage[] {
		// Clean the schema
		const cleanedSchema = removeUnsupportedFeatures(params.schema);

		// Create schema prompt
		const systemPrompt = this.buildSystemPrompt(
			cleanedSchema,
			params.objectName
		);

		// Add system message to the start of messages array
		return [{ role: 'system', content: systemPrompt }, ...params.messages];
	}

	// ==================== JSON Extraction ====================

	/**
	 * Extract the first complete JSON object from text
	 * Handles nested braces and string escaping
	 * 
	 * @param text - Text potentially containing JSON
	 * @returns Extracted JSON string or null if not found
	 */
	static extractFirstJsonObject(text: string): string | null {
		// Find the first opening brace
		const startIndex = text.indexOf('{');
		if (startIndex === -1) return null;

		// Count braces to find the matching closing brace
		let braceCount = 0;
		let inString = false;
		let escapeNext = false;

		for (let i = startIndex; i < text.length; i++) {
			const char = text[i];

			if (escapeNext) {
				escapeNext = false;
				continue;
			}

			if (char === '\\') {
				escapeNext = true;
				continue;
			}

			if (char === '"') {
				inString = !inString;
				continue;
			}

			if (inString) continue;

			if (char === '{') braceCount++;
			if (char === '}') {
				braceCount--;
				if (braceCount === 0) {
					// Found the matching closing brace
					return text.substring(startIndex, i + 1);
				}
			}
		}

		return null;
	}

	/**
	 * Parse JSON with fallback for JavaScript object syntax
	 * Attempts to fix common issues like unquoted property names
	 * 
	 * @param jsonText - Text to parse as JSON
	 * @returns Parsed object
	 * @throws Error if parsing fails
	 */
	static parseWithFallback(jsonText: string): any {
		try {
			return JSON.parse(jsonText);
		} catch (parseError) {
			// Try to fix common JavaScript object syntax issues
			// Convert unquoted property names to quoted ones
			try {
				const fixedJson = jsonText.replace(/(\w+):/g, '"$1":');
				return JSON.parse(fixedJson);
			} catch (secondError) {
				throw new Error(
					`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}.\n` +
						`Tried to fix JavaScript object syntax but still failed.\n` +
						`Text (first 300 chars): ${jsonText ? jsonText.substring(0, 300) : 'null'}`
				);
			}
		}
	}

	/**
	 * Extract and parse JSON object from model response text
	 * Handles various formats including markdown code blocks and JavaScript syntax
	 * 
	 * @param responseText - Raw response text from the model
	 * @returns Parsed JSON object
	 * @throws Error if no valid JSON can be extracted
	 */
	static extractAndParse(responseText: string): any {
		const trimmed = responseText.trim();

		// Try to extract JSON from the response
		let jsonText = this.extractFirstJsonObject(trimmed);

		if (!jsonText) {
			// Fallback: try to find JSON in markdown code blocks
			const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
			if (codeBlockMatch) {
				jsonText = this.extractFirstJsonObject(codeBlockMatch[1]);
			}
		}

		// If we still don't have JSON text, throw an error
		if (!jsonText) {
			throw new Error(
				`Could not extract JSON object from response.\n` +
					`Response (first 500 chars): ${trimmed.substring(0, 500)}`
			);
		}

		// Parse the JSON with fallback
		return this.parseWithFallback(jsonText);
	}

	// ==================== Complete Generation ====================

	/**
	 * Generate a structured object using prompt engineering
	 * 
	 * This function implements structured output generation for models that don't
	 * have native support. It uses prompt engineering to enforce the schema and
	 * extracts the JSON object from the model's response.
	 * 
	 * @param params - Generation parameters
	 * @returns Parsed object with metadata
	 * @throws Error if schema/objectName is missing or JSON parsing fails
	 * 
	 * @example
	 * ```typescript
	 * import { StructuredOutputGenerator } from '@tm/ai-sdk-provider-cortex-code';
	 * 
	 * const result = await StructuredOutputGenerator.generateObject({
	 *   generateText: async (params) => {
	 *     // Your text generation logic
	 *     return { text: '...', finishReason: 'stop', usage: {...} };
	 *   },
	 *   schema: {
	 *     type: 'object',
	 *     properties: {
	 *       name: { type: 'string' },
	 *       age: { type: 'number' }
	 *     }
	 *   },
	 *   objectName: 'Person',
	 *   messages: [{ role: 'user', content: 'Generate a person' }]
	 * });
	 * 
	 * console.log(result.object); // { name: "John", age: 30 }
	 * ```
	 */
	static async generateObject(
		params: GenerateObjectParams
	): Promise<GenerateObjectResult> {
		// Validate required parameters
		if (!params.schema) {
			throw new Error('Schema is required for object generation');
		}
		if (!params.objectName) {
			throw new Error('Object name is required for object generation');
		}
		if (!params.generateText) {
			throw new Error('generateText function is required');
		}

		// Warn if model doesn't support structured outputs
		if (params.modelId) {
			const normalizedModelId = ModelHelpers.normalizeModelId(params.modelId);
			if (!ModelHelpers.supportsStructuredOutputs(normalizedModelId)) {
				const warning =
					ModelHelpers.getUnsupportedStructuredOutputsWarning(normalizedModelId);
				if (params.onWarning) {
					params.onWarning(warning);
				}
			}
		}

		// Prepare messages with schema instructions
		const messagesWithSchema = this.prepareMessages({
			schema: params.schema,
			objectName: params.objectName,
			messages: params.messages,
			maxTokens: params.maxTokens || 2048
		});

		// Generate text with schema instructions using provided function
		const textResult = await params.generateText({
			messages: messagesWithSchema,
			maxTokens: params.maxTokens || 2048
		});

		// Extract and parse JSON from response
		const parsedObject = this.extractAndParse(textResult.text);

		// Return formatted result
		return {
			object: parsedObject,
			finishReason: textResult.finishReason || 'stop',
			usage: {
				promptTokens: textResult.usage?.promptTokens || 0,
				completionTokens: textResult.usage?.completionTokens || 0
			},
			warnings: textResult.warnings
		};
	}
}

