/**
 * @fileoverview Type definitions for model setup functionality
 */

/**
 * Represents a model role in the system
 */
export type ModelRole = 'main' | 'research' | 'fallback';

/**
 * Custom provider option identifiers
 */
export const CUSTOM_PROVIDER_IDS = {
	OPENROUTER: '__CUSTOM_OPENROUTER__',
	OLLAMA: '__CUSTOM_OLLAMA__',
	BEDROCK: '__CUSTOM_BEDROCK__',
	AZURE: '__CUSTOM_AZURE__',
	VERTEX: '__CUSTOM_VERTEX__',
	LMSTUDIO: '__CUSTOM_LMSTUDIO__',
	OPENAI_COMPATIBLE: '__CUSTOM_OPENAI_COMPATIBLE__'
} as const;

export type CustomProviderId =
	(typeof CUSTOM_PROVIDER_IDS)[keyof typeof CUSTOM_PROVIDER_IDS];

/**
 * Special control values for model selection
 */
export const CONTROL_VALUES = {
	CANCEL: '__CANCEL__',
	NO_CHANGE: '__NO_CHANGE__'
} as const;

/**
 * Model information for display
 */
export interface ModelInfo {
	id: string;
	name?: string;
	provider: string;
	cost_per_1m_tokens?: {
		input: number;
		output: number;
	};
	allowed_roles: ModelRole[];
}

/**
 * Currently configured model for a role
 */
export interface CurrentModel {
	modelId?: string;
	provider?: string;
	baseURL?: string;
}

/**
 * Current models configuration
 */
export interface CurrentModels {
	main: CurrentModel | null;
	research: CurrentModel | null;
	fallback: CurrentModel | null;
}

/**
 * Model selection choice for inquirer prompts
 */
export interface ModelChoice {
	name: string;
	value: { id: string; provider: string } | CustomProviderId | string | null;
	short?: string;
	type?: 'separator';
}

/**
 * Prompt data for a specific role
 */
export interface PromptData {
	choices: (ModelChoice | any)[]; // any to accommodate Separator instances
	default: number;
}

/**
 * Result from model fetcher functions
 */
export interface FetchResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * OpenRouter model response
 */
export interface OpenRouterModel {
	id: string;
	name?: string;
	description?: string;
}

/**
 * Ollama model response
 */
export interface OllamaModel {
	model: string;
	name: string;
	modified_at?: string;
}

/**
 * Custom provider handler configuration
 */
export interface CustomProviderConfig {
	id: CustomProviderId;
	name: string;
	provider: string;
	promptMessage: (role: ModelRole) => string;
	validate?: (modelId: string, baseURL?: string) => Promise<boolean>;
	checkEnvVars?: () => boolean;
	fetchModels?: () => Promise<FetchResult<unknown[]>>;
	requiresBaseURL?: boolean;
	defaultBaseURL?: string;
}

/**
 * Model setup options
 */
export interface ModelSetupOptions {
	projectRoot: string;
	providerHint?: string;
}

/**
 * Model set result
 */
export interface ModelSetResult {
	success: boolean;
	data?: {
		message: string;
		provider: string;
		modelId: string;
		warning?: string;
	};
	error?: {
		message: string;
	};
}
