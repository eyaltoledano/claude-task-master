/**
 * Unified Snowflake AI SDK Provider
 *
 * This package provides a unified interface for Snowflake Cortex,
 * supporting multiple backends:
 * - Cortex REST API (/api/v2/cortex/inference:complete) - DEFAULT
 * - Cortex Code CLI
 *
 * @example
 * ```typescript
 * import { createSnowflake, snowflake } from '@tm/ai-sdk-provider-snowflake';
 *
 * // Use default provider with auto-detection
 * const model = snowflake('cortex/claude-sonnet-4-5');
 *
 * // Force specific execution mode
 * const provider = createSnowflake({
 *   executionMode: 'rest'  // 'auto' | 'rest' | 'cli'
 * });
 *
 * const model = provider('cortex/claude-sonnet-4-5');
 * ```
 */

// Main provider exports
export { createSnowflake, snowflake } from './provider.js';
export type {
	SnowflakeProvider,
	SnowflakeProviderOptions
} from './provider.js';

// Types
export type {
	ExecutionMode,
	PreferredEndpoint,
	ThinkingLevel,
	ReasoningEffort,
	ModelCapabilities,
	SnowflakeUserConfig,
	SnowflakeAuthenticator,
	SnowflakeConnectionConfig,
	SnowflakeProviderSettings,
	SnowflakeModelId,
	SnowflakeLanguageModelOptions,
	CachedToken,
	AuthResult
} from './types.js';

// Config module
export {
	loadUserConfig,
	clearConfigCache,
	isFeatureEnabled,
	getThinkingLevel,
	getResolvedConfig,
	getExecutionMode,
	getEnableMcpServers,
	getDangerouslyAllowAllToolCalls,
	getProjectRoot,
	// Environment variable utilities
	getEnvVar,
	ENV_VARS,
	DEFAULT_FEATURES,
	DEFAULT_THINKING,
	DEFAULT_USER_CONFIG
} from './config/index.js';

// Auth module
export {
	authenticate,
	resolveConnectionConfig,
	generateJwtToken,
	clearAuthCache,
	validateCredentials,
	TokenCache,
	defaultTokenCache
} from './auth/index.js';

// CLI module
export {
	CliLanguageModel,
	isCortexCliAvailable,
	getCortexCliVersion,
	validateCortexCli,
	createAPICallError,
	createAuthenticationError,
	createConnectionError,
	createInstallationError,
	createTimeoutError,
	parseErrorFromStderr,
	isAuthenticationError,
	isTimeoutError,
	isInstallationError,
	isConnectionError,
	getErrorMetadata,
	convertToCliMessages,
	convertFromCliResponse,
	createPromptFromMessages
} from './cli/index.js';
export type {
	CliLanguageModelOptions,
	CliErrorMetadata,
	CliMessage,
	CliResponse,
	ValidationResult
} from './cli/index.js';

// REST API module - Cortex REST API (/api/v2/cortex/inference:complete)
export { RestLanguageModel } from './rest/index.js';
export type { RestLanguageModelOptions } from './rest/index.js';

// Shared utilities
export {
	createSnowflakeFetch,
	createSnowflakeAnthropicFetch,
	getSnowflakeBaseURL
} from './shared/index.js';

// Model validation API
export {
	fetchAvailableModels,
	isModelAvailable,
	getAvailableModelNames,
	validateModelAvailability,
	clearModelCache,
	getModelInfo as getCortexModelInfo, // Renamed to avoid conflict with utils/models.ts
	suggestAlternativeModels
} from './api/index.js';
export type { CortexModelInfo } from './api/index.js';

// Schema utilities
export {
	removeUnsupportedFeatures,
	buildConstraintDescription,
	getModelMaxTokens,
	normalizeTokenParams,
	transformSnowflakeRequestBody,
	UNSUPPORTED_KEYWORDS,
	StructuredOutputGenerator,
	extractJson,
	extractStreamJson,
	isValidJson,
	cleanJsonText
} from './schema/index.js';
export type {
	JSONSchema,
	JSONSchemaType,
	ModelInfo,
	StructuredOutputMessage,
	StructuredOutputParams,
	GenerateTextFunction,
	GenerateObjectParams,
	GenerateObjectResult
} from './schema/index.js';

// Model utilities
export {
	KNOWN_MODELS,
	normalizeModelId,
	prefixModelId,
	getModelInfo,
	getModelCapabilities,
	isValidModelId,
	getAvailableModels,
	supportsStructuredOutputs,
	supportsTemperature,
	supportsPromptCaching,
	supportsThinking,
	supportsReasoning,
	supportsStreaming,
	getPreferredEndpoint,
	getThinkingBudgetTokens,
	prepareTokenParam,
	// Model ID lists
	ALL_MODEL_IDS,
	ALL_PREFIXED_MODEL_IDS,
	CLAUDE_MODEL_IDS,
	CLAUDE_PREFIXED_MODEL_IDS,
	OPENAI_MODEL_IDS,
	OPENAI_PREFIXED_MODEL_IDS,
	LLAMA_MODEL_IDS,
	LLAMA_PREFIXED_MODEL_IDS,
	MISTRAL_MODEL_IDS,
	MISTRAL_PREFIXED_MODEL_IDS,
	OTHER_MODEL_IDS,
	OTHER_PREFIXED_MODEL_IDS,
	STRUCTURED_OUTPUT_MODEL_IDS,
	STRUCTURED_OUTPUT_PREFIXED_MODEL_IDS,
	PROMPT_CACHING_MODEL_IDS,
	PROMPT_CACHING_PREFIXED_MODEL_IDS,
	THINKING_MODEL_IDS,
	THINKING_PREFIXED_MODEL_IDS,
	REASONING_MODEL_IDS,
	REASONING_PREFIXED_MODEL_IDS,
	STREAMING_MODEL_IDS,
	STREAMING_PREFIXED_MODEL_IDS,
	ModelHelpers,
	// Tool helpers
	convertToolsToSnowflakeFormat,
	parseToolCalls,
	createToolResult,
	executeTool,
	hasToolCalls,
	getFinishReason
} from './utils/index.js';
export type { AiSdkTool } from './utils/index.js';

// Built-in tools for Cortex Code CLI-like capabilities
export {
	// Tool types
	type FileInfo,
	type SkillMetadata,
	type ListSkillsResult,
	type SearchResult,
	type WebSearchResult,
	type FetchUrlResult,
	type TreeNode,
	type ProjectTreeResult,
	type FileSearchResult,
	type FileReadResult,
	type GrepMatch,
	type GrepResult,
	type TaskSummary,
	type TaskDetails,
	type ListTasksResult,
	type CurrentContextResult,
	type CortexToolSpec,
	type CortexToolCall,
	type CortexToolResult,
	// Individual tools
	listSkillsTool,
	webSearchTool,
	fetchUrlTool,
	projectTreeTool,
	fileReadTool,
	grepTool,
	listTasksTool,
	getTaskTool,
	getNextTaskTool,
	getCurrentContextTool,
	// Tool sets
	snowflakeResearchTools,
	snowflakeMinimalTools,
	snowflakeFileTools,
	snowflakeTaskTools,
	snowflakeWebTools
} from './tools/index.js';
