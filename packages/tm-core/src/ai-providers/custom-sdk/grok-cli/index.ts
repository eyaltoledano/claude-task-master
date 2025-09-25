/**
 * Provider exports for creating and configuring Grok CLI instances.
 */

/**
 * Creates a new Grok CLI provider instance and the default provider instance.
 */
export { createGrokCli, grokCli } from './grok-cli-provider.js';

/**
 * Type definitions for the Grok CLI provider.
 */
export type {
	GrokCliProvider,
	GrokCliProviderSettings
} from './grok-cli-provider.js';

/**
 * Language model implementation for Grok CLI.
 * This class implements the AI SDK's LanguageModelV2 interface.
 */
export { GrokCliLanguageModel } from './grok-cli-language-model.js';

/**
 * Type definitions for Grok CLI language models.
 */
export type {
	GrokCliModelId,
	GrokCliLanguageModelOptions,
	GrokCliSettings,
	GrokCliMessage,
	GrokCliResponse,
	GrokCliErrorMetadata
} from './types.js';

/**
 * Error handling utilities for Grok CLI.
 * These functions help create and identify specific error types.
 */
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

/**
 * Message conversion utilities for Grok CLI communication.
 */
export {
	convertToGrokCliMessages,
	convertFromGrokCliResponse,
	createPromptFromMessages,
	escapeShellArg
} from './message-converter.js';

/**
 * JSON extraction utilities for parsing Grok responses.
 */
export { extractJson } from './json-extractor.js';
