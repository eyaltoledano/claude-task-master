/**
 * Type definitions for the unified Snowflake provider
 */

/**
 * Execution mode for the Snowflake provider
 * - 'auto': Auto-detect based on available credentials (tries REST first, then CLI)
 * - 'rest': Use Cortex REST API (/api/v2/cortex/inference:complete) - DEFAULT
 * - 'cli': Use Cortex Code CLI (requires CLI installation)
 */
export type ExecutionMode = 'auto' | 'rest' | 'cli';

/**
 * Preferred endpoint for model routing
 * - 'rest': Cortex REST API (default for all models)
 */
export type PreferredEndpoint = 'rest';

/**
 * Thinking/Reasoning level for models that support extended thinking
 * Maps to different parameters based on model type:
 * - Claude: budget_tokens (low=4096, medium=10000, high=32000)
 * - OpenAI: reasoning_effort ('low', 'medium', 'high')
 */
export type ThinkingLevel = 'low' | 'medium' | 'high';

/**
 * Reasoning effort level for Claude models
 * Controls how much "thinking" the model does before responding
 * See: https://openrouter.ai/docs/use-cases/reasoning-tokens
 * @deprecated Use ThinkingLevel instead
 */
export type ReasoningEffort = 'low' | 'medium' | 'high';

/**
 * Model capabilities configuration
 * Defines what features each model supports
 */
export interface ModelCapabilities {
	/** Maximum output tokens the model supports */
	maxTokens: number;
	/** Whether the model supports structured JSON outputs */
	supportsStructuredOutput: boolean;
	/** Whether the model supports prompt caching */
	supportsPromptCaching: boolean;
	/** Whether the model supports Claude-style extended thinking */
	supportsThinking?: boolean;
	/** Default budget_tokens for Claude thinking (if supportsThinking is true) */
	thinkingBudgetTokens?: number;
	/** Whether the model supports OpenAI-style reasoning_effort */
	supportsReasoning?: boolean;
	/** Whether the model supports streaming responses */
	supportsStreaming: boolean;
	/** Preferred endpoint for this model (default: 'cortex') */
	preferredEndpoint: PreferredEndpoint;
}

/**
 * User configuration for Snowflake features
 * Stored in .taskmaster/config.json under "snowflake" key
 */
export interface SnowflakeUserConfig {
	/** Feature toggles */
	features?: {
		/** Enable/disable structured outputs (default: true) */
		structuredOutputs?: boolean;
		/** Enable/disable prompt caching (default: true) */
		promptCaching?: boolean;
		/** Enable/disable thinking/reasoning (default: true) */
		thinking?: boolean;
		/** Enable/disable streaming (default: true) */
		streaming?: boolean;
	};
	/** Thinking level configuration */
	thinking?: {
		/** Default thinking level for regular requests (default: 'medium') */
		defaultLevel?: ThinkingLevel;
		/** Thinking level for research requests (default: 'high') */
		researchLevel?: ThinkingLevel;
	};
}

/**
 * Snowflake authentication types supported by the provider
 */
export type SnowflakeAuthenticator =
	| 'SNOWFLAKE'
	| 'SNOWFLAKE_JWT'
	| 'OAUTH'
	| 'PROGRAMMATIC_ACCESS_TOKEN'
	| 'EXTERNALBROWSER'
	| 'OAUTH_AUTHORIZATION_CODE'
	| 'OAUTH_CLIENT_CREDENTIALS';

/**
 * Connection configuration loaded from TOML files or environment variables
 */
export interface SnowflakeConnectionConfig {
	/** Snowflake account identifier */
	account: string;
	/** Username for authentication */
	user?: string;
	/** Alias for user */
	username?: string;
	/** Password for password-based auth */
	password?: string;
	/** Direct OAuth/PAT token */
	token?: string;
	/** Authentication method */
	authenticator?: SnowflakeAuthenticator;
	/** Path to private key file for key pair auth */
	privateKeyPath?: string;
	/** Private key content (PEM format) */
	privateKey?: string;
	/** Passphrase for encrypted private key */
	privateKeyPass?: string;
	/** Snowflake warehouse */
	warehouse?: string;
	/** Default database */
	database?: string;
	/** Default schema */
	schema?: string;
	/** Default role */
	role?: string;
	/** Account URL override */
	host?: string;
	/** Token file path for OAuth */
	tokenFilePath?: string;
}

/**
 * Settings for the unified Snowflake provider
 */
