/**
 * @fileoverview TypeScript bridge for model management functions
 * Wraps the JavaScript functions with proper TypeScript types
 * Will remove once we move models.js and config-manager to new structure
 */

// @ts-ignore - JavaScript module without types
import * as modelsJs from '../../../../scripts/modules/task-manager/models.js';
// @ts-ignore - JavaScript module without types
import * as configManagerJs from '../../../../scripts/modules/config-manager.js';

// ========== Types ==========

export interface ModelCost {
	input: number;
	output: number;
}

export interface ModelData {
	id: string;
	provider?: string;
	swe_score?: number | null;
	cost_per_1m_tokens?: ModelCost | null;
	allowed_roles?: string[];
	max_tokens?: number;
	supported?: boolean;
}

export interface ModelConfiguration {
	provider: string;
	modelId: string;
	baseURL?: string;
	sweScore: number | null;
	cost: ModelCost | null;
	keyStatus: {
		cli: boolean;
		mcp: boolean;
	};
}

export interface ModelConfigurationResponse {
	success: boolean;
	data?: {
		activeModels: {
			main: ModelConfiguration;
			research: ModelConfiguration;
			fallback: ModelConfiguration | null;
		};
		message: string;
	};
	error?: {
		code: string;
		message: string;
	};
}

export interface AvailableModel {
	provider: string;
	modelId: string;
	sweScore: number | null;
	cost: ModelCost | null;
	allowedRoles: string[];
}

export interface AvailableModelsResponse {
	success: boolean;
	data?: {
		models: AvailableModel[];
		message: string;
	};
	error?: {
		code: string;
		message: string;
	};
}

export interface SetModelResponse {
	success: boolean;
	data?: {
		role: string;
		provider: string;
		modelId: string;
		message: string;
		warning?: string | null;
	};
	error?: {
		code: string;
		message: string;
	};
}

export interface SetModelOptions {
	providerHint?: string;
	baseURL?: string;
	session?: Record<string, string | undefined>;
	mcpLog?: {
		info: (...args: unknown[]) => void;
		warn: (...args: unknown[]) => void;
		error: (...args: unknown[]) => void;
	};
	projectRoot: string;
}

// ========== Wrapped Functions ==========

/**
 * Get the current model configuration
 */
export async function getModelConfiguration(
	options: SetModelOptions
): Promise<ModelConfigurationResponse> {
	return modelsJs.getModelConfiguration(
		options as any
	) as Promise<ModelConfigurationResponse>;
}

/**
 * Get all available models
 */
export async function getAvailableModelsList(
	options: SetModelOptions
): Promise<AvailableModelsResponse> {
	return modelsJs.getAvailableModelsList(
		options as any
	) as Promise<AvailableModelsResponse>;
}

/**
 * Set a model for a specific role
 */
export async function setModel(
	role: 'main' | 'research' | 'fallback',
	modelId: string,
	options: SetModelOptions
): Promise<SetModelResponse> {
	return modelsJs.setModel(
		role,
		modelId,
		options as any
	) as Promise<SetModelResponse>;
}

/**
 * Get config from config manager
 */
export function getConfig(projectRoot: string): any {
	return configManagerJs.getConfig(projectRoot);
}

/**
 * Write config using config manager
 */
export function writeConfig(config: any, projectRoot: string): boolean {
	return configManagerJs.writeConfig(config, projectRoot);
}

/**
 * Get available models from config manager
 */
export function getAvailableModels(): ModelData[] {
	return configManagerJs.getAvailableModels() as ModelData[];
}
