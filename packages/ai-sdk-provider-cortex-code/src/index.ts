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
export { ConnectionManager } from './cli/index.js';
export type {
	SnowflakeConnection,
	SnowflakeConnections,
	CliCheckResult,
	ValidationParams,
	ValidationResult
} from './cli/index.js';
export {
	detectAvailableFeatures,
	detectAvailableSkills,
	clearFeatureCache,
	hasFeature,
	getAvailableFeatureNames
} from './cli/index.js';
export type {
	CortexCodeFeatures,
	CortexCodeSkill
} from './cli/index.js';

// ==================== Schema Exports ====================
export {
	buildConstraintDescription,
	removeUnsupportedFeatures,
	UNSUPPORTED_KEYWORDS
} from './schema/index.js';
export type { JSONSchema, JSONSchemaType } from './schema/index.js';
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
export { ModelHelpers } from './utils/index.js';
export {
	convertToCortexCodeMessages,
	convertFromCortexCodeResponse,
	createPromptFromMessages,
	escapeShellArg,
	buildCliArgs,
	formatConversationContext
} from './utils/index.js';

// ==================== Backward Compatibility Aliases ====================
// Import classes for creating function aliases
import { ConnectionManager } from './cli/connection-manager.js';
import { ModelHelpers } from './utils/model-helpers.js';
import { StructuredOutputGenerator } from './schema/structured-output.js';

/**
 * Connection management function aliases for backward compatibility
 * @deprecated Use ConnectionManager class methods instead
 */
export const discoverConnections = ConnectionManager.discoverConnections.bind(ConnectionManager);
export const getConnection = ConnectionManager.getConnection.bind(ConnectionManager);
export const getDefaultConnection = ConnectionManager.getDefaultConnection.bind(ConnectionManager);
export const listConnections = ConnectionManager.listConnections.bind(ConnectionManager);
export const validateConnection = ConnectionManager.validateConnection.bind(ConnectionManager);
export const clearConnectionCache = ConnectionManager.clearConnectionCache.bind(ConnectionManager);
export const checkCortexCliInstallation = ConnectionManager.checkCliInstallation.bind(ConnectionManager);
export const getCortexCodeSetupInstructions = ConnectionManager.getSetupInstructions.bind(ConnectionManager);
export const validateCortexCodeAuth = ConnectionManager.validateAuth.bind(ConnectionManager);
export const validateCortexCodeAuthSync = ConnectionManager.validateAuthSync.bind(ConnectionManager);
export const clearValidationCache = ConnectionManager.clearValidationCache.bind(ConnectionManager);

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
