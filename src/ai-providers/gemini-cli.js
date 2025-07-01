/**
 * src/ai-providers/gemini-cli.js
 *
 * Implementation for interacting with Gemini models via Gemini CLI
 * using the ai-sdk-provider-gemini-cli package.
 */

import { generateObject } from 'ai';
import { parse } from 'jsonc-parser';
import { BaseAIProvider } from './base-provider.js';
import { log } from '../../scripts/modules/index.js';

let createGeminiProvider;

async function loadGeminiCliModule() {
	if (!createGeminiProvider) {
		try {
			const mod = await import('ai-sdk-provider-gemini-cli');
			createGeminiProvider = mod.createGeminiProvider;
		} catch (err) {
			throw new Error(
				"Gemini CLI SDK is not installed. Please install 'ai-sdk-provider-gemini-cli' to use the gemini-cli provider."
			);
		}
	}
}

export class GeminiCliProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Gemini CLI';
	}

	/**
	 * Override validateAuth to handle Gemini CLI authentication options
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Gemini CLI is designed to use pre-configured OAuth authentication
		// Users choose gemini-cli specifically to leverage their existing
		// gemini auth login credentials, not to use API keys.
		// We support API keys for compatibility, but the expected usage
		// is through CLI authentication (no API key required).
		// No validation needed - the SDK will handle auth internally
	}

	/**
	 * Creates and returns a Gemini CLI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.apiKey] - Optional Gemini API key (rarely used with gemini-cli)
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Promise<Function>} Gemini CLI client function
	 * @throws {Error} If initialization fails
	 */
	async getClient(params) {
		try {
			// Load the Gemini CLI module dynamically
			await loadGeminiCliModule();
			// Primary use case: Use existing gemini CLI authentication
			// Secondary use case: Direct API key (for compatibility)
			let authOptions = {};

			if (params.apiKey && params.apiKey !== 'gemini-cli-no-key-required') {
				// API key provided - use it for compatibility
				authOptions = {
					authType: 'api-key',
					apiKey: params.apiKey
				};
			} else {
				// Expected case: Use gemini CLI authentication
				// Requires: gemini auth login (pre-configured)
				authOptions = {
					authType: 'oauth-personal'
				};
			}

			// Add baseURL if provided (for custom endpoints)
			if (params.baseURL) {
				authOptions.baseURL = params.baseURL;
			}

			// Create and return the provider
			return createGeminiProvider(authOptions);
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}

	/**
	 * Extract JSON from Gemini's response using a tolerant parser.
	 *
	 * Optimized approach that progressively tries different parsing strategies:
	 * 1. Direct parsing after cleanup
	 * 2. Smart boundary detection with single-pass analysis
	 * 3. Limited character-by-character fallback for edge cases
	 *
	 * @param {string} text - Raw text which may contain JSON
	 * @returns {string} A valid JSON string if extraction succeeds, otherwise the original text
	 */
	extractJson(text) {
		if (!text || typeof text !== 'string') {
			return text;
		}

		let content = text.trim();

		// Early exit for very short content
		if (content.length < 2) {
			return text;
		}

		// Strip common wrappers in a single pass
		content = content
			// Remove markdown fences
			.replace(/^.*?```(?:json)?\s*([\s\S]*?)\s*```.*$/i, '$1')
			// Remove variable declarations
			.replace(/^\s*(?:const|let|var)\s+\w+\s*=\s*([\s\S]*?)(?:;|\s*)$/i, '$1')
			// Remove common prefixes
			.replace(/^(?:Here's|The)\s+(?:the\s+)?JSON.*?[:]\s*/i, '')
			.trim();

		// Find the first JSON-like structure
		const firstObj = content.indexOf('{');
		const firstArr = content.indexOf('[');

		if (firstObj === -1 && firstArr === -1) {
			return text;
		}

		const start =
			firstArr === -1
				? firstObj
				: firstObj === -1
					? firstArr
					: Math.min(firstObj, firstArr);
		content = content.slice(start);

		// Optimized parsing function with error collection
		const tryParse = (value) => {
			if (!value || value.length < 2) return undefined;

			const errors = [];
			try {
				const result = parse(value, errors, {
					allowTrailingComma: true,
					allowEmptyContent: false
				});
				if (errors.length === 0 && result !== undefined) {
					return JSON.stringify(result, null, 2);
				}
			} catch {
				// Parsing failed completely
			}
			return undefined;
		};

		// Try parsing the full content first
		const fullParse = tryParse(content);
		if (fullParse !== undefined) {
			return fullParse;
		}

		// Smart boundary detection - single pass with optimizations
		const openChar = content[0];
		const closeChar = openChar === '{' ? '}' : ']';

		let depth = 0;
		let inString = false;
		let escapeNext = false;
		let lastValidEnd = -1;

		// Single-pass boundary detection with early termination
		for (let i = 0; i < content.length && i < 10000; i++) {
			// Limit scan for performance
			const char = content[i];

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

			if (char === openChar) {
				depth++;
			} else if (char === closeChar) {
				depth--;
				if (depth === 0) {
					lastValidEnd = i + 1;
					// Try parsing immediately on first valid boundary
					const candidate = content.slice(0, lastValidEnd);
					const parsed = tryParse(candidate);
					if (parsed !== undefined) {
						return parsed;
					}
				}
			}
		}

		// If we found valid boundaries but parsing failed, try limited fallback
		if (lastValidEnd > 0) {
			const maxAttempts = Math.min(5, Math.floor(lastValidEnd / 100)); // Limit attempts
			for (let i = 0; i < maxAttempts; i++) {
				const testEnd = Math.max(
					lastValidEnd - i * 50,
					Math.floor(lastValidEnd * 0.8)
				);
				const candidate = content.slice(0, testEnd);
				const parsed = tryParse(candidate);
				if (parsed !== undefined) {
					return parsed;
				}
			}
		}

		return text;
	}

	/**
	 * Generates a structured object using Gemini CLI model
	 * Overrides base implementation to handle Gemini-specific JSON formatting issues
	 */
	async generateObject(params) {
		try {
			// First try the standard generateObject from base class
			return await super.generateObject(params);
		} catch (error) {
			// If it's a JSON parsing error, try to extract and parse JSON manually
			if (error.message?.includes('JSON') || error.message?.includes('parse')) {
				log(
					'debug',
					`Gemini CLI generateObject failed with parsing error, attempting manual extraction`
				);

				try {
					// Validate params first
					this.validateParams(params);
					this.validateMessages(params.messages);

					if (!params.schema) {
						throw new Error('Schema is required for object generation');
					}
					if (!params.objectName) {
						throw new Error('Object name is required for object generation');
					}

					// Call generateObject directly with our client
					const client = await this.getClient(params);
					const result = await generateObject({
						model: client(params.modelId),
						messages: params.messages,
						schema: params.schema,
						mode: 'json', // Use json mode instead of auto for Gemini
						maxTokens: params.maxTokens,
						temperature: params.temperature
					});

					// If we get rawResponse text, try to extract JSON from it
					if (result.rawResponse?.text && !result.object) {
						const extractedJson = this.extractJson(result.rawResponse.text);
						try {
							result.object = JSON.parse(extractedJson);
						} catch (parseError) {
							log(
								'error',
								`Failed to parse extracted JSON: ${parseError.message}`
							);
							log(
								'debug',
								`Extracted JSON: ${extractedJson.substring(0, 500)}...`
							);
							throw new Error(
								`Gemini CLI returned invalid JSON that could not be parsed: ${parseError.message}`
							);
						}
					}

					return {
						object: result.object,
						usage: {
							inputTokens: result.usage?.promptTokens,
							outputTokens: result.usage?.completionTokens,
							totalTokens: result.usage?.totalTokens
						}
					};
				} catch (retryError) {
					log(
						'error',
						`Gemini CLI manual JSON extraction failed: ${retryError.message}`
					);
					// Re-throw the original error with more context
					throw new Error(
						`${this.name} failed to generate valid JSON object: ${error.message}`
					);
				}
			}

			// For non-parsing errors, just re-throw
			throw error;
		}
	}
}
