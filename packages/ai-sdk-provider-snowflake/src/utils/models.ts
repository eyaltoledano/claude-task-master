/**
 * Model utilities and validation
 *
 * This module provides helper functions for working with different Cortex models,
 * including capability detection and model ID normalization.
 */

import type { SnowflakeModelId, ModelCapabilities } from '../types.js';

/**
 * ==================== PROMPT CACHING ====================
 * Snowflake Cortex supports prompt caching for OpenAI and Anthropic models.
 * See: https://docs.snowflake.com/developer-guide/snowflake-rest-api/reference/cortex-inference
 *
 * OPENAI PROMPT CACHING:
 * - Prompt caching is implicit for OpenAI models; no need to modify requests to opt-in.
 * - Prompts with 1024 tokens or more will utilize caching, with cache hits occurring in 128-token increments.
 * - Messages, images, tool use and structured outputs can be cached.
 * - Cache writes: no cost.
 * - Cache reads: charged at 0.25x or 0.50x the price of the original input pricing.
 *
 * ANTHROPIC PROMPT CACHING:
 * - You can enable prompt caching for Anthropic models by providing cache points in the request.
 * - Prompts with 1024 tokens or more can utilize caching.
 * - A maximum of 4 cache points can be provided per request.
 * - User messages, system messages, tools and images can be cached.
 * - Only cache control type 'ephemeral' is supported.
 * - Use: cache_control: { type: 'ephemeral' } on message content arrays
 * - Cache writes: charged at 1.25x the price of the original input pricing.
 * - Cache reads: charged at 0.1x the price of the original input pricing.
 */

/**
 * Known Snowflake Cortex models with their capabilities
 *
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for model lists.
 * All other model lists should be derived from this.
 * Must match scripts/modules/supported-models.json (snowflake section)
 *
 * Feature Configuration:
 * - preferredEndpoint: 'cortex' (default), 'anthropic' (Claude only), 'openai-compat' (OpenAI only)
 * - supportsStructuredOutput: true if model can generate JSON according to a schema
 * - supportsPromptCaching: true if model supports cache_control for Anthropic (implicit for OpenAI)
 * - supportsThinking: true for Claude models with extended thinking
 * - supportsReasoning: true for OpenAI models with reasoning_effort
 * - supportsStreaming: true if model supports streaming responses
 */
