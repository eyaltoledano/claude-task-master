/**
 * Provider exports for creating and configuring Minimax CLI instances.
 */

/**
 * Creates a new Minimax CLI provider instance and the default provider instance.
 */
export { createMinimaxCli, minimaxCli } from './minimax-cli-provider.js';

/**
 * Type definitions for the Minimax CLI provider.
 */
export type {
  MinimaxCliProvider,
  MinimaxCliProviderSettings
} from './minimax-cli-provider.js';

/**
 * Language model implementation for Minimax CLI.
 */
export { MinimaxCliLanguageModel } from './minimax-cli-language-model.js';

/**
 * Type definitions for Minimax CLI language models.
 */
export type {
  MinimaxCliModelId,
  MinimaxCliLanguageModelOptions,
  MinimaxCliSettings,
  MinimaxCliMessage,
  MinimaxCliResponse,
  MinimaxCliErrorMetadata
} from './types.js';

/**
 * Error handling utilities for Minimax CLI.
 */
export {
  createMinimaxCliError,
  createMinimaxCliAPIError,
  createMinimaxCliTimeoutError,
  createMinimaxCliInstallationError,
  isMinimaxCliInstallationError,
  getMinimaxCliErrorMetadata
} from './errors.js';

export type { MinimaxCliErrorMetadata as ErrorData } from './types.js';

/**
 * Message conversion utilities for Minimax CLI communication.
 */
export {
  convertToMinimaxCliMessages,
  convertFromMinimaxCliResponse,
  createPromptFromMinimaxCliMessages,
  escapeMinimaxCliArg
} from './message-converter.js';