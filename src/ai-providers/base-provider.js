import {
	generateObject,
	generateText,
	streamText,
	zodSchema,
	JSONParseError,
	NoObjectGeneratedError
} from 'ai';
import { jsonrepair } from 'jsonrepair';
import { log } from '../../scripts/modules/utils.js';

/**
 * Base class for all AI providers
 */
export class BaseAIProvider {
	constructor() {
		if (this.constructor === BaseAIProvider) {
			throw new Error('BaseAIProvider cannot be instantiated directly');
		}

		// Each provider must set their name
		this.name = this.constructor.name;
	}

	/**
	 * Validates authentication parameters - can be overridden by providers
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Default: require API key (most providers need this)
		if (!params.apiKey) {
			throw new Error(`${this.name} API key is required`);
		}
	}

	/**
	 * Validates common parameters across all methods
	 * @param {object} params - Parameters to validate
	 */
	validateParams(params) {
		// Validate authentication (can be overridden by providers)
		this.validateAuth(params);

		// Validate required model ID
		if (!params.modelId) {
			throw new Error(`${this.name} Model ID is required`);
		}

		// Validate optional parameters
		this.validateOptionalParams(params);
	}

	/**
	 * Validates optional parameters like temperature and maxTokens
	 * @param {object} params - Parameters to validate
	 */
	validateOptionalParams(params) {
		if (
			params.temperature !== undefined &&
			(params.temperature < 0 || params.temperature > 1)
		) {
			throw new Error('Temperature must be between 0 and 1');
		}
		if (params.maxTokens !== undefined) {
			const maxTokens = Number(params.maxTokens);
			if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
				throw new Error('maxTokens must be a finite number greater than 0');
			}
		}
	}

	/**
	 * Validates message array structure
	 */
	validateMessages(messages) {
		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			throw new Error('Invalid or empty messages array provided');
		}

		for (const msg of messages) {
			if (!msg.role || !msg.content) {
				throw new Error(
					'Invalid message format. Each message must have role and content'
				);
			}
		}
	}

	/**
	 * Common error handler
	 */
	handleError(operation, error) {
		const errorMessage = error.message || 'Unknown error occurred';
		log('error', `${this.name} ${operation} failed: ${errorMessage}`, {
			error
		});
		throw new Error(
			`${this.name} API error during ${operation}: ${errorMessage}`
		);
	}

	/**
	 * Creates and returns a client instance for the provider
	 * @abstract
	 */
	getClient(params) {
		throw new Error('getClient must be implemented by provider');
	}

	/**
	 * Returns if the API key is required
	 * @abstract
	 * @returns {boolean} if the API key is required, defaults to true
	 */
	isRequiredApiKey() {
		return true;
	}

	/**
	 * Returns the required API key environment variable name
	 * @abstract
	 * @returns {string|null} The environment variable name, or null if no API key is required
	 */
	getRequiredApiKeyName() {
		throw new Error('getRequiredApiKeyName must be implemented by provider');
	}

	/**
	 * Determines if a model requires max_completion_tokens instead of maxTokens
	 * Can be overridden by providers to specify their model requirements
	 * @param {string} modelId - The model ID to check
	 * @returns {boolean} True if the model requires max_completion_tokens
	 */
	requiresMaxCompletionTokens(modelId) {
		return false; // Default behavior - most models use maxTokens
	}

	/**
	 * Prepares token limit parameter based on model requirements
	 * @param {string} modelId - The model ID
	 * @param {number} maxTokens - The maximum tokens value
	 * @returns {object} Object with either maxTokens or max_completion_tokens
	 */
	prepareTokenParam(modelId, maxTokens) {
		if (maxTokens === undefined) {
			return {};
		}

		// Ensure maxTokens is an integer
		const tokenValue = Math.floor(Number(maxTokens));

		if (this.requiresMaxCompletionTokens(modelId)) {
			return { max_completion_tokens: tokenValue };
		} else {
			return { maxTokens: tokenValue };
		}
	}

	/**
	 * Generates text using the provider's model
	 */
	async generateText(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			log(
				'debug',
				`Generating ${this.name} text with model: ${params.modelId}`
			);

			const client = await this.getClient(params);
			const result = await generateText({
				model: client(params.modelId),
				messages: params.messages,
				...this.prepareTokenParam(params.modelId, params.maxTokens),
				temperature: params.temperature
			});

			log(
				'debug',
				`${this.name} generateText completed successfully for model: ${params.modelId}`
			);

			return {
				text: result.text,
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
	 * Streams text using the provider's model
	 */
	async streamText(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			log('debug', `Streaming ${this.name} text with model: ${params.modelId}`);

			const client = await this.getClient(params);
			const stream = await streamText({
				model: client(params.modelId),
				messages: params.messages,
				...this.prepareTokenParam(params.modelId, params.maxTokens),
				temperature: params.temperature
			});

			log(
				'debug',
				`${this.name} streamText initiated successfully for model: ${params.modelId}`
			);

			return stream;
		} catch (error) {
			this.handleError('text streaming', error);
		}
	}

	/**
	 * Generates a structured object using the provider's model
	 */
	async generateObject(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			if (!params.schema) {
				throw new Error('Schema is required for object generation');
			}
			if (!params.objectName) {
				throw new Error('Object name is required for object generation');
			}

			log(
				'debug',
				`Generating ${this.name} object ('${params.objectName}') with model: ${params.modelId}`
			);

			const client = await this.getClient(params);
			const result = await generateObject({
				model: client(params.modelId),
				messages: params.messages,
				schema: zodSchema(params.schema),
				mode: params.mode || 'auto',
				...this.prepareTokenParam(params.modelId, params.maxTokens),
				temperature: params.temperature
			});

			log(
				'debug',
				`${this.name} generateObject completed successfully for model: ${params.modelId}`
			);

			return {
				object: result.object,
				usage: {
					inputTokens: result.usage?.promptTokens,
					outputTokens: result.usage?.completionTokens,
					totalTokens: result.usage?.totalTokens
				}
			};
		} catch (error) {
			// Check if this is a JSON parsing error that we can potentially fix
			if (
				NoObjectGeneratedError.isInstance(error) &&
				JSONParseError.isInstance(error.cause) &&
				error.cause.text
			) {
				log(
					'warn',
					`${this.name} generated malformed JSON, attempting to repair...`
				);

				try {
					// Use jsonrepair to fix the malformed JSON
					const repairedJson = jsonrepair(error.cause.text);
					const parsed = JSON.parse(repairedJson);

					log('info', `Successfully repaired ${this.name} JSON output`);

					// Return in the expected format
					return {
						object: parsed,
						usage: {
							// Extract usage information from the error if available
							inputTokens: error.usage?.promptTokens || 0,
							outputTokens: error.usage?.completionTokens || 0,
							totalTokens: error.usage?.totalTokens || 0
						}
					};
				} catch (repairError) {
					log(
						'error',
						`Failed to repair ${this.name} JSON: ${repairError.message}`
					);
					// Fall through to handleError with original error
				}
			}

			this.handleError('object generation', error);
		}
	}
}
