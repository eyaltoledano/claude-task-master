/**
 * Type definitions for Grok CLI provider
 */

/**
 * Settings for configuring Grok CLI behavior
 */
export interface GrokCliSettings {
	/** API key for Grok CLI */
	apiKey?: string;
	/** Base URL for Grok API */
	baseURL?: string;
	/** Default model to use */
	model?: string;
	/** Timeout in milliseconds */
	timeout?: number;
	/** Working directory for CLI commands */
	workingDirectory?: string;
}

/**
 * Model identifiers supported by Grok CLI
 */
export type GrokCliModelId = string;

/**
 * Error metadata for Grok CLI operations
 */
export interface GrokCliErrorMetadata {
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
}

/**
 * Message format for Grok CLI communication
 */
export interface GrokCliMessage {
	/** Message role (user, assistant, system) */
	role: string;
	/** Message content */
	content: string;
}

/**
 * Response format from Grok CLI
 */
export interface GrokCliResponse {
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
 * Configuration options for Grok CLI language model
 */
export interface GrokCliLanguageModelOptions {
	/** Model identifier */
	id: GrokCliModelId;
	/** Model settings */
	settings?: GrokCliSettings;
}
