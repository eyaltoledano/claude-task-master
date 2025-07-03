/**
 * src/ai-providers/gemini-cli.js
 *
 * Implementation for interacting with Gemini models via Gemini CLI
 * using the ai-sdk-provider-gemini-cli package.
 */

import { generateObject, generateText, streamText } from 'ai';
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
	 * Extracts system messages from the messages array and returns them separately.
	 * This is needed because ai-sdk-provider-gemini-cli expects system prompts as a separate parameter.
	 * @param {Array} messages - Array of message objects
	 * @param {Object} options - Options for system prompt enhancement
	 * @param {boolean} options.enforceJsonOutput - Whether to add JSON enforcement to system prompt
	 * @returns {Object} - {systemPrompt: string|undefined, messages: Array}
	 */
	_extractSystemMessage(messages, options = {}) {
		if (!messages || !Array.isArray(messages)) {
			return { systemPrompt: undefined, messages: messages || [] };
		}

		const systemMessages = messages.filter((msg) => msg.role === 'system');
		const nonSystemMessages = messages.filter((msg) => msg.role !== 'system');

		// Combine multiple system messages if present
		let systemPrompt =
			systemMessages.length > 0
				? systemMessages.map((msg) => msg.content).join('\n\n')
				: undefined;

		// Add Gemini CLI specific JSON enforcement if requested
		if (options.enforceJsonOutput) {
			const jsonEnforcement = this._getJsonEnforcementPrompt();
			systemPrompt = systemPrompt
				? `${systemPrompt}\n\n${jsonEnforcement}`
				: jsonEnforcement;
		}

		return { systemPrompt, messages: nonSystemMessages };
	}

	/**
	 * Gets a Gemini CLI specific system prompt to enforce strict JSON output
	 * @returns {string} JSON enforcement system prompt
	 */
	_getJsonEnforcementPrompt() {
		return `CRITICAL: You MUST respond with ONLY valid JSON. Do not include any explanatory text, markdown formatting, code block markers, or conversational phrases like "Here is" or "Of course". Your entire response must be parseable JSON that starts with { or [ and ends with } or ]. No exceptions.`;
	}

	/**
	 * Checks if a string is valid JSON
	 * @param {string} text - Text to validate
	 * @returns {boolean} True if valid JSON
	 */
	_isValidJson(text) {
		if (!text || typeof text !== 'string') {
			return false;
		}

		try {
			JSON.parse(text.trim());
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Detects if the user prompt is requesting JSON output
	 * @param {Array} messages - Array of message objects
	 * @returns {boolean} True if JSON output is likely expected
	 */
	_detectJsonRequest(messages) {
		const userMessages = messages.filter((msg) => msg.role === 'user');
		const combinedText = userMessages
			.map((msg) => msg.content)
			.join(' ')
			.toLowerCase();

		// Look for indicators that JSON output is expected
		const jsonIndicators = [
			'json',
			'respond only with',
			'return only',
			'output only',
			'format:',
			'structure:',
			'schema:',
			'{"',
			'[{',
			'subtasks',
			'array',
			'object'
		];

		return jsonIndicators.some((indicator) => combinedText.includes(indicator));
	}

	/**
	 * Simplifies complex prompts for gemini-cli to improve JSON output compliance
	 * @param {Array} messages - Array of message objects
	 * @returns {Array} Simplified messages array
	 */
	_simplifyJsonPrompts(messages) {
		// First, check if this is an expand-task operation by looking at the system message
		const systemMsg = messages.find((m) => m.role === 'system');
		const isExpandTask =
			systemMsg &&
			systemMsg.content.includes(
				'You are an AI assistant helping with task breakdown. Generate exactly'
			);

		if (!isExpandTask) {
			return messages; // Not an expand task, return unchanged
		}

		// Extract subtask count from system message
		const subtaskCountMatch = systemMsg.content.match(
			/Generate exactly (\d+) subtasks/
		);
		const subtaskCount = subtaskCountMatch ? subtaskCountMatch[1] : '10';

		log(
			'debug',
			`${this.name} detected expand-task operation, simplifying for ${subtaskCount} subtasks`
		);

		return messages.map((msg) => {
			if (msg.role !== 'user') {
				return msg;
			}

			// For expand-task user messages, create a much simpler, more direct prompt
			// that doesn't depend on specific task content
			const simplifiedPrompt = `Generate exactly ${subtaskCount} subtasks in the following JSON format.

CRITICAL INSTRUCTION: You must respond with ONLY valid JSON. No explanatory text, no "Here is", no "Of course", no markdown - just the JSON object.

Required JSON structure:
{
  "subtasks": [
    {
      "id": 1,
      "title": "Specific actionable task title",
      "description": "Clear task description",
      "dependencies": [],
      "details": "Implementation details and guidance",
      "testStrategy": "Testing approach"
    }
  ]
}

Generate ${subtaskCount} subtasks based on the original task context. Return ONLY the JSON object.`;

			log(
				'debug',
				`${this.name} simplified user prompt for better JSON compliance`
			);
			return { ...msg, content: simplifiedPrompt };
		});
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
	 * Generates text using Gemini CLI model
	 * Overrides base implementation to properly handle system messages and enforce JSON output when needed
	 */
	async generateText(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			log(
				'debug',
				`Generating ${this.name} text with model: ${params.modelId}`
			);

			// Detect if JSON output is expected and enforce it for better gemini-cli compatibility
			const enforceJsonOutput = this._detectJsonRequest(params.messages);

			// Debug logging to understand what's happening
			log('debug', `${this.name} JSON detection analysis:`, {
				enforceJsonOutput,
				messageCount: params.messages.length,
				messages: params.messages.map((msg) => ({
					role: msg.role,
					contentPreview: msg.content
						? msg.content.substring(0, 200) + '...'
						: 'empty'
				}))
			});

			if (enforceJsonOutput) {
				log(
					'debug',
					`${this.name} detected JSON request - applying strict JSON enforcement system prompt`
				);
			}

			// For gemini-cli, simplify complex prompts before processing
			let processedMessages = params.messages;
			if (enforceJsonOutput) {
				processedMessages = this._simplifyJsonPrompts(params.messages);
			}

			// Extract system messages for separate handling with optional JSON enforcement
			const { systemPrompt, messages } = this._extractSystemMessage(
				processedMessages,
				{ enforceJsonOutput }
			);

			// Debug the final system prompt being sent
			log('debug', `${this.name} final system prompt:`, {
				systemPromptLength: systemPrompt ? systemPrompt.length : 0,
				systemPromptPreview: systemPrompt
					? systemPrompt.substring(0, 300) + '...'
					: 'none',
				finalMessageCount: messages.length
			});

			const client = await this.getClient(params);
			const result = await generateText({
				model: client(params.modelId),
				system: systemPrompt,
				messages: messages,
				maxTokens: params.maxTokens,
				temperature: params.temperature
			});

			// If we detected a JSON request and gemini-cli returned conversational text,
			// attempt to extract JSON from the response
			let finalText = result.text;
			if (enforceJsonOutput && result.text && !this._isValidJson(result.text)) {
				log(
					'debug',
					`${this.name} response appears conversational, attempting JSON extraction`
				);

				// Log first 1000 chars of the response to see what Gemini actually returned
				log('debug', `${this.name} raw response preview:`, {
					responseLength: result.text.length,
					responseStart: result.text.substring(0, 1000)
				});

				const extractedJson = this.extractJson(result.text);
				if (this._isValidJson(extractedJson)) {
					log(
						'debug',
						`${this.name} successfully extracted JSON from conversational response`
					);
					finalText = extractedJson;
				} else {
					log(
						'debug',
						`${this.name} JSON extraction failed, returning original response`
					);

					// Log what extraction returned to debug why it failed
					log('debug', `${this.name} extraction result preview:`, {
						extractedLength: extractedJson ? extractedJson.length : 0,
						extractedStart: extractedJson
							? extractedJson.substring(0, 500)
							: 'null'
					});
				}
			}

			log(
				'debug',
				`${this.name} generateText completed successfully for model: ${params.modelId}`
			);

			return {
				text: finalText,
				usage: {
					inputTokens: result.usage?.promptTokens,
					outputTokens: result.usage?.completionTokens,
					totalTokens: result.usage?.totalTokens
				}
			};
		} catch (error) {
			this.handleError('text generation', error);
		}
	}

	/**
	 * Streams text using Gemini CLI model
	 * Overrides base implementation to properly handle system messages and enforce JSON output when needed
	 */
	async streamText(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			log('debug', `Streaming ${this.name} text with model: ${params.modelId}`);

			// Detect if JSON output is expected and enforce it for better gemini-cli compatibility
			const enforceJsonOutput = this._detectJsonRequest(params.messages);

			// Debug logging to understand what's happening
			log('debug', `${this.name} JSON detection analysis:`, {
				enforceJsonOutput,
				messageCount: params.messages.length,
				messages: params.messages.map((msg) => ({
					role: msg.role,
					contentPreview: msg.content
						? msg.content.substring(0, 200) + '...'
						: 'empty'
				}))
			});

			if (enforceJsonOutput) {
				log(
					'debug',
					`${this.name} detected JSON request - applying strict JSON enforcement system prompt`
				);
			}

			// Extract system messages for separate handling with optional JSON enforcement
			const { systemPrompt, messages } = this._extractSystemMessage(
				params.messages,
				{ enforceJsonOutput }
			);

			const client = await this.getClient(params);
			const stream = await streamText({
				model: client(params.modelId),
				system: systemPrompt,
				messages: messages,
				maxTokens: params.maxTokens,
				temperature: params.temperature
			});

			log(
				'debug',
				`${this.name} streamText initiated successfully for model: ${params.modelId}`
			);

			// Note: For streaming, we can't intercept and modify the response in real-time
			// The JSON extraction would need to happen on the consuming side
			return stream;
		} catch (error) {
			this.handleError('text streaming', error);
		}
	}

	/**
	 * Generates a structured object using Gemini CLI model
	 * Overrides base implementation to handle Gemini-specific JSON formatting issues and system messages
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

					// Extract system messages for separate handling with JSON enforcement
					const { systemPrompt, messages } = this._extractSystemMessage(
						params.messages,
						{ enforceJsonOutput: true }
					);

					// Call generateObject directly with our client
					const client = await this.getClient(params);
					const result = await generateObject({
						model: client(params.modelId),
						system: systemPrompt,
						messages: messages,
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
