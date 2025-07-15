/**
 * src/ai-providers/gemini-cli-simplified.js
 *
 * Simplified implementation for interacting with Gemini models via Gemini CLI
 * using the ai-sdk-provider-gemini-cli package.
 */

import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';
import { log } from '../../scripts/modules/utils.js';
import { BaseAIProvider } from './base-provider.js';

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
		// Gemini CLI supports OAuth authentication without API key
		// No validation needed - the SDK will handle auth internally
	}

	/**
	 * Creates and returns a Gemini CLI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.apiKey] - Optional Gemini API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} Gemini CLI client function
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
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
				// Expected case: Use gemini CLI authentication via OAuth
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

	getRequiredApiKeyName() {
		return 'GEMINI_API_KEY';
	}

	isRequiredApiKey() {
		return false;
	}

	/**
	 * Override generateText to redirect JSON requests to generateObject
	 * This ensures Gemini CLI always returns structured JSON when requested
	 */
	async generateText(params) {
		// Check if this is a JSON request
		const messages = params.messages || [];
		const combinedContent = messages.map((msg) => msg.content || '').join(' ');

		log(
			'debug',
			`${this.name} generateText called, checking for JSON patterns`
		);
		log('debug', `Combined content length: ${combinedContent.length}`);

		const isJsonRequest =
			combinedContent.includes('Respond ONLY with valid JSON') ||
			combinedContent.includes('Respond ONLY with a valid JSON') ||
			combinedContent.includes('Return ONLY the JSON object') ||
			combinedContent.includes('Do not include any explanatory text');

		log('debug', `${this.name} isJsonRequest: ${isJsonRequest}`);

		if (isJsonRequest) {
			log(
				'debug',
				`${this.name} detected JSON request, redirecting to generateObject`
			);

			// Detect the expected structure from the prompt
			let schema;
			const { z } = await import('zod');

			if (
				combinedContent.includes('complexityScore') &&
				combinedContent.includes('taskId')
			) {
				// This is an analyze-complexity request
				// When using the object-wrapper variant, we expect an object with analysis property
				// When using the default variant (for compatibility), we wrap in an object
				const isObjectWrapper = combinedContent.includes(
					'Respond ONLY with a valid JSON object'
				);

				if (isObjectWrapper) {
					// Object-wrapper variant is being used, expect the proper format
					schema = z.object({
						analysis: z.array(
							z.object({
								taskId: z.number(),
								taskTitle: z.string(),
								complexityScore: z.number().min(1).max(10),
								recommendedSubtasks: z.number(),
								expansionPrompt: z.string(),
								reasoning: z.string()
							})
						)
					});
					log(
						'debug',
						`${this.name} using wrapped complexity analysis schema (object-wrapper variant)`
					);
				} else {
					// Default variant - just expect an array
					schema = z.array(
						z.object({
							taskId: z.number(),
							taskTitle: z.string(),
							complexityScore: z.number().min(1).max(10),
							recommendedSubtasks: z.number(),
							expansionPrompt: z.string(),
							reasoning: z.string()
						})
					);
					log(
						'debug',
						`${this.name} using direct array schema (default variant)`
					);
				}
			} else if (
				combinedContent.includes('"subtasks"') &&
				combinedContent.includes('subtask')
			) {
				// This is an expand-task request
				schema = z.object({
					subtasks: z.array(
						z.object({
							id: z.number(),
							title: z.string(),
							description: z.string(),
							dependencies: z.array(z.number()),
							details: z.string(),
							testStrategy: z.string().optional(),
							status: z.string().optional()
						})
					)
				});
				log('debug', `${this.name} using subtasks schema`);
			} else if (
				combinedContent.includes('Return only the updated tasks') ||
				combinedContent.includes(
					'valid JSON array. Preserve all original task fields'
				)
			) {
				// This is an update-tasks request
				const isObjectWrapper = combinedContent.includes(
					'valid JSON object with a single key "tasks"'
				);

				if (isObjectWrapper) {
					// Object-wrapper variant
					schema = z.object({
						tasks: z.array(
							z.object({
								id: z.number(),
								title: z.string(),
								description: z.string(),
								details: z.string(),
								status: z.string(),
								dependencies: z.array(z.number()).optional(),
								testStrategy: z.string().optional(),
								priority: z.string().optional(),
								subtasks: z.array(z.any()).optional()
							})
						)
					});
					log(
						'debug',
						`${this.name} using wrapped tasks array schema (object-wrapper variant)`
					);
				} else {
					// Default variant - just an array
					schema = z.array(
						z.object({
							id: z.number(),
							title: z.string(),
							description: z.string(),
							details: z.string(),
							status: z.string(),
							dependencies: z.array(z.number()).optional(),
							testStrategy: z.string().optional(),
							priority: z.string().optional(),
							subtasks: z.array(z.any()).optional()
						})
					);
					log(
						'debug',
						`${this.name} using direct tasks array schema (default variant)`
					);
				}
			} else {
				// For other JSON requests, use a generic schema
				schema = z.record(z.unknown());
				log('debug', `${this.name} using generic object schema`);
			}

			try {
				const result = await this.generateObject({
					...params,
					schema,
					objectName: 'response'
				});

				// Return as text format
				// No unwrapping needed - analyze-task-complexity.js handles extraction
				return {
					text: JSON.stringify(result.object, null, 2),
					usage: result.usage
				};
			} catch (error) {
				log('error', `${this.name} generateObject failed: ${error.message}`);

				// Fall back to regular generateText if generateObject fails
				log('warn', `${this.name} falling back to regular generateText`);
				return super.generateText(params);
			}
		}

		// For non-JSON requests, use normal generateText
		return super.generateText(params);
	}
}