export const KNOWN_MODELS: Record<string, ModelCapabilities> = {
	// ==================== Claude Models ====================
	// Claude models support: structured output, prompt caching, extended thinking, streaming
	// See: https://platform.claude.com/docs/en/build-with-claude/extended-thinking
	'claude-sonnet-4-5': {
		maxTokens: 64000,
		supportsStructuredOutput: true,
		supportsPromptCaching: true,
		supportsThinking: true,
		thinkingBudgetTokens: 10000, // Default budget for Claude thinking
		supportsStreaming: true,
		preferredEndpoint: 'rest' // Default to cortex, can be 'anthropic'
	},
	'claude-haiku-4-5': {
		maxTokens: 64000,
		supportsStructuredOutput: true,
		supportsPromptCaching: true,
		supportsThinking: true,
		thinkingBudgetTokens: 10000,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},
	'claude-4-sonnet': {
		maxTokens: 32000,
		supportsStructuredOutput: true,
		supportsPromptCaching: true,
		supportsThinking: true,
		thinkingBudgetTokens: 10000,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},
	'claude-4-opus': {
		maxTokens: 8192,
		supportsStructuredOutput: true,
		supportsPromptCaching: false, // API returns: "unsupported model feature: prompt_caching"
		supportsThinking: true,
		thinkingBudgetTokens: 10000,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},

	// ==================== OpenAI Models ====================
	// OpenAI models support: structured output, prompt caching, reasoning_effort, streaming
	// Note: gpt-5 variants marked with * in docs may have limited availability
	'openai-gpt-5': {
		maxTokens: 8192,
		supportsStructuredOutput: true,
		supportsPromptCaching: true,
		supportsReasoning: true,
		supportsStreaming: true,
		preferredEndpoint: 'rest' // Default to cortex, can be 'openai-compat'
	},
	'openai-gpt-5-mini': {
		maxTokens: 8192,
		supportsStructuredOutput: true,
		supportsPromptCaching: true,
		supportsReasoning: true,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},
	'openai-gpt-5-nano': {
		maxTokens: 8192,
		supportsStructuredOutput: true,
		supportsPromptCaching: true,
		supportsReasoning: true,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},
	'openai-gpt-4.1': {
		maxTokens: 32000,
		supportsStructuredOutput: true,
		supportsPromptCaching: true,
		supportsReasoning: true,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},

	// ==================== Llama Models ====================
	// Llama models: streaming supported, no structured output/caching/thinking
	'llama4-maverick': {
		maxTokens: 8192,
		supportsStructuredOutput: false,
		supportsPromptCaching: false,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},
	'llama3.1-8b': {
		maxTokens: 8192,
		supportsStructuredOutput: false,
		supportsPromptCaching: false,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},
	'llama3.1-70b': {
		maxTokens: 8192,
		supportsStructuredOutput: false,
		supportsPromptCaching: false,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},
	'llama3.1-405b': {
		maxTokens: 8192,
		supportsStructuredOutput: false,
		supportsPromptCaching: false,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},
	'snowflake-llama-3.3-70b': {
		maxTokens: 8192,
		supportsStructuredOutput: false,
		supportsPromptCaching: false,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},

	// ==================== Other Models ====================
	// Mistral and DeepSeek models: streaming supported, no structured output support
	// Note: Per Snowflake docs, structured outputs only work with Claude and OpenAI models
	// See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/complete-structured-outputs
	'deepseek-r1': {
		maxTokens: 8192,
		supportsStructuredOutput: false,
		supportsPromptCaching: false,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},
	'mistral-7b': {
		maxTokens: 8192,
		supportsStructuredOutput: false, // Not supported per Snowflake docs
		supportsPromptCaching: false,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	},
	'mistral-large2': {
		maxTokens: 8192,
		supportsStructuredOutput: false, // Not supported per Snowflake docs
		supportsPromptCaching: false,
		supportsStreaming: true,
		preferredEndpoint: 'rest'
	}
};

// =============== Derived Model Lists ===============
// All lists below are derived from KNOWN_MODELS - do NOT maintain separate lists

/** All model IDs without prefix */
export const ALL_MODEL_IDS = Object.keys(KNOWN_MODELS);

/** All model IDs with cortex/ prefix */
export const ALL_PREFIXED_MODEL_IDS = ALL_MODEL_IDS.map(
	(id) => `cortex/${id}`
) as readonly string[];

/** Claude models (support prompt caching and extended thinking) */
export const CLAUDE_MODEL_IDS = ALL_MODEL_IDS.filter((id) =>
	id.startsWith('claude-')
);
export const CLAUDE_PREFIXED_MODEL_IDS = CLAUDE_MODEL_IDS.map(
	(id) => `cortex/${id}`
) as readonly string[];

/** OpenAI models (support prompt caching and reasoning_effort) */
export const OPENAI_MODEL_IDS = ALL_MODEL_IDS.filter((id) =>
	id.startsWith('openai-')
);
export const OPENAI_PREFIXED_MODEL_IDS = OPENAI_MODEL_IDS.map(
	(id) => `cortex/${id}`
) as readonly string[];

/** Llama models */
export const LLAMA_MODEL_IDS = ALL_MODEL_IDS.filter((id) =>
	id.includes('llama')
);
export const LLAMA_PREFIXED_MODEL_IDS = LLAMA_MODEL_IDS.map(
	(id) => `cortex/${id}`
) as readonly string[];

