/**
 * Kimi CLI provider implementation for AI SDK v5
 */
import { ProviderV2, LanguageModelV2 } from '@ai-sdk/provider-utils';
import { KimiCliLanguageModel } from './kimi-cli-language-model.js';
import type { KimiCliModelId, KimiCliSettings } from './types.js';

/**
 * Kimi CLI provider interface that extends the AI SDK's ProviderV2
 */
export interface KimiCliProvider extends ProviderV2 {
  /**
   * Creates a language model for the specified model ID.
   * @param modelId The model ID to use.
   * @param settings Additional settings for the model.
   * @returns A language model instance.
   */
  (modelId: KimiCliModelId, settings?: KimiCliSettings): LanguageModelV2;

  /**
   * Creates a language model for the specified model ID.
   * @param modelId The model ID to use.
   * @param settings Additional settings for the model.
   * @returns A language model instance.
   */
  chat(modelId: KimiCliModelId, settings?: KimiCliSettings): LanguageModelV2;
}

/**
 * Configuration options for creating a Kimi CLI provider instance
 */
export interface KimiCliProviderSettings {
  /**
   * API key for Kimi CLI.
   * Can also be set via KIMI_CLI_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Default settings for all models.
   */
  defaultSettings?: KimiCliSettings;
}

/**
 * Creates a Kimi CLI provider instance with the specified configuration.
 */
export function createKimiCli(
  options: KimiCliProviderSettings = {}
): KimiCliProvider {
  const provider = (
    modelId: KimiCliModelId,
    settings: KimiCliSettings = {}
  ): LanguageModelV2 => {
    if (new.target) {
      throw new Error(
        'The Kimi CLI model function cannot be called with the new keyword.'
      );
    }

    return new KimiCliLanguageModel({
      modelId,
      settings: { ...options.defaultSettings, ...settings },
      apiKey: settings.apiKey ?? options.apiKey
    });
  };

  provider.chat = (
    modelId: KimiCliModelId,
    settings?: KimiCliSettings
  ): LanguageModelV2 => {
    if (new.target) {
      throw new Error(
        'The Kimi CLI model function cannot be called with the new keyword.'
      );
    }

    return new KimiCliLanguageModel({
      modelId,
      settings: { ...options.defaultSettings, ...settings },
      apiKey: settings.apiKey ?? options.apiKey
    });
  };

  return provider as KimiCliProvider;
}

/**
 * Default Kimi CLI provider instance.
 */
export const kimiCli = createKimiCli();