export interface SnowflakeProviderSettings {
	/** Snowflake connection name from ~/.snowflake/connections.toml */
	connection?: string;
	/** Execution mode: 'auto', 'cortex', 'anthropic', 'openai-compat', or 'cli' */
	executionMode?: ExecutionMode;
	/** Timeout in milliseconds (default: 120000) */
	timeout?: number;
	/** Working directory for CLI commands */
	workingDirectory?: string;
	/** Enable planning mode for CLI (read-only operations) */
	plan?: boolean;
	/** Disable Model Context Protocol servers for CLI */
	noMcp?: boolean;
	/** Path to custom skills.json file for CLI */
	skillsFile?: string;
	/** 
	 * [DANGEROUS] Allow all bash and SQL commands without permission prompts.
	 * This disables all safety checks in Cortex Code CLI.
	 * Only use in trusted, automated environments.
	 */
	dangerouslyAllowAllToolCalls?: boolean;
	/** Maximum number of retry attempts for failed requests */
	maxRetries?: number;
	/** Direct API key/token (bypasses connection loading) */
	apiKey?: string;
	/** Base URL for REST API */
	baseURL?: string;
	
	// Feature toggles (override model defaults)
	
	/**
	 * Enable/disable structured outputs
	 * When disabled, falls back to regular text generation
	 */
	enableStructuredOutputs?: boolean;
	
	/**
	 * Enable prompt caching for system messages
	 * 
	 * Behavior varies by model type:
	 * - OpenAI models: Caching is implicit (no modification needed), 1024+ tokens required
	 * - Claude models: Adds cache_control: { type: 'ephemeral' } to system prompts
	 *   - Max 4 cache points per request
	 *   - 1024+ tokens required for effective caching
	 * 
	 * See: https://docs.snowflake.com/developer-guide/snowflake-rest-api/reference/cortex-inference
	 */
	enablePromptCaching?: boolean;
	
	/**
	 * Enable thinking/reasoning for models that support it
	 * - Claude models: Uses extended thinking with budget_tokens
	 * - OpenAI models: Uses reasoning_effort parameter
	 */
	enableThinking?: boolean;
	
	/**
	 * Thinking level for requests
	 * Maps to:
	 * - Claude: budget_tokens (low=4096, medium=10000, high=32000)
	 * - OpenAI: reasoning_effort ('low', 'medium', 'high')
	 * Default: 'medium'
	 */
	thinkingLevel?: ThinkingLevel;
	
	/**
	 * Enable streaming responses
	 * When enabled, responses are streamed as they're generated
	 */
	enableStreaming?: boolean;
	
	// Legacy options (kept for backward compatibility)
	
	/**
	 * @deprecated Use thinkingLevel instead
	 */
	reasoning?: ReasoningEffort;
}

/**
 * Model identifiers supported by the unified Snowflake provider
 * Uses cortex/ prefix for all models
 * 
 * NOTE: For the full list of supported models, see KNOWN_MODELS in src/utils/models.ts
 * This type allows any string for flexibility, but the known models are listed for IDE autocomplete.
 */
export type SnowflakeModelId =
	// Claude models
	| 'cortex/claude-sonnet-4-5'
	| 'cortex/claude-haiku-4-5'
	| 'cortex/claude-4-sonnet'
	| 'cortex/claude-4-opus'
	// OpenAI models
	| 'cortex/openai-gpt-4.1'
	| 'cortex/openai-gpt-5'
	| 'cortex/openai-gpt-5-mini'
	| 'cortex/openai-gpt-5-nano'
	| 'cortex/openai-gpt-5-chat'
	// Llama models
	| 'cortex/llama4-maverick'
	| 'cortex/llama3.1-8b'
	| 'cortex/llama3.1-70b'
	| 'cortex/llama3.1-405b'
	| 'cortex/snowflake-llama-3.3-70b'
	// Other models
	| 'cortex/deepseek-r1'
	| 'cortex/mistral-7b'
	| 'cortex/mistral-large2'
	// Allow any string for flexibility with new models
	| (string & {});

/**
 * Options for creating a language model
 */
export interface SnowflakeLanguageModelOptions {
	/** Model identifier */
	id: SnowflakeModelId;
	/** Provider settings */
	settings?: SnowflakeProviderSettings;
}

/**
 * Cached token with expiry information
 * Compatible with Snowflake's JsonCredentialManager storage format
 */
export interface CachedToken {
	/** The access token */
	accessToken: string;
	/** Expiry time in milliseconds since epoch */
	expiresAt: number;
	/** Base URL for the Snowflake account (optional, cached for convenience) */
	baseURL?: string;
}

/**
 * Result from authentication
 */
export interface AuthResult {
	/** Access token for API calls */
	accessToken: string;
	/** Base URL for the Snowflake account */
	baseURL: string;
	/** Token expiry time */
	expiresAt?: number;
}

