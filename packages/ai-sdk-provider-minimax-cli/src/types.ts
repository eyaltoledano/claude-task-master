/**
 * Type definitions for Minimax CLI provider
 */

import type {
  LanguageModelV1CallOptions,
  LanguageModelV1FinishReason,
  LanguageModelV1ImagePart,
  LanguageModelV1TextPart
} from '@ai-sdk/provider-utils';

/**
 * Supported Minimax CLI model IDs
 */
export type MinimaxCliModelId =
  | 'MiniMax-M2'
  | 'MiniMax-M2-Stable'
  | 'MiniMax-V3'
  | 'MiniMax-Coding'
  | (string & {});

/**
 * Configuration options for Minimax CLI language model
 */
export interface MinimaxCliLanguageModelOptions {
  /**
   * The model identifier.
   */
  modelId: MinimaxCliModelId;

  /**
   * Optional API key for Minimax CLI.
   * Can also be set via MINIMAX_CLI_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Additional settings for the Minimax CLI model.
   */
  settings?: MinimaxCliSettings;
}

/**
 * Additional settings for Minimax CLI models
 */
export interface MinimaxCliSettings {
  /**
   * Timeout for Minimax CLI operations in milliseconds.
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
 * Represents a message in Minimax CLI format
 */
export interface MinimaxCliMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Represents a response from Minimax CLI
 */
export interface MinimaxCliResponse {
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
 * Error metadata for Minimax CLI operations
 */
export interface MinimaxCliErrorMetadata {
  code?: string;
  message?: string;
  details?: string;
  originalError?: unknown;
  command?: string;
  exitCode?: number;
}

/**
 * Parameters for Minimax CLI calls
 */
export interface MinimaxCliCallParams {
  options: LanguageModelV1CallOptions;
  modelId: MinimaxCliModelId;
  headers: Record<string, string>;
  body: unknown;
  abortSignal: AbortSignal | undefined;
}