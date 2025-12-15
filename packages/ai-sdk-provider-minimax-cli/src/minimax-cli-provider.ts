/**
 * Minimax CLI provider implementation for AI SDK v5
 */
import { ProviderV2, LanguageModelV2 } from '@ai-sdk/provider-utils';
import { MinimaxCliLanguageModel } from './minimax-cli-language-model.js';
import type { MinimaxCliModelId, MinimaxCliSettings } from './types.js';

/**
 * Minimax CLI provider interface that extends the AI SDK's ProviderV2
 */
export interface MinimaxCliProvider extends ProviderV2 {
  /**
   * Creates a language model for the specified model ID.
   * @param modelId The model ID to use.
   * @param settings Additional settings for the model.
   * @returns A language model instance.
   */
  (modelId: MinimaxCliModelId, settings?: MinimaxCliSettings): LanguageModelV2;

  /**
   * Creates a language model for the specified model ID.
   * @param modelId The model ID to use.
   * @param settings Additional settings for the model.
   * @returns A language model instance.
   */
  chat(modelId: MinimaxCliModelId, settings?: MinimaxCliSettings): LanguageModelV2;
}

/**
 * Configuration options for creating a Minimax CLI provider instance
 */
export interface MinimaxCliProviderSettings {
  /**
   * API key for Minimax CLI.
   * Can also be set via MINIMAX_CLI_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Default settings for all models.
   */
  defaultSettings?: MinimaxCliSettings;
}

/**
 * Creates a Minimax CLI provider instance with the specified configuration.
 */
export function createMinimaxCli(
  options: MinimaxCliProviderSettings = {}
): MinimaxCliProvider {
  const provider = (
    modelId: MinimaxCliModelId,
    settings: MinimaxCliSettings = {}
  ): LanguageModelV2 => {
    if (new.target) {
      throw new Error(
        'The Minimax CLI model function cannot be called with the new keyword.'
      );
    }

    return new MinimaxCliLanguageModel({
      modelId,
      settings: { ...options.defaultSettings, ...settings },
      apiKey: settings.apiKey ?? options.apiKey
    });
  };

  provider.chat = (
    modelId: MinimaxCliModelId,
    settings?: MinimaxCliSettings
  ): LanguageModelV2 => {
    if (new.target) {
      throw new Error(
        'The Minimax CLI model function cannot be called with the new keyword.'
      );
    }

    return new MinimaxCliLanguageModel({
      modelId,
      settings: { ...options.defaultSettings, ...settings },
      apiKey: settings.apiKey ?? options.apiKey
    });
  };

  return provider as MinimaxCliProvider;
}

/**
 * Default Minimax CLI provider instance.
 */
export const minimaxCli = createMinimaxCli();