/**
 * Type definitions for Kimi CLI provider
 */

import type {
  LanguageModelV1CallOptions,
  LanguageModelV1FinishReason,
  LanguageModelV1ImagePart,
  LanguageModelV1TextPart
} from '@ai-sdk/provider-utils';

/**
 * Supported Kimi CLI model IDs
 */
export type KimiCliModelId =
  | 'kimi-k2-instruct'
  | (string & {});

/**
 * Configuration options for Kimi CLI language model
 */
export interface KimiCliLanguageModelOptions {
  /**
   * The model identifier.
   */
  modelId: KimiCliModelId;

  /**
   * Optional API key for Kimi CLI.
   * Can also be set via KIMI_CLI_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Additional settings for the Kimi CLI model.
   */
  settings?: KimiCliSettings;
}

/**
 * Additional settings for Kimi CLI models
 */
export interface KimiCliSettings {
  /**
   * Timeout for Kimi CLI operations in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Additional headers to send with requests
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Custom API endpoint (if using proxy or alternative endpoint)
   */
  baseURL?: string;
}

/**
 * Represents a message in Kimi CLI format
 */
export interface KimiCliMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Represents a response from Kimi CLI
 */
export interface KimiCliResponse {
  role?: 'assistant';
  content?: string;
  finish_reason?: LanguageModelV1FinishReason;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Error metadata for Kimi CLI operations
 */
export interface KimiCliErrorMetadata {
  code?: string;
  message?: string;
  details?: string;
  originalError?: unknown;
  command?: string;
  exitCode?: number;
}

/**
 * Parameters for Kimi CLI calls
 */
export interface KimiCliCallParams {
  options: LanguageModelV1CallOptions;
  modelId: KimiCliModelId;
  headers: Record<string, string>;
  body: unknown;
  abortSignal: AbortSignal | undefined;
}