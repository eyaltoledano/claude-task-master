/**
 * Cortex Code CLI provider implementation for AI SDK v5
 */

import type { LanguageModelV2, ProviderV2 } from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import { CortexCodeLanguageModel } from './language-model.js';
import type { CortexCodeModelId, CortexCodeSettings } from './types.js';

/**
 * Cortex Code CLI provider interface that extends the AI SDK's ProviderV2
 */
export interface CortexCodeProvider extends ProviderV2 {
	/**
	 * Creates a language model instance for the specified model ID.
	 * This is a shorthand for calling `languageModel()`.
	 */
	(modelId: CortexCodeModelId, settings?: CortexCodeSettings): LanguageModelV2;

	/**
	 * Creates a language model instance for text generation.
	 */
	languageModel(
		modelId: CortexCodeModelId,
		settings?: CortexCodeSettings
	): LanguageModelV2;

	/**
	 * Alias for `languageModel()` to maintain compatibility with AI SDK patterns.
	 */
	chat(
		modelId: CortexCodeModelId,
		settings?: CortexCodeSettings
	): LanguageModelV2;

	textEmbeddingModel(modelId: string): never;
	imageModel(modelId: string): never;
}

/**
 * Configuration options for creating a Cortex Code CLI provider instance
 */
export interface CortexCodeProviderSettings {
	/**
	 * Default settings to use for all models created by this provider.
	 * Individual model settings will override these defaults.
	 */
	defaultSettings?: CortexCodeSettings;
}

/**
 * Creates a Cortex Code CLI provider instance with the specified configuration.
 * The provider can be used to create language models for interacting with Snowflake Cortex models.
 *
 * @param options - Configuration options for the provider
 * @returns A configured Cortex Code CLI provider instance
 *
 * @example
 * ```typescript
 * import { createCortexCode } from '@tm/ai-sdk-provider-cortex-code';
 *
 * const cortexCode = createCortexCode({
 *   defaultSettings: {
 *     connection: '<ACCOUNT_NAME>',
 *     timeout: 60000
 *   }
 * });
 *
 * const model = cortexCode('cortex/llama3-70b');
 * ```
 */
export function createCortexCode(
	options: CortexCodeProviderSettings = {}
): CortexCodeProvider {
	const createModel = (
		modelId: CortexCodeModelId,
		settings: CortexCodeSettings = {}
	): LanguageModelV2 => {
		const mergedSettings = {
			...options.defaultSettings,
			...settings
		};

		return new CortexCodeLanguageModel({
			id: modelId,
			settings: mergedSettings
		});
	};

	const provider = function (
		modelId: CortexCodeModelId,
		settings?: CortexCodeSettings
	) {
		if (new.target) {
			throw new Error(
				'The Cortex Code model function cannot be called with the new keyword.'
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

	return provider as CortexCodeProvider;
}

/**
 * Default Cortex Code CLI provider instance.
 * Pre-configured provider for quick usage without custom settings.
 *
 * @example
 * ```typescript
 * import { cortexCode } from '@tm/ai-sdk-provider-cortex-code';
 *
 * const model = cortexCode('cortex/llama3-70b');
 * const result = await generateText({ model, prompt: 'Hello!' });
 * ```
 */
export const cortexCode = createCortexCode();

