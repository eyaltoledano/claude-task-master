/**
 * @fileoverview Type definitions for Claude Code AI SDK provider
 * These JSDoc types mirror the TypeScript interfaces from the original provider
 */

/**
 * Claude Code provider settings
 * @typedef {Object} ClaudeCodeSettings
 * @property {string} [pathToClaudeCodeExecutable='claude'] - Custom path to Claude Code CLI executable
 * @property {string} [customSystemPrompt] - Custom system prompt to use
 * @property {string} [appendSystemPrompt] - Append additional content to the system prompt
 * @property {number} [maxTurns] - Maximum number of turns for the conversation
 * @property {number} [maxThinkingTokens] - Maximum thinking tokens for the model
 * @property {string} [cwd] - Working directory for CLI operations
 * @property {'bun'|'deno'|'node'} [executable='node'] - JavaScript runtime to use
 * @property {string[]} [executableArgs] - Additional arguments for the JavaScript runtime
 * @property {'default'|'acceptEdits'|'bypassPermissions'|'plan'} [permissionMode='default'] - Permission mode for tool usage
 * @property {string} [permissionPromptToolName] - Custom tool name for permission prompts
 * @property {boolean} [continue] - Continue the most recent conversation
 * @property {string} [resume] - Resume a specific session by ID
 * @property {string[]} [allowedTools] - Tools to explicitly allow during execution (e.g., ['Read', 'LS', 'Bash(git log:*)'])
 * @property {string[]} [disallowedTools] - Tools to disallow during execution (e.g., ['Write', 'Edit', 'Bash(rm:*)'])
 * @property {Object.<string, MCPServerConfig>} [mcpServers] - MCP server configuration
 * @property {boolean} [verbose] - Enable verbose logging for debugging
 */

/**
 * MCP Server configuration
 * @typedef {Object} MCPServerConfig
 * @property {'stdio'|'sse'} [type='stdio'] - Server type
 * @property {string} command - Command to execute (for stdio type)
 * @property {string[]} [args] - Arguments for the command
 * @property {Object.<string, string>} [env] - Environment variables
 * @property {string} url - URL for SSE type servers
 * @property {Object.<string, string>} [headers] - Headers for SSE type servers
 */

/**
 * Model ID type - either 'opus', 'sonnet', or any string
 * @typedef {'opus'|'sonnet'|string} ClaudeCodeModelId
 */

/**
 * Language model options
 * @typedef {Object} ClaudeCodeLanguageModelOptions
 * @property {ClaudeCodeModelId} id - The model ID
 * @property {ClaudeCodeSettings} [settings] - Optional settings
 */

/**
 * Error metadata for Claude Code errors
 * @typedef {Object} ClaudeCodeErrorMetadata
 * @property {string} [code] - Error code
 * @property {number} [exitCode] - Process exit code
 * @property {string} [stderr] - Standard error output
 * @property {string} [promptExcerpt] - Excerpt of the prompt that caused the error
 */

/**
 * Claude Code provider interface
 * @typedef {Object} ClaudeCodeProvider
 * @property {function(ClaudeCodeModelId, ClaudeCodeSettings=): Object} languageModel - Create a language model
 * @property {function(ClaudeCodeModelId, ClaudeCodeSettings=): Object} chat - Alias for languageModel
 * @property {function(string): never} textEmbeddingModel - Throws NoSuchModelError (not supported)
 */

/**
 * Claude Code provider settings
 * @typedef {Object} ClaudeCodeProviderSettings
 * @property {ClaudeCodeSettings} [defaultSettings] - Default settings to use for all models
 */

export {}; // This ensures the file is treated as a module