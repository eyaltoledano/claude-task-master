/**
 * Cortex Code CLI Provider for Vercel AI SDK
 *
 * This package provides integration between Snowflake's Cortex Code CLI
 * and the Vercel AI SDK, enabling AI-powered interactions with Snowflake
 * using the cortex command-line tool.
 *
 * @packageDocumentation
 */

// ==================== Core Exports ====================
export {
	createCortexCode,
	cortexCode,
	CortexCodeLanguageModel
} from './core/index.js';
export type {
	CortexCodeProvider,
	CortexCodeProviderSettings,
	CortexCodeModelId,
	CortexCodeSettings,
	CortexCodeLanguageModelOptions,
	CortexCodeMessage,
	CortexCodeResponse,
	CortexCodeStreamChunk
} from './core/index.js';
export {
	createAPICallError,
	createAuthenticationError,
	createConnectionError,
	createInstallationError,
	createTimeoutError,
	parseErrorFromStderr,
	isAuthenticationError,
	isConnectionError,
	isTimeoutError,
	isInstallationError
} from './core/index.js';

// ==================== CLI Exports ====================
// Minimal exports - only used in integration tests
export { detectAvailableFeatures } from './cli/index.js';
export type { CortexCodeFeatures } from './cli/index.js';

// ==================== Schema Exports ====================
export {
	buildConstraintDescription,
	removeUnsupportedFeatures,
	UNSUPPORTED_KEYWORDS,
	getModelMaxTokens,
	normalizeTokenParams,
	transformSnowflakeRequestBody
} from './schema/index.js';
export type { JSONSchema, JSONSchemaType, ModelInfo } from './schema/index.js';
export { StructuredOutputGenerator } from './schema/index.js';
export type {
	StructuredOutputMessage,
	StructuredOutputParams,
	GenerateTextFunction,
	GenerateObjectParams,
	GenerateObjectResult
} from './schema/index.js';
export {
	extractJson,
	extractStreamJson,
	isValidJson,
	cleanJsonText
} from './schema/index.js';

// ==================== Utils Exports ====================
export { ModelHelpers, validateCortexCodeAuth } from './utils/index.js';
export type { ValidationResult } from './utils/index.js';

// Message converter exports (now in cli/)
export {
	convertToCortexCodeMessages,
	convertFromCortexCodeResponse,
	createPromptFromMessages,
	escapeShellArg,
	buildCliArgs,
	formatConversationContext
} from './cli/index.js';

// ==================== Backward Compatibility Aliases ====================
// Import classes for creating function aliases
import { ModelHelpers } from './utils/model-helpers.js';
import { StructuredOutputGenerator } from './schema/structured-output.js';

/**
 * Model helper function aliases for backward compatibility
 * @deprecated Use ModelHelpers class methods instead
 */
export const modelSupportsStructuredOutputs = ModelHelpers.supportsStructuredOutputs.bind(ModelHelpers);
export const modelSupportsTemperature = ModelHelpers.supportsTemperature.bind(ModelHelpers);
export const normalizeModelId = ModelHelpers.normalizeModelId.bind(ModelHelpers);
export const getUnsupportedStructuredOutputsWarning = ModelHelpers.getUnsupportedStructuredOutputsWarning.bind(ModelHelpers);

/**
 * Structured output function aliases for backward compatibility
 * @deprecated Use StructuredOutputGenerator class methods instead
 */
export const buildStructuredOutputSystemPrompt = StructuredOutputGenerator.buildSystemPrompt.bind(StructuredOutputGenerator);
export const extractFirstJsonObject = StructuredOutputGenerator.extractFirstJsonObject.bind(StructuredOutputGenerator);
export const parseJsonWithFallback = StructuredOutputGenerator.parseWithFallback.bind(StructuredOutputGenerator);
export const extractAndParseJsonFromResponse = StructuredOutputGenerator.extractAndParse.bind(StructuredOutputGenerator);
export const prepareStructuredOutputMessages = StructuredOutputGenerator.prepareMessages.bind(StructuredOutputGenerator);
export const generateObjectWithPromptEngineering = StructuredOutputGenerator.generateObject.bind(StructuredOutputGenerator);

/**
 * Legacy type export for backward compatibility
 * @deprecated Import from core/index.js instead
 */
export type { CortexCodeErrorMetadata } from './core/types.js';

/**
 * Legacy error utility for backward compatibility
 * @deprecated Use error type guards instead
 */
export { getErrorMetadata } from './core/errors.js';