/** Mistral models */
export const MISTRAL_MODEL_IDS = ALL_MODEL_IDS.filter((id) =>
	id.startsWith('mistral-')
);
export const MISTRAL_PREFIXED_MODEL_IDS = MISTRAL_MODEL_IDS.map(
	(id) => `cortex/${id}`
) as readonly string[];

/** Other models (deepseek, etc.) */
export const OTHER_MODEL_IDS = ALL_MODEL_IDS.filter(
	(id) =>
		!id.startsWith('claude-') &&
		!id.startsWith('openai-') &&
		!id.includes('llama') &&
		!id.startsWith('mistral-')
);
export const OTHER_PREFIXED_MODEL_IDS = OTHER_MODEL_IDS.map(
	(id) => `cortex/${id}`
) as readonly string[];

/** Models that support structured outputs */
export const STRUCTURED_OUTPUT_MODEL_IDS = ALL_MODEL_IDS.filter(
	(id) => KNOWN_MODELS[id].supportsStructuredOutput
);
export const STRUCTURED_OUTPUT_PREFIXED_MODEL_IDS =
	STRUCTURED_OUTPUT_MODEL_IDS.map((id) => `cortex/${id}`) as readonly string[];

/** Models that do NOT support structured outputs */
export const NO_STRUCTURED_OUTPUT_MODEL_IDS = ALL_MODEL_IDS.filter(
	(id) => !KNOWN_MODELS[id].supportsStructuredOutput
);
export const NO_STRUCTURED_OUTPUT_PREFIXED_MODEL_IDS =
	NO_STRUCTURED_OUTPUT_MODEL_IDS.map(
		(id) => `cortex/${id}`
	) as readonly string[];

/** Models that support prompt caching */
export const PROMPT_CACHING_MODEL_IDS = ALL_MODEL_IDS.filter(
	(id) => KNOWN_MODELS[id].supportsPromptCaching
);
export const PROMPT_CACHING_PREFIXED_MODEL_IDS = PROMPT_CACHING_MODEL_IDS.map(
	(id) => `cortex/${id}`
) as readonly string[];

/** Models that support Claude-style extended thinking */
export const THINKING_MODEL_IDS = ALL_MODEL_IDS.filter(
	(id) => KNOWN_MODELS[id].supportsThinking === true
);
export const THINKING_PREFIXED_MODEL_IDS = THINKING_MODEL_IDS.map(
	(id) => `cortex/${id}`
) as readonly string[];

/** Models that support OpenAI-style reasoning_effort */
export const REASONING_MODEL_IDS = ALL_MODEL_IDS.filter(
	(id) => KNOWN_MODELS[id].supportsReasoning === true
);
export const REASONING_PREFIXED_MODEL_IDS = REASONING_MODEL_IDS.map(
	(id) => `cortex/${id}`
) as readonly string[];

/** Models that support streaming */
export const STREAMING_MODEL_IDS = ALL_MODEL_IDS.filter(
	(id) => KNOWN_MODELS[id].supportsStreaming
);
export const STREAMING_PREFIXED_MODEL_IDS = STREAMING_MODEL_IDS.map(
	(id) => `cortex/${id}`
) as readonly string[];

/**
 * Normalize a model ID by removing the cortex/ prefix if present
 * and converting to lowercase
 */
export function normalizeModelId(modelId: SnowflakeModelId): string {
	if (!modelId || typeof modelId !== 'string') {
		return modelId;
	}
	return modelId.replace(/^cortex\//, '').toLowerCase();
}

/**
 * Add the cortex/ prefix to a model ID if not present
 */
export function prefixModelId(modelId: string): SnowflakeModelId {
	if (modelId.startsWith('cortex/')) {
		return modelId;
	}
	return `cortex/${modelId}`;
}

/** Default model capabilities for unknown models */
const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
	maxTokens: 8192,
	supportsStructuredOutput: false,
	supportsPromptCaching: false,
	supportsStreaming: true,
	preferredEndpoint: 'rest'
};

