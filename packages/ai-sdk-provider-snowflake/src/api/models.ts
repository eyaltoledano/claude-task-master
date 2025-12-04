/**
 * Model Validation API for Snowflake Cortex
 * 
 * Uses the Cortex Inference REST API to dynamically validate model availability.
 * This helps provide accurate error messages when models are not available
 * in the user's account or region.
 * 
 * See: https://docs.snowflake.com/developer-guide/snowflake-rest-api/reference/cortex-inference
 */

import { authenticate } from '../auth/index.js';
import type { SnowflakeProviderSettings } from '../types.js';

/**
 * Model information returned by the Cortex Inference API
 */
export interface CortexModelInfo {
	/** Model name/identifier */
	name: string;
	/** Model provider (anthropic, openai, meta, mistral, etc.) */
	provider?: string;
	/** Model capabilities */
	capabilities?: {
		structured_output?: boolean;
		tool_use?: boolean;
		vision?: boolean;
	};
	/** Model limits */
	limits?: {
		max_tokens?: number;
		context_window?: number;
	};
}

/**
 * Cache for available models
 */
interface ModelCache {
	models: CortexModelInfo[];
	timestamp: number;
	expiresAt: number;
}

// Global model cache with 5-minute TTL
let modelCache: ModelCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch available models from the Cortex Inference API
 * 
 * @param settings - Provider settings for authentication
 * @returns List of available models
 */
export async function fetchAvailableModels(
	settings: SnowflakeProviderSettings = {}
): Promise<CortexModelInfo[]> {
	// Check cache first
	if (modelCache && Date.now() < modelCache.expiresAt) {
		return modelCache.models;
	}

	// Authenticate
	const auth = await authenticate(settings);
	
	// Fetch models from Cortex Inference API
	const url = `${auth.baseURL}/api/v2/cortex/inference/models`;
	
	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${auth.accessToken}`,
			'Accept': 'application/json'
		}
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`Failed to fetch available models: ${response.status} - ${errorBody}`);
	}

	const result = await response.json() as {
		models?: CortexModelInfo[] | Array<{ name: string }>;
	};

	// Normalize response - handle both array of objects and simple model names
	const models: CortexModelInfo[] = [];
	if (result.models && Array.isArray(result.models)) {
		for (const model of result.models) {
			if (typeof model === 'string') {
				models.push({ name: model });
			} else if (model && typeof model === 'object') {
				models.push(model as CortexModelInfo);
			}
		}
	}

	// Update cache
	modelCache = {
		models,
		timestamp: Date.now(),
		expiresAt: Date.now() + CACHE_TTL_MS
	};

	// Debug logging
	if (process.env.DEBUG?.includes('snowflake:api')) {
		console.log(`[DEBUG snowflake:api] Fetched ${models.length} available models`);
		console.log(`[DEBUG snowflake:api] Models:`, models.map(m => m.name).join(', '));
	}

	return models;
}

/**
 * Check if a specific model is available
 * 
 * @param modelId - Model ID to check (with or without cortex/ prefix)
 * @param settings - Provider settings for authentication
 * @returns True if model is available
 */
export async function isModelAvailable(
	modelId: string,
	settings: SnowflakeProviderSettings = {}
): Promise<boolean> {
	try {
		const models = await fetchAvailableModels(settings);
		
		// Normalize model ID - remove cortex/ prefix
		const normalizedId = modelId.toLowerCase().replace(/^cortex\//, '');
		
		// Check if model exists in available models
		return models.some(m => {
			const modelName = m.name.toLowerCase();
			return modelName === normalizedId || 
			       modelName === `cortex/${normalizedId}` ||
			       normalizedId === modelName.replace(/^cortex\//, '');
		});
	} catch (error) {
		// If we can't fetch models, assume it's available and let the actual request fail
		if (process.env.DEBUG?.includes('snowflake:api')) {
			console.log(`[DEBUG snowflake:api] Could not check model availability: ${error}`);
		}
		return true;
	}
}

/**
 * Get available model names
 * 
 * @param settings - Provider settings for authentication
 * @returns List of available model names
 */
export async function getAvailableModelNames(
	settings: SnowflakeProviderSettings = {}
): Promise<string[]> {
	const models = await fetchAvailableModels(settings);
	return models.map(m => m.name);
}

/**
 * Validate model availability and throw helpful error if not available
 * 
 * @param modelId - Model ID to validate
 * @param settings - Provider settings for authentication
 * @throws Error with helpful message if model is not available
 */
export async function validateModelAvailability(
	modelId: string,
	settings: SnowflakeProviderSettings = {}
): Promise<void> {
	const available = await isModelAvailable(modelId, settings);
	
	if (!available) {
		const models = await fetchAvailableModels(settings);
		const availableNames = models.map(m => m.name).join(', ');
		
		throw new Error(
			`Model '${modelId}' is not available in your Snowflake account or region. ` +
			`Available models: ${availableNames || 'none'}`
		);
	}
}

/**
 * Clear the model cache
 * Useful for testing or forcing a refresh
 */
export function clearModelCache(): void {
	modelCache = null;
}

/**
 * Get model info if available
 * 
 * @param modelId - Model ID to look up
 * @param settings - Provider settings for authentication
 * @returns Model info or undefined if not found
 */
export async function getModelInfo(
	modelId: string,
	settings: SnowflakeProviderSettings = {}
): Promise<CortexModelInfo | undefined> {
	const models = await fetchAvailableModels(settings);
	const normalizedId = modelId.toLowerCase().replace(/^cortex\//, '');
	
	return models.find(m => {
		const modelName = m.name.toLowerCase();
		return modelName === normalizedId || 
		       modelName === `cortex/${normalizedId}` ||
		       normalizedId === modelName.replace(/^cortex\//, '');
	});
}

/**
 * Suggest alternative models when a model is not available
 * 
 * @param modelId - Model ID that was not available
 * @param settings - Provider settings for authentication
 * @returns List of suggested alternative models
 */
export async function suggestAlternativeModels(
	modelId: string,
	settings: SnowflakeProviderSettings = {}
): Promise<string[]> {
	const models = await fetchAvailableModels(settings);
	const normalizedId = modelId.toLowerCase().replace(/^cortex\//, '');
	
	// Determine model type from name
	const modelType = normalizedId.split('-')[0]; // e.g., 'claude', 'openai', 'llama'
	
	// Find models of the same type
	const suggestions = models
		.filter(m => m.name.toLowerCase().includes(modelType))
		.map(m => m.name)
		.slice(0, 5); // Limit to 5 suggestions
	
	// If no suggestions of the same type, return any available models
	if (suggestions.length === 0) {
		return models.map(m => m.name).slice(0, 5);
	}
	
	return suggestions;
}

