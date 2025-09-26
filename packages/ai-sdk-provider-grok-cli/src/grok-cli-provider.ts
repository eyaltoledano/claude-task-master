/**
 * Grok CLI provider implementation for AI SDK v5
 */

import type { LanguageModelV2, ProviderV2 } from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import { GrokCliLanguageModel } from './grok-cli-language-model.js';
import type { GrokCliModelId, GrokCliSettings } from './types.js';

/**
 * Grok CLI provider interface that extends the AI SDK's ProviderV2
 */
export interface GrokCliProvider extends ProviderV2 {
	/**
	 * Creates a language model instance for the specified model ID.
	 * This is a shorthand for calling `languageModel()`.
	 */
	(modelId: GrokCliModelId, settings?: GrokCliSettings): LanguageModelV2;

	/**
	 * Creates a language model instance for text generation.
	 */
	languageModel(
		modelId: GrokCliModelId,
		settings?: GrokCliSettings
	): LanguageModelV2;

	/**
	 * Alias for `languageModel()` to maintain compatibility with AI SDK patterns.
	 */
	chat(modelId: GrokCliModelId, settings?: GrokCliSettings): LanguageModelV2;

	textEmbeddingModel(modelId: string): never;
	imageModel(modelId: string): never;
}

/**
 * Configuration options for creating a Grok CLI provider instance
 */
export interface GrokCliProviderSettings {
	/**
	 * Default settings to use for all models created by this provider.
	 * Individual model settings will override these defaults.
	 */
	defaultSettings?: GrokCliSettings;
}

/**
 * Creates a Grok CLI provider instance with the specified configuration.
 * The provider can be used to create language models for interacting with Grok models.
 */
export function createGrokCli(
	options: GrokCliProviderSettings = {}
): GrokCliProvider {
	const createModel = (
		modelId: GrokCliModelId,
		settings: GrokCliSettings = {}
	): LanguageModelV2 => {
		const mergedSettings = {
			...options.defaultSettings,
			...settings
		};

		return new GrokCliLanguageModel({
			id: modelId,
			settings: mergedSettings
		});
	};

	const provider = function (
		modelId: GrokCliModelId,
		settings?: GrokCliSettings
	) {
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
	provider.textEmbeddingModel = (modelId: string) => {
		throw new NoSuchModelError({
			modelId,
			modelType: 'textEmbeddingModel'
		});
	};

	provider.imageModel = (modelId: string) => {
		throw new NoSuchModelError({
			modelId,
			modelType: 'imageModel'
		});
	};

	return provider as GrokCliProvider;
}

/**
 * Default Grok CLI provider instance.
 * Pre-configured provider for quick usage without custom settings.
 */
export const grokCli = createGrokCli();
