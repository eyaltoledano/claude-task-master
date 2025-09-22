/**
 * @fileoverview Type definitions for Grok CLI provider
 */

/**
 * @typedef {Object} GrokCliSettings
 * @property {string} [apiKey] - API key for Grok CLI
 * @property {string} [baseURL] - Base URL for Grok API
 * @property {string} [model] - Default model to use
 * @property {number} [timeout] - Timeout in milliseconds
 * @property {string} [workingDirectory] - Working directory for CLI commands
 */

/**
 * @typedef {string} GrokCliModelId
 * Model identifiers supported by Grok CLI
 */

/**
 * @typedef {Object} GrokCliErrorMetadata
 * @property {string} [code] - Error code
 * @property {number} [exitCode] - Process exit code
 * @property {string} [stderr] - Standard error output
 * @property {string} [stdout] - Standard output
 * @property {string} [promptExcerpt] - Excerpt of the prompt that caused the error
 * @property {number} [timeoutMs] - Timeout value in milliseconds
 */

/**
 * @typedef {Function} GrokCliProvider
 * @property {Function} languageModel - Create a language model
 * @property {Function} chat - Alias for languageModel
 * @property {Function} textEmbeddingModel - Text embedding model (throws error)
 */

/**
 * @typedef {Object} GrokCliProviderSettings
 * @property {GrokCliSettings} [defaultSettings] - Default settings for all models
 */

/**
 * @typedef {Object} GrokCliMessage
 * @property {string} role - Message role (user, assistant, system)
 * @property {string} content - Message content
 */

/**
 * @typedef {Object} GrokCliResponse
 * @property {string} content - Response content
 * @property {Object} [usage] - Token usage information
 * @property {number} [usage.prompt_tokens] - Input tokens used
 * @property {number} [usage.completion_tokens] - Output tokens used
 * @property {number} [usage.total_tokens] - Total tokens used
 */

export {};
