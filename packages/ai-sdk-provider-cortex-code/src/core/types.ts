/**
 * Type definitions for Cortex Code CLI provider
 */

/**
 * Settings for configuring Cortex Code CLI behavior
 */
export interface CortexCodeSettings {
	/** Snowflake connection name from ~/.snowflake/config.toml */
	connection?: string;
	/** Timeout in milliseconds (default: 60000) */
	timeout?: number;
	/** Working directory for CLI commands */
	workingDirectory?: string;
	/** Enable planning mode (read-only operations) */
	plan?: boolean;
	/** Disable Model Context Protocol servers */
	noMcp?: boolean;
	/** Path to custom skills.json file */
	skillsFile?: string;
	/** Maximum number of retry attempts for failed requests */
	maxRetries?: number;
	/** Fallback API key for Cortex API (if not using CLI connection) */
	apiKey?: string;
}

/**
 * Model identifiers supported by Cortex Code CLI
 * These correspond to Snowflake Cortex models
 */
export type CortexCodeModelId = string;

/**
 * Error metadata for Cortex Code CLI operations
 */
export interface CortexCodeErrorMetadata {
	/** Error code */
	code?: string;
	/** Process exit code */
	exitCode?: number;
	/** Standard error output */
	stderr?: string;
	/** Standard output */
	stdout?: string;
	/** Excerpt of the prompt that caused the error */
	promptExcerpt?: string;
	/** Timeout value in milliseconds */
	timeoutMs?: number;
	/** Connection name that was used */
	connection?: string;
}

/**
 * Message format for Cortex Code CLI communication
 */
export interface CortexCodeMessage {
	/** Message role (user, assistant, system) */
	role: string;
	/** Message content */
	content: string;
}

/**
 * Response format from Cortex Code CLI stream-json output
 */
export interface CortexCodeResponse {
	/** Message role */
	role: string;
	/** Response content */
	content: string;
	/** Token usage information */
	usage?: {
		/** Input tokens used */
		prompt_tokens?: number;
		/** Output tokens used */
		completion_tokens?: number;
		/** Total tokens used */
		total_tokens?: number;
	};
}

/**
 * Stream JSON chunk format from Cortex Code
 */
export interface CortexCodeStreamChunk {
	/** Type of chunk (text, usage, error) */
	type: 'text' | 'usage' | 'error' | 'done';
	/** Text content for text chunks */
	text?: string;
	/** Usage data for usage chunks */
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
	/** Error message for error chunks */
	error?: string;
}

/**
 * Configuration options for Cortex Code CLI language model
 */
export interface CortexCodeLanguageModelOptions {
	/** Model identifier */
	id: CortexCodeModelId;
	/** Model settings */
	settings?: CortexCodeSettings;
}

/**
 * Snowflake connection configuration from config.toml
 * @deprecated Use SnowflakeConnection from '../cli/connection-manager.js' instead
 */
export type { SnowflakeConnection } from '../cli/connection-manager.js';

