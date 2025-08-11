/**
 * @fileoverview ModelsDevService - Core service for models.dev API integration
 * 
 * Provides caching, error handling, and data normalization for the models.dev API.
 * Follows the specification defined in docs/SPEC-models-dev-integration.md
 */

import fs from 'fs';
import path from 'path';
import { log } from '../../scripts/modules/utils.js';

/**
 * Service for integrating with the models.dev API
 * Handles caching, error recovery, and data normalization
 */
export class ModelsDevService {
	constructor() {
		this.apiUrl = 'https://models.dev/api.json';
		this.cacheFile = path.join(process.cwd(), '.taskmaster', 'models-cache.json');
		this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
		this._memoryCache = null;
	}

	/**
	 * Fetch models from models.dev API with intelligent caching
	 * @returns {Promise<Object>} Models.dev API response
	 */
	async fetchModels() {
		try {
			// Check memory cache first
			if (this._memoryCache) {
				return this._memoryCache;
			}

			// Check disk cache
			const cachedData = await this._loadFromCache();
			if (cachedData) {
				this._memoryCache = cachedData;
				return cachedData;
			}

			// Fetch from API
			log('info', '[MODELS-DEV] Fetching models from models.dev API...');
			const response = await fetch(this.apiUrl, {
				headers: {
					'User-Agent': 'task-master-ai/models-dev-integration',
					'Accept': 'application/json'
				},
				timeout: 10000 // 10 second timeout
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			
			// Validate basic structure
			if (!data || typeof data !== 'object') {
				throw new Error('Invalid API response structure');
			}

			// Cache the data
			await this._saveToCache(data);
			this._memoryCache = data;

			log('info', `[MODELS-DEV] Successfully loaded ${Object.keys(data).length} providers`);
			return data;

		} catch (error) {
			log('error', `[MODELS-DEV] API fetch failed: ${error.message}`);
			
			// Try stale cache as fallback
			const staleData = await this._loadFromCache(true); // ignore TTL
			if (staleData) {
				log('warn', '[MODELS-DEV] Using stale cache as fallback');
				this._memoryCache = staleData;
				return staleData;
			}

			// No fallback available
			throw new Error(`Failed to fetch models: ${error.message}`);
		}
	}

	/**
	 * Get list of available provider IDs
	 * @returns {Promise<string[]>} Array of provider identifiers
	 */
	async getProviders() {
		const data = await this.fetchModels();
		return Object.keys(data);
	}

	/**
	 * Get information about a specific provider
	 * @param {string} providerId - Provider identifier
	 * @returns {Promise<Object|null>} Provider data or null if not found
	 */
	async getProvider(providerId) {
		const data = await this.fetchModels();
		return data[providerId] || null;
	}

	/**
	 * Get all models for a specific provider
	 * @param {string} providerId - Provider identifier
	 * @returns {Promise<Array>} Array of enhanced model objects
	 */
	async getProviderModels(providerId) {
		const provider = await this.getProvider(providerId);
		if (!provider || !provider.models) {
			return [];
		}

		// Transform models.dev format to enhanced format
		return Object.entries(provider.models).map(([modelId, modelData]) => ({
			id: modelId,
			name: modelData.name || modelId,
			provider: providerId,
			provider_name: provider.name,
			
			// Cost information
			cost_per_1m_tokens: modelData.cost ? {
				input: modelData.cost.input,
				output: modelData.cost.output
			} : null,
			
			// Capabilities
			reasoning: modelData.reasoning || false,
			tool_call: modelData.tool_call || false,
			modalities: modelData.modalities || { input: ['text'], output: ['text'] },
			
			// Context and limits
			context_length: modelData.limit?.context || null,
			max_tokens: modelData.max_tokens || modelData.limit?.context || null,
			
			// Provider metadata
			env_vars: provider.env || [],
			npm_package: provider.npm || null,
			documentation: provider.doc || null,
			
			// Enhanced metadata
			source: 'models.dev',
			release_date: modelData.release_date || null,
			last_updated: new Date().toISOString(),
			
			// Infer allowed roles based on capabilities
			allowed_roles: this._inferAllowedRoles(modelData)
		}));
	}

	/**
	 * Search models across all providers with filters
	 * @param {Object} filters - Search criteria
	 * @param {string[]} [filters.providers] - Filter by provider IDs
	 * @param {boolean} [filters.reasoning] - Require reasoning capability
	 * @param {boolean} [filters.tool_call] - Require tool calling capability  
	 * @param {number} [filters.max_cost] - Maximum cost per 1M input tokens
	 * @param {number} [filters.min_context] - Minimum context length
	 * @param {string[]} [filters.modalities] - Required modalities
	 * @returns {Promise<Array>} Filtered model array
	 */
	async searchModels(filters = {}) {
		const data = await this.fetchModels();
		const allModels = [];

		// Collect models from all providers
		for (const [providerId, provider] of Object.entries(data)) {
			// Skip providers not in filter
			if (filters.providers && !filters.providers.includes(providerId)) {
				continue;
			}

			if (provider.models) {
				const providerModels = await this.getProviderModels(providerId);
				allModels.push(...providerModels);
			}
		}

		// Apply filters
		return allModels.filter(model => {
			if (filters.reasoning !== undefined && model.reasoning !== filters.reasoning) {
				return false;
			}
			
			if (filters.tool_call !== undefined && model.tool_call !== filters.tool_call) {
				return false;
			}
			
			if (filters.max_cost !== undefined) {
				const cost = model.cost_per_1m_tokens?.input || 0;
				if (cost > filters.max_cost) return false;
			}
			
			if (filters.min_context !== undefined) {
				const context = model.context_length || 0;
				if (context < filters.min_context) return false;
			}
			
			if (filters.modalities && filters.modalities.length > 0) {
				const hasAllModalities = filters.modalities.every(modality => 
					model.modalities?.input?.includes(modality) || 
					model.modalities?.output?.includes(modality)
				);
				if (!hasAllModalities) return false;
			}
			
			return true;
		});
	}

	/**
	 * Clear all cached data
	 * @returns {Promise<void>}
	 */
	async clearCache() {
		this._memoryCache = null;
		
		try {
			if (fs.existsSync(this.cacheFile)) {
				await fs.promises.unlink(this.cacheFile);
			}
		} catch (error) {
			log('warn', `[MODELS-DEV] Cache clear warning: ${error.message}`);
		}
	}

	/**
	 * Get cache status information
	 * @returns {Promise<Object>} Cache information
	 */
	async getCacheInfo() {
		try {
			if (!fs.existsSync(this.cacheFile)) {
				return { exists: false, age: null, size: 0, expired: true };
			}

			const stats = await fs.promises.stat(this.cacheFile);
			const age = Date.now() - stats.mtime.getTime();
			const ageHours = Math.round(age / (1000 * 60 * 60));
			const expired = age > this.cacheTimeout;

			return {
				exists: true,
				age,
				ageHours,
				size: stats.size,
				expired
			};
		} catch (error) {
			return { exists: false, age: null, size: 0, expired: true, error: error.message };
		}
	}

	// Private methods

	/**
	 * Load data from disk cache
	 * @param {boolean} ignoreTTL - Whether to ignore cache expiration
	 * @returns {Promise<Object|null>} Cached data or null
	 * @private
	 */
	async _loadFromCache(ignoreTTL = false) {
		try {
			if (!fs.existsSync(this.cacheFile)) {
				return null;
			}

			const stats = await fs.promises.stat(this.cacheFile);
			const age = Date.now() - stats.mtime.getTime();

			// Check TTL unless explicitly ignored
			if (!ignoreTTL && age > this.cacheTimeout) {
				log('debug', '[MODELS-DEV] Cache expired, will fetch fresh data');
				return null;
			}

			const rawData = await fs.promises.readFile(this.cacheFile, 'utf-8');
			const data = JSON.parse(rawData);

			log('debug', `[MODELS-DEV] Loaded from cache (age: ${Math.round(age / (1000 * 60))}min)`);
			return data;

		} catch (error) {
			log('debug', `[MODELS-DEV] Cache load failed: ${error.message}`);
			return null;
		}
	}

	/**
	 * Save data to disk cache
	 * @param {Object} data - Data to cache
	 * @returns {Promise<void>}
	 * @private
	 */
	async _saveToCache(data) {
		try {
			const cacheDir = path.dirname(this.cacheFile);
			if (!fs.existsSync(cacheDir)) {
				await fs.promises.mkdir(cacheDir, { recursive: true });
			}

			await fs.promises.writeFile(
				this.cacheFile, 
				JSON.stringify(data, null, 2), 
				'utf-8'
			);

			log('debug', '[MODELS-DEV] Data cached successfully');
		} catch (error) {
			log('warn', `[MODELS-DEV] Cache save warning: ${error.message}`);
		}
	}

	/**
	 * Infer allowed Task Master roles based on model capabilities
	 * @param {Object} modelData - Raw model data from models.dev
	 * @returns {string[]} Array of allowed roles
	 * @private
	 */
	_inferAllowedRoles(modelData) {
		const roles = [];
		
		// Main role: needs reasoning and tool calling for complex tasks
		if (modelData.reasoning && modelData.tool_call) {
			roles.push('main');
		}
		
		// Research role: needs reasoning but not necessarily tool calling
		if (modelData.reasoning) {
			roles.push('research');
		}
		
		// Fallback role: any model can serve as fallback
		roles.push('fallback');
		
		return roles;
	}
}

/**
 * Global service instance for convenient access
 */
export const modelsDevService = new ModelsDevService();