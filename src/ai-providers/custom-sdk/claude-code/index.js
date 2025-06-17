/**
 * @fileoverview Claude Code provider factory and exports
 */

import { NoSuchModelError } from '@ai-sdk/provider';
import { ClaudeCodeLanguageModel } from './language-model.js';

/**
 * @typedef {import('./types.js').ClaudeCodeSettings} ClaudeCodeSettings
 * @typedef {import('./types.js').ClaudeCodeModelId} ClaudeCodeModelId
 * @typedef {import('./types.js').ClaudeCodeProvider} ClaudeCodeProvider
 * @typedef {import('./types.js').ClaudeCodeProviderSettings} ClaudeCodeProviderSettings
 */

/**
 * Create a Claude Code provider using the official SDK
 * @param {ClaudeCodeProviderSettings} [options={}] - Provider configuration options
 * @returns {ClaudeCodeProvider} Claude Code provider instance
 */
export function createClaudeCode(options = {}) {
	/**
	 * Create a language model instance
	 * @param {ClaudeCodeModelId} modelId - Model ID
	 * @param {ClaudeCodeSettings} [settings={}] - Model settings
	 * @returns {ClaudeCodeLanguageModel}
	 */
	const createModel = (modelId, settings = {}) => {
		return new ClaudeCodeLanguageModel({
			id: modelId,
			settings: {
				...options.defaultSettings,
				...settings
			}
		});
	};

	/**
	 * Provider function
	 * @param {ClaudeCodeModelId} modelId - Model ID
	 * @param {ClaudeCodeSettings} [settings] - Model settings
	 * @returns {ClaudeCodeLanguageModel}
	 */
	const provider = function (modelId, settings) {
		if (new.target) {
			throw new Error(
				'The Claude Code model function cannot be called with the new keyword.'
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

	return /** @type {ClaudeCodeProvider} */ (provider);
}

/**
 * Default Claude Code provider instance
 */
export const claudeCode = createClaudeCode();

// Provider exports
export { ClaudeCodeLanguageModel } from './language-model.js';

// Error handling exports
export {
	isAuthenticationError,
	isTimeoutError,
	getErrorMetadata,
	createAPICallError,
	createAuthenticationError,
	createTimeoutError
} from './errors.js';