/**
 * Get model information including capabilities
 */
export function getModelInfo(modelId: SnowflakeModelId): ModelCapabilities & {
	supportsStructuredOutputs: boolean; // Alias for compatibility
} {
	const normalized = normalizeModelId(modelId);
	const info = KNOWN_MODELS[normalized] || DEFAULT_MODEL_CAPABILITIES;
	return {
		...info,
		supportsStructuredOutputs: info.supportsStructuredOutput // Alias
	};
}

/**
 * Get model capabilities for a specific model
 */
export function getModelCapabilities(
	modelId: SnowflakeModelId
): ModelCapabilities {
	const normalized = normalizeModelId(modelId);
	return KNOWN_MODELS[normalized] || DEFAULT_MODEL_CAPABILITIES;
}

/**
 * Check if a model supports prompt caching
 */
export function supportsPromptCaching(modelId: string): boolean {
	const normalized = normalizeModelId(modelId);
	if (normalized in KNOWN_MODELS) {
		return KNOWN_MODELS[normalized].supportsPromptCaching;
	}
	// Fallback: Claude and OpenAI models support prompt caching
	return normalized.startsWith('claude') || normalized.startsWith('openai');
}

/**
 * Check if a model supports Claude-style extended thinking
 */
export function supportsThinking(modelId: string): boolean {
	const normalized = normalizeModelId(modelId);
	if (normalized in KNOWN_MODELS) {
		return KNOWN_MODELS[normalized].supportsThinking === true;
	}
	// Fallback: Only Claude models support thinking
	return normalized.startsWith('claude');
}

/**
 * Check if a model supports OpenAI-style reasoning_effort
 */
export function supportsReasoning(modelId: string): boolean {
	const normalized = normalizeModelId(modelId);
	if (normalized in KNOWN_MODELS) {
		return KNOWN_MODELS[normalized].supportsReasoning === true;
	}
	// Fallback: Only OpenAI models support reasoning
	return normalized.startsWith('openai');
}

/**
 * Check if a model supports streaming
 */
export function supportsStreaming(modelId: string): boolean {
	const normalized = normalizeModelId(modelId);
	if (normalized in KNOWN_MODELS) {
		return KNOWN_MODELS[normalized].supportsStreaming;
	}
	// Default: assume streaming is supported
	return true;
}

/**
 * Get the preferred endpoint for a model
 */
export function getPreferredEndpoint(modelId: string): 'rest' {
	const normalized = normalizeModelId(modelId);
	if (normalized in KNOWN_MODELS) {
		return KNOWN_MODELS[normalized].preferredEndpoint;
	}
	// Default to rest for unknown models
	return 'rest';
}

/**
 * Get the default thinking budget tokens for a Claude model
 */
export function getThinkingBudgetTokens(
	modelId: string,
	level: 'low' | 'medium' | 'high' = 'medium'
): number {
	const budgetMap = {
		low: 4096,
		medium: 10000,
		high: 32000
	};

	const normalized = normalizeModelId(modelId);
	const modelInfo = KNOWN_MODELS[normalized];

	// Use model-specific budget if available, otherwise use level-based default
	if (modelInfo?.thinkingBudgetTokens && level === 'medium') {
		return modelInfo.thinkingBudgetTokens;
	}

	return budgetMap[level];
}

/**
 * Check if a model ID supports native structured outputs
 *
 * Only OpenAI and Claude models in Snowflake Cortex support structured outputs.
 * Other models (Llama, Mistral, etc.) will fall back to JSON mode.
 *
 * @param modelId - Model identifier (e.g., 'cortex/claude-sonnet-4-5', 'claude-haiku-4-5')
 * @returns True if model supports structured outputs
 */
