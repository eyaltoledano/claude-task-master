/**
 * Cortex Code CLI AI provider using the ai-sdk-provider-cortex-code package
 * 
 * Integrates Snowflake's Cortex Code CLI with Task Master AI via Vercel AI SDK.
 * 
 */

import { createCortexCode } from '@tm/ai-sdk-provider-cortex-code';
import { BaseAIProvider } from './base-provider.js';
import { log } from '../../scripts/modules/utils.js';
import {
	getCortexCodeSettingsForCommand,
	getSupportedModelsForProvider
} from '../../scripts/modules/config-manager.js';
import {
	generateObjectWithPromptEngineering,
	normalizeModelId as normalizeModelIdUtil,
	validateCortexCodeAuth
} from '@tm/ai-sdk-provider-cortex-code';

/**
 * Cortex Code CLI provider class
 * Extends BaseAIProvider to integrate Snowflake Cortex via CLI
 */
export class CortexCodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Cortex Code';

		// Load supported models from supported-models.json
		this.supportedModels = getSupportedModelsForProvider('cortex-code');

		// Validate that models were loaded successfully
		if (this.supportedModels.length === 0) {
			log(
				'warn',
				'No supported models found for cortex-code provider. Check supported-models.json configuration.'
			);
		}

		// Claude models support structured outputs natively
		this.needsExplicitJsonSchema = false;
		this.supportsStructuredOutputs = true;
		this.supportsTemperature = true;
	}

	/**
	 * Get required API key name (fallback only)
	 * Cortex Code prefers Snowflake connections but can fall back to API key
	 */
	getRequiredApiKeyName() {
		return 'CORTEX_API_KEY';
	}

	/**
	 * API key is not strictly required - connections are preferred
	 */
	isRequiredApiKey() {
		return false;
	}

	/**
	 * Validate authentication - delegated to package
	 * @param {object} params - Authentication parameters
	 */
	async validateAuth(params) {
		// Delegate all validation to the package
		const result = await validateCortexCodeAuth({
			connection: params.connection,
			apiKey: params.apiKey,
			skipValidation: process.env.NODE_ENV === 'test'
		});

		// If validation failed, throw error with helpful message
		if (!result.valid) {
			log('warn', result.error);
			throw new Error(result.error);
		}

		// Log successful validation
		if (result.cliVersion) {
			log('debug', `Cortex Code CLI detected: version ${result.cliVersion}`);
		}
	}

	/**
	 * Create and configure the Cortex Code client
	 * 
	 * @param {object} params - Client parameters
	 * @returns {object} Configured Cortex Code client
	 * @throws {Error} If Cortex Code CLI is not available or client creation fails
	 */
	getClient(params = {}) {
		try {
			const settings = getCortexCodeSettingsForCommand(params.commandName) || {};

			return createCortexCode({
				defaultSettings: settings
			});
		} catch (error) {
			// Provide more helpful error message for CLI not found
			const msg = String(error?.message || '');
			const code = error?.code;
			if (code === 'ENOENT' || /cortex/i.test(msg)) {
				const enhancedError = new Error(
					`Cortex Code CLI not available. Please install Cortex Code CLI first.\n\n` +
					`Please see your Snowflake Account Executive to request access to the PrPr of Cortex Code.\n` +
					`Original error: ${error.message}`
				);
				enhancedError.cause = error;
				this.handleError('Cortex Code CLI initialization', enhancedError);
			} else {
				this.handleError('client initialization', error);
			}
		}
	}

	/**
	 * Normalize model ID by removing cortex/ prefix
	 * @param {string} modelId - Model identifier
	 * @returns {string} Normalized model ID
	 */
	normalizeModelId(modelId) {
		return normalizeModelIdUtil(modelId);
	}

	/**
	 * Normalize parameters before passing to AI SDK
	 * @private
	 */
	_normalizeParams(params) {
		const normalized = {
			...params,
			modelId: this.normalizeModelId(params.modelId)
		};

		// OpenAI models and structured outputs don't support temperature
		if (normalized.modelId?.includes('openai') || params.objectName) {
			delete normalized.temperature;
		}

		return normalized;
	}

	/**
	 * Custom generateObject implementation using prompt engineering
	 * Delegates to package helper for all logic
	 */
	async generateObject(params) {
		const normalized = this._normalizeParams(params);

		try {
			// Use the package helper for all generateObject logic
			// Pass our generateText method as a bound function
			const result = await generateObjectWithPromptEngineering({
				generateText: async (textParams) => {
					return await this.generateText({
						...normalized,
						messages: textParams.messages,
						maxTokens: textParams.maxTokens
					});
				},
				schema: params.schema,
				objectName: params.objectName,
				messages: normalized.messages,
				maxTokens: params.maxTokens || 2048,
				modelId: normalized.modelId,
				onWarning: (warning) => log('warn', warning)
			});

			return result;
		} catch (error) {
			this.handleError('object generation', error);
		}
	}

	/**
	 * @returns {string[]} List of supported model IDs
	 */
	getSupportedModels() {
		return this.supportedModels;
	}

	/**
	 * Check if a model is supported
	 * @param {string} modelId - Model ID to check
	 * @returns {boolean} True if supported
	 */
	isModelSupported(modelId) {
		if (!modelId) return false;
		return this.supportedModels.includes(String(modelId).toLowerCase());
	}
}
