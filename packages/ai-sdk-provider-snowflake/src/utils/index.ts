/**
 * Utils module exports
 */

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
	getUnsupportedStructuredOutputsWarning,
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
	NO_STRUCTURED_OUTPUT_MODEL_IDS,
	NO_STRUCTURED_OUTPUT_PREFIXED_MODEL_IDS,
	PROMPT_CACHING_MODEL_IDS,
	PROMPT_CACHING_PREFIXED_MODEL_IDS,
	THINKING_MODEL_IDS,
	THINKING_PREFIXED_MODEL_IDS,
	REASONING_MODEL_IDS,
	REASONING_PREFIXED_MODEL_IDS,
	STREAMING_MODEL_IDS,
	STREAMING_PREFIXED_MODEL_IDS,
	// Class export
	ModelHelpers
} from './models.js';

// Legacy model helpers (re-export for backward compatibility)
export { ModelHelpers as LegacyModelHelpers } from './model-helpers.js';

// Tool helpers
export {
	convertToolsToSnowflakeFormat,
	parseToolCalls,
	createToolResult,
	executeTool,
	hasToolCalls,
	getFinishReason,
	type AiSdkTool
} from './tool-helpers.js';
