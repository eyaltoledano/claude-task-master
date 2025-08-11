/**
 * @fileoverview ModelMerger - Handles merging static and dynamic model data
 * 
 * Provides deduplication, normalization, and merging logic for combining
 * static models with dynamic models.dev data.
 * Follows the specification defined in docs/SPEC-models-dev-integration.md
 */

import { log } from '../../scripts/modules/utils.js';

/**
 * Handles merging and deduplication of static and dynamic model data
 */
export class ModelMerger {
	/**
	 * Merge static models with dynamic models from models.dev
	 * @param {Array} staticModels - Models from static configuration
	 * @param {Array} dynamicModels - Models from models.dev
	 * @returns {Array} Merged and deduplicated model array
	 */
	mergeStaticAndDynamic(staticModels, dynamicModels) {
		try {
			// Normalize both arrays to common format
			const normalizedStatic = staticModels.map(model => 
				this.normalizeModelFormat(model, 'static')
			);
			
			const normalizedDynamic = dynamicModels.map(model => 
				this.normalizeModelFormat(model, 'models.dev')
			);

			// Combine arrays
			const combined = [...normalizedStatic, ...normalizedDynamic];

			// Deduplicate (prefer models.dev over static)
			const deduplicated = this.deduplicateModels(combined);

			log('info', `[MODEL-MERGER] Merged ${staticModels.length} static + ${dynamicModels.length} dynamic → ${deduplicated.length} total models`);
			
			return deduplicated;

		} catch (error) {
			log('error', `[MODEL-MERGER] Merge failed: ${error.message}, returning static models only`);
			return staticModels.map(model => this.normalizeModelFormat(model, 'static'));
		}
	}


	/**
	 * Remove duplicate models, preferring models.dev data over static
	 * @param {Array} models - Array of normalized models
	 * @returns {Array} Deduplicated model array
	 */
	deduplicateModels(models) {
		const seen = new Map();
		
		// Process models, keeping track of duplicates
		for (const model of models) {
			const key = `${model.provider}:${model.id}`;
			const existing = seen.get(key);
			
			if (!existing) {
				// First time seeing this model
				seen.set(key, model);
			} else {
				// Duplicate found - prefer models.dev over static
				if (model.source === 'models.dev' && existing.source === 'static') {
					// Replace static with dynamic
					seen.set(key, {
						...existing,  // Keep any static-only fields
						...model,     // Override with dynamic data
						source: 'models.dev'
					});
					log('debug', `[MODEL-MERGER] Upgraded ${key} from static to models.dev`);
				}
				// If both are same source or existing is already models.dev, keep existing
			}
		}
		
		return Array.from(seen.values());
	}


	/**
	 * Normalize model data to common format
	 * @param {Object} model - Raw model data
	 * @param {'static'|'models.dev'} source - Data source
	 * @returns {Object} Normalized model in common format
	 */
	normalizeModelFormat(model, source) {
		// Start with the base model data
		const normalized = {
			// Core identification
			id: model.id,
			name: model.name || this._generateModelName(model.id),
			provider: model.provider,
			source: source,
			
			// Backward compatibility fields (always present)
			swe_score: model.swe_score || null,
			cost_per_1m_tokens: this._normalizeCost(model),
			allowed_roles: model.allowed_roles || ['main', 'research', 'fallback'],
			max_tokens: model.max_tokens || null,
			
			// Dynamic fields (may be null)
			reasoning: model.reasoning || false,
			tool_call: model.tool_call || false,
			modalities: model.modalities || { input: ['text'], output: ['text'] },
			context_length: model.context_length || model.max_tokens || null,
			release_date: model.release_date || null,
			documentation: model.documentation || null,
			npm_package: model.npm_package || null,
			env_vars: model.env_vars || [],
			last_updated: model.last_updated || new Date().toISOString()
		};

		// Add provider-specific data for dynamic models
		if (source === 'models.dev') {
			normalized.provider_name = model.provider_name || model.provider;
		}

		return normalized;
	}

	/**
	 * Update static models with any available dynamic data
	 * @param {Array} staticModels - Static model array
	 * @param {Map} dynamicModelMap - Map of provider:model → dynamic data
	 * @returns {Array} Updated static models
	 */
	updateStaticModels(staticModels, dynamicModelMap) {
		return staticModels.map(staticModel => {
			const key = `${staticModel.provider}:${staticModel.id}`;
			const dynamicData = dynamicModelMap.get(key);
			
			if (dynamicData) {
				// Merge dynamic data into static model
				return {
					...staticModel,
					// Keep static data as base
					// Add dynamic data
					reasoning: dynamicData.reasoning !== undefined ? dynamicData.reasoning : staticModel.reasoning,
					tool_call: dynamicData.tool_call !== undefined ? dynamicData.tool_call : staticModel.tool_call,
					context_length: dynamicData.context_length || staticModel.context_length,
					cost_per_1m_tokens: this._mergeCosts(staticModel.cost_per_1m_tokens, dynamicData.cost_per_1m_tokens),
					modalities: dynamicData.modalities || staticModel.modalities,
					documentation: dynamicData.documentation || staticModel.documentation,
					// Mark as updated
					source: 'static+dynamic'
				};
			}
			
			return this.normalizeModelFormat(staticModel, 'static');
		});
	}

	// Private helper methods

	/**
	 * Generate a human-readable model name from ID
	 * @param {string} modelId - Model identifier
	 * @returns {string} Generated name
	 * @private
	 */
	_generateModelName(modelId) {
		// Handle common patterns
		const patterns = [
			{ regex: /^claude-3\.5-sonnet/, replacement: 'Claude 3.5 Sonnet' },
			{ regex: /^claude-3-opus/, replacement: 'Claude 3 Opus' },
			{ regex: /^gpt-4o/, replacement: 'GPT-4 Omni' },
			{ regex: /^gpt-4-turbo/, replacement: 'GPT-4 Turbo' },
			{ regex: /^gemini-\d+\.?\d*-pro/, replacement: 'Gemini Pro' },
			{ regex: /^llama-\d+/, replacement: 'Llama' }
		];

		for (const { regex, replacement } of patterns) {
			if (regex.test(modelId)) {
				return replacement;
			}
		}

		// Fallback: capitalize and replace dashes/underscores
		return modelId
			.split(/[-_]/)
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Normalize cost data to consistent format
	 * @param {Object} model - Model with potential cost data
	 * @returns {Object|null} Normalized cost object
	 * @private
	 */
	_normalizeCost(model) {
		// Handle different cost formats
		if (model.cost_per_1m_tokens) {
			return {
				input: model.cost_per_1m_tokens.input || 0,
				output: model.cost_per_1m_tokens.output || 0
			};
		}
		
		if (model.cost) {
			return {
				input: model.cost.input || 0,
				output: model.cost.output || 0
			};
		}
		
		return null;
	}

	/**
	 * Merge cost information, preferring more complete data
	 * @param {Object|null} staticCost - Static cost data
	 * @param {Object|null} dynamicCost - Dynamic cost data
	 * @returns {Object|null} Merged cost data
	 * @private
	 */
	_mergeCosts(staticCost, dynamicCost) {
		if (!staticCost && !dynamicCost) return null;
		if (!staticCost) return dynamicCost;
		if (!dynamicCost) return staticCost;
		
		// Prefer dynamic data but fill gaps with static data
		return {
			input: dynamicCost.input !== undefined ? dynamicCost.input : staticCost.input,
			output: dynamicCost.output !== undefined ? dynamicCost.output : staticCost.output
		};
	}
}

/**
 * Global merger instance
 */
export const modelMerger = new ModelMerger();