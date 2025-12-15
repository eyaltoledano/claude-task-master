/**
 * Provider exports for creating and configuring Kimi CLI instances.
 */

/**
 * Creates a new Kimi CLI provider instance and the default provider instance.
 */
export { createKimiCli, kimiCli } from './kimi-cli-provider.js';

/**
 * Type definitions for the Kimi CLI provider.
 */
export type {
  KimiCliProvider,
  KimiCliProviderSettings
} from './kimi-cli-provider.js';

/**
 * Language model implementation for Kimi CLI.
 */
export { KimiCliLanguageModel } from './kimi-cli-language-model.js';

/**
 * Type definitions for Kimi CLI language models.
 */
export type {
  KimiCliModelId,
  KimiCliLanguageModelOptions,
  KimiCliSettings,
  KimiCliMessage,
  KimiCliResponse,
  KimiCliErrorMetadata
} from './types.js';

/**
 * Error handling utilities for Kimi CLI.
 */
export {
  createKimiCliError,
  createKimiCliAPIError,
  createKimiCliTimeoutError,
  createKimiCliInstallationError,
  isKimiCliInstallationError,
  getKimiCliErrorMetadata
} from './errors.js';

export type { KimiCliErrorMetadata as ErrorData } from './types.js';

/**
 * Message conversion utilities for Kimi CLI communication.
 */
export {
  convertToKimiCliMessages,
  convertFromKimiCliResponse,
  createPromptFromKimiCliMessages,
  escapeKimiCliArg
} from './message-converter.js';