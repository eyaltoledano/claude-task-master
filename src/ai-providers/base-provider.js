import {
	generateObject,
	generateText,
	streamText,
	streamObject,
	zodSchema,
	JSONParseError,
	NoObjectGeneratedError
} from 'ai';
import { jsonrepair } from 'jsonrepair';
import { log, findProjectRoot } from '../../scripts/modules/utils.js';
import { isProxyEnabled } from '../../scripts/modules/config-manager.js';
import { EnvHttpProxyAgent } from 'undici';

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

		// Cache proxy agent to avoid creating multiple instances
		this._proxyAgent = null;

		/**
		 * Whether this provider needs explicit schema in JSON mode
		 * Can be overridden by subclasses
		 * @type {boolean}
		 */
		this.needsExplicitJsonSchema = false;

		/**
		 * Whether this provider supports temperature parameter
		 * Can be overridden by subclasses
		 * @type {boolean}
		 */
		this.supportsTemperature = true;
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
	 * Creates a custom fetch function with proxy support.
	 * Only enables proxy when TASKMASTER_ENABLE_PROXY environment variable is set to 'true'
	 * or enableProxy is set to true in config.json.
	 * Automatically reads http_proxy/https_proxy environment variables when enabled.
	 * @returns {Function} Custom fetch function with proxy support, or undefined if proxy is disabled
	 */
	createProxyFetch() {
		// Cache project root to avoid repeated lookups
		if (!this._projectRoot) {
			this._projectRoot = findProjectRoot();
		}
		const projectRoot = this._projectRoot;

		if (!isProxyEnabled(null, projectRoot)) {
			// Return undefined to use default fetch without proxy
			return undefined;
		}

		// Proxy is enabled, create and return proxy fetch
		if (!this._proxyAgent) {
			this._proxyAgent = new EnvHttpProxyAgent();
		}
		return (url, options = {}) => {
			return fetch(url, {
				...options,
				dispatcher: this._proxyAgent
			});
		};
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

		return { maxOutputTokens: tokenValue };
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
				...(this.supportsTemperature && params.temperature !== undefined
					? { temperature: params.temperature }
					: {})
			});

			log(
				'debug',
				`${this.name} generateText completed successfully for model: ${params.modelId}`
			);

			const inputTokens =
				result.usage?.inputTokens ?? result.usage?.promptTokens ?? 0;
			const outputTokens =
				result.usage?.outputTokens ?? result.usage?.completionTokens ?? 0;
			const totalTokens =
				result.usage?.totalTokens ?? inputTokens + outputTokens;

			return {
				text: result.text,
				usage: {
					inputTokens,
					outputTokens,
					totalTokens
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
				...(this.supportsTemperature && params.temperature !== undefined
					? { temperature: params.temperature }
					: {})
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
	 * Streams a structured object using the provider's model
	 */
	async streamObject(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			if (!params.schema) {
				throw new Error('Schema is required for object streaming');
			}

			log(
				'debug',
				`Streaming ${this.name} object with model: ${params.modelId}`
			);

			const client = await this.getClient(params);
			const result = await streamObject({
				model: client(params.modelId),
				messages: params.messages,
				schema: zodSchema(params.schema),
				mode: params.mode || 'auto',
				maxOutputTokens: params.maxTokens,
				...(this.supportsTemperature && params.temperature !== undefined
					? { temperature: params.temperature }
					: {})
			});

			log(
				'debug',
				`${this.name} streamObject initiated successfully for model: ${params.modelId}`
			);

			// Return the stream result directly
			// The stream result contains partialObjectStream and other properties
			return result;
		} catch (error) {
			this.handleError('object streaming', error);
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
				schema: params.schema,
				mode: this.needsExplicitJsonSchema ? 'json' : 'auto',
				schemaName: params.objectName,
				schemaDescription: `Generate a valid JSON object for ${params.objectName}`,
				maxTokens: params.maxTokens,
				...(this.supportsTemperature && params.temperature !== undefined
					? { temperature: params.temperature }
					: {})
			});

			log(
				'debug',
				`${this.name} generateObject completed successfully for model: ${params.modelId}`
			);

			const inputTokens =
				result.usage?.inputTokens ?? result.usage?.promptTokens ?? 0;
			const outputTokens =
				result.usage?.outputTokens ?? result.usage?.completionTokens ?? 0;
			const totalTokens =
				result.usage?.totalTokens ?? inputTokens + outputTokens;

			return {
				object: result.object,
				usage: {
					inputTokens,
					outputTokens,
					totalTokens
				}
			};
		} catch (error) {
			// Check if this is a JSON parsing error that we can potentially fix
			if (
				NoObjectGeneratedError.isInstance(error) &&
				error.cause instanceof JSONParseError &&
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
							inputTokens:
								error.usage?.promptTokens || error.usage?.inputTokens || 0,
							outputTokens:
								error.usage?.completionTokens || error.usage?.outputTokens || 0,
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