export function supportsStructuredOutputs(modelId: string): boolean {
	if (!modelId || typeof modelId !== 'string') {
		return false;
	}

	const normalized = normalizeModelId(modelId);

	// Check KNOWN_MODELS first
	if (normalized in KNOWN_MODELS) {
		return KNOWN_MODELS[normalized].supportsStructuredOutput;
	}

	// Fallback: OpenAI and Claude models support structured outputs
	return (
		normalized.includes('openai') ||
		normalized.includes('claude') ||
		normalized.includes('gpt-')
	);
}

/**
 * Check if a model ID supports temperature parameter
 *
 * OpenAI models in Snowflake Cortex don't support the temperature parameter
 * when using structured outputs.
 *
 * @param modelId - Model identifier
 * @param isStructuredOutput - Whether this is for structured output generation
 * @returns True if model supports temperature
 */
export function supportsTemperature(
	modelId: string,
	isStructuredOutput = false
): boolean {
	if (!modelId || typeof modelId !== 'string') {
		return true; // Default to allowing temperature
	}

	const normalized = normalizeModelId(modelId);

	// OpenAI models don't support temperature with structured outputs
	if (
		(normalized.includes('openai') || normalized.includes('gpt-')) &&
		isStructuredOutput
	) {
		return false;
	}

	return true;
}

/**
 * Check if a model ID is valid
 */
export function isValidModelId(modelId: string): boolean {
	if (!modelId || typeof modelId !== 'string' || modelId.length === 0) {
		return false;
	}
	const normalized = normalizeModelId(modelId);
	return normalized.length > 0;
}

/**
 * Get all available model IDs with cortex/ prefix
 */
export function getAvailableModels(): SnowflakeModelId[] {
	return Object.keys(KNOWN_MODELS).map((id) => `cortex/${id}`);
}

/**
 * Get a warning message for unsupported structured outputs
 *
 * @param modelId - Model identifier
 * @returns Warning message
 */
export function getUnsupportedStructuredOutputsWarning(
	modelId: string
): string {
	return (
		`Model '${modelId}' does not support structured outputs. ` +
		`Attempting JSON mode fallback. For best results, use OpenAI or Claude models.`
	);
}

/**
 * Prepare token parameters for a model
 * Enforces minimum of 8192 tokens
 *
 * @param modelId - Model identifier
 * @param maxTokens - Requested max tokens
 * @returns Object with normalized maxTokens
 */
export function prepareTokenParam(
	modelId: string,
	maxTokens?: number
): { maxTokens: number } {
	const MIN_TOKENS = 8192;
	const normalized = normalizeModelId(modelId);
	const modelInfo = KNOWN_MODELS[normalized];
	const modelMaxTokens = modelInfo?.maxTokens || 8192;

	// Handle various input types
	let tokens = MIN_TOKENS;
	if (maxTokens !== undefined && maxTokens !== null) {
		const parsed =
			typeof maxTokens === 'string' ? parseFloat(maxTokens) : maxTokens;
		if (!isNaN(parsed)) {
			tokens = Math.floor(parsed);
		}
	}

	// Enforce minimum
	if (tokens < MIN_TOKENS) {
		tokens = MIN_TOKENS;
	}

	// Cap at model maximum
	if (tokens > modelMaxTokens) {
		tokens = modelMaxTokens;
	}

	return { maxTokens: tokens };
}

/**
 * Model utility class for Snowflake Cortex models
 */
export class ModelHelpers {
	static supportsStructuredOutputs = supportsStructuredOutputs;
	static supportsTemperature = supportsTemperature;
	static supportsPromptCaching = supportsPromptCaching;
	static supportsThinking = supportsThinking;
	static supportsReasoning = supportsReasoning;
	static supportsStreaming = supportsStreaming;
	static normalizeModelId = normalizeModelId;
	static getModelCapabilities = getModelCapabilities;
	static getPreferredEndpoint = getPreferredEndpoint;
	static getThinkingBudgetTokens = getThinkingBudgetTokens;
	static getUnsupportedStructuredOutputsWarning =
		getUnsupportedStructuredOutputsWarning;
}
