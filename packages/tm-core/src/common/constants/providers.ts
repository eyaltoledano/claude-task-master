/**
 * Provider validation constants
 * Defines which providers should be validated against the supported-models.json file
 */

// Providers that have predefined model lists and should be validated
export const VALIDATED_PROVIDERS = [
	'anthropic',
	'openai',
	'google',
	'zai',
	'zai-coding',
	'perplexity',
	'xai',
	'groq',
	'mistral'
] as const;

export type ValidatedProvider = (typeof VALIDATED_PROVIDERS)[number];

// Custom providers object for easy named access
export const CUSTOM_PROVIDERS = {
	AZURE: 'azure',
	VERTEX: 'vertex',
	BEDROCK: 'bedrock',
	OPENROUTER: 'openrouter',
	OLLAMA: 'ollama',
	LMSTUDIO: 'lmstudio',
	OPENAI_COMPATIBLE: 'openai-compatible',
	CLAUDE_CODE: 'claude-code',
	MCP: 'mcp',
	GEMINI_CLI: 'gemini-cli',
	GROK_CLI: 'grok-cli',
	CODEX_CLI: 'codex-cli'
} as const;

export type CustomProvider =
	(typeof CUSTOM_PROVIDERS)[keyof typeof CUSTOM_PROVIDERS];

// Custom providers array (for backward compatibility and iteration)
export const CUSTOM_PROVIDERS_ARRAY = Object.values(CUSTOM_PROVIDERS);

// All known providers (for reference)
export const ALL_PROVIDERS = [
	...VALIDATED_PROVIDERS,
	...CUSTOM_PROVIDERS_ARRAY
] as const;

export type Provider = ValidatedProvider | CustomProvider;
