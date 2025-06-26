/**
 * @fileoverview Type definitions for the MCP Sampling provider
 */

/**
 * MCP Sampling model IDs
 * @typedef {string} McpSamplingModelId
 */

/**
 * Model hint for MCP Sampling
 * @typedef {Object} McpModelHint
 * @property {string} name - Model name or substring to match
 */

/**
 * Model preferences for MCP Sampling
 * @typedef {Object} McpModelPreferences
 * @property {McpModelHint[]} [hints] - Ordered list of model hints
 * @property {number} [costPriority=0.5] - Cost priority (0-1, higher prefers cheaper)
 * @property {number} [speedPriority=0.5] - Speed priority (0-1, higher prefers faster)
 * @property {number} [intelligencePriority=0.5] - Intelligence priority (0-1, higher prefers smarter)
 */

/**
 * Settings for MCP Sampling language models
 * @typedef {Object} McpSamplingSettings
 * @property {Object} [session] - MCP session object with sampling capabilities
 * @property {number} [timeout=120000] - Request timeout in milliseconds
 * @property {string} [includeContext='thisServer'] - Context inclusion mode for MCP sampling
 * @property {number} [maxTokens=1000] - Maximum tokens to generate
 * @property {number} [temperature=0.7] - Temperature for generation
 * @property {string} [systemPrompt] - System prompt to use
 * @property {number} [costPriority=0.5] - Default cost priority for model selection
 * @property {number} [speedPriority=0.5] - Default speed priority for model selection
 * @property {number} [intelligencePriority=0.5] - Default intelligence priority for model selection
 */

/**
 * Options for creating a MCP Sampling language model
 * @typedef {Object} McpSamplingLanguageModelOptions
 * @property {McpSamplingModelId} id - Model ID
 * @property {McpSamplingSettings} [settings] - Model settings
 */

/**
 * Settings for the MCP Sampling provider factory
 * @typedef {Object} McpSamplingProviderSettings
 * @property {McpSamplingSettings} [defaultSettings] - Default settings for all models
 */

/**
 * MCP Sampling provider interface
 * @typedef {Object} McpSamplingProvider
 * @property {function(McpSamplingModelId, McpSamplingSettings): Object} languageModel - Create a language model
 * @property {function(McpSamplingModelId, McpSamplingSettings): Object} chat - Alias for languageModel
 * @property {function(McpSamplingModelId): never} textEmbeddingModel - Throws NoSuchModelError
 */

/**
 * Error metadata for MCP Sampling errors
 * @typedef {Object} McpSamplingErrorMetadata
 * @property {string} [sessionId] - Session ID if available
 * @property {string} [modelId] - Model ID that caused the error
 * @property {string} [operation] - Operation that failed
 * @property {number} [timeout] - Timeout value if applicable
 */

export {};