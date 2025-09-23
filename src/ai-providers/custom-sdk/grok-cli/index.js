/**
 * @fileoverview Grok CLI provider factory and exports
 */

import { NoSuchModelError } from '@ai-sdk/provider';
import { GrokCliLanguageModel } from './language-model.js';

/**
 * @typedef {import('./types.js').GrokCliSettings} GrokCliSettings
 * @typedef {import('./types.js').GrokCliModelId} GrokCliModelId
 * @typedef {import('./types.js').GrokCliProvider} GrokCliProvider
 * @typedef {import('./types.js').GrokCliProviderSettings} GrokCliProviderSettings
 */

/**
 * Create a Grok CLI provider
 * @param {GrokCliProviderSettings} [options={}] - Provider configuration options
 * @returns {GrokCliProvider} Grok CLI provider instance
 */
export function createGrokCli(options = {}) {
	/**
	 * Create a language model instance
	 * @param {GrokCliModelId} modelId - Model ID
	 * @param {GrokCliSettings} [settings={}] - Model settings
	 * @returns {GrokCliLanguageModel}
	 */
	const createModel = (modelId, settings = {}) => {
		return new GrokCliLanguageModel({
			id: modelId,
			settings: {
				...options.defaultSettings,
				...settings
			}
		});
	};

	/**
	 * Provider function
	 * @param {GrokCliModelId} modelId - Model ID
	 * @param {GrokCliSettings} [settings] - Model settings
	 * @returns {GrokCliLanguageModel}
	 */
	const provider = function (modelId, settings) {
		if (new.target) {
			throw new Error(
				'The Grok CLI model function cannot be called with the new keyword.'
			);
		}

		return createModel(modelId, settings);
	};

	provider.languageModel = createModel;
	provider.chat = createModel; // Alias for languageModel

	// Add textEmbeddingModel method that throws NoSuchModelError
	provider.textEmbeddingModel = (modelId) => {
		throw new NoSuchModelError({
			modelId,
			modelType: 'textEmbeddingModel'
		});
	};

	return /** @type {GrokCliProvider} */ (provider);
}

/**
 * Default Grok CLI provider instance
 */
export const grokCli = createGrokCli();

// Provider exports
export { GrokCliLanguageModel } from './language-model.js';

// Error handling exports
export {
	isAuthenticationError,
	isTimeoutError,
	isInstallationError,
	getErrorMetadata,
	createAPICallError,
	createAuthenticationError,
	createTimeoutError,
	createInstallationError
} from './errors.js';
