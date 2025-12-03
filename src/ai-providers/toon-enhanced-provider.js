/**
 * TOON-Enhanced AI Provider
 * 
 * A wrapper class that adds TOON serialization capabilities to existing AI providers.
 * This allows any existing provider to be enhanced with TOON support without 
 * modifying the original provider implementation.
 */

import { BaseAIProvider } from './base-provider.js';
import { wrapProviderWithToon, analyzeToonSuitability, getToonConfig } from '../serialization/index.js';
import { log } from '../../scripts/modules/utils.js';

/**
 * Enhance any AI provider with TOON serialization capabilities
 * @param {BaseAIProvider} provider - The original provider to enhance
 * @returns {BaseAIProvider} Enhanced provider with TOON support
 */
export function enhanceProviderWithToon(provider) {
	if (!provider || !(provider instanceof BaseAIProvider)) {
		throw new Error('Provider must be an instance of BaseAIProvider');
	}
	
	const config = getToonConfig();
	if (!config.enabled) {
		log('debug', 'TOON enhancement skipped - TOON is disabled');
		return provider;
	}
	
	log('info', `Enhancing ${provider.name} provider with TOON serialization`);
	return wrapProviderWithToon(provider);
}

/**
 * TOON-Enhanced Provider Factory
 * Creates enhanced versions of providers with TOON support
 */
export class ToonProviderFactory {
	static enhancedProviders = new Map();
	
	/**
	 * Get an enhanced version of a provider
	 * @param {string} providerName - Name of the provider
	 * @param {BaseAIProvider} provider - Provider instance to enhance
	 * @returns {BaseAIProvider} Enhanced provider
	 */
	static getEnhancedProvider(providerName, provider) {
		// Check if we already have an enhanced version cached
		if (this.enhancedProviders.has(providerName)) {
			return this.enhancedProviders.get(providerName);
		}
		
		// Create enhanced provider
		const enhanced = enhanceProviderWithToon(provider);
		
		// Cache the enhanced provider
		this.enhancedProviders.set(providerName, enhanced);
		
		return enhanced;
	}
	
	/**
	 * Clear all cached enhanced providers
	 * Useful when TOON configuration changes
	 */
	static clearCache() {
		log('debug', 'Clearing TOON enhanced provider cache');
		this.enhancedProviders.clear();
	}
	
	/**
	 * Get statistics about enhanced providers
	 * @returns {object} Statistics
	 */
	static getStats() {
		return {
			enhancedProviders: this.enhancedProviders.size,
			providerNames: Array.from(this.enhancedProviders.keys())
		};
	}
}

/**
 * Utility to test TOON effectiveness with sample data
 * @param {any} sampleData - Sample data to test TOON with
 * @param {BaseAIProvider} provider - Provider to test with
 * @returns {Promise<object>} Test results
 */
export async function testToonEffectiveness(sampleData, provider) {
	try {
		log('info', 'Testing TOON effectiveness with sample data');
		
		// Analyze suitability
		const suitability = analyzeToonSuitability(sampleData);
		
		// Create test messages with the sample data
		const testMessages = [
			{
				role: 'system',
				content: 'You are a helpful assistant.'
			},
			{
				role: 'user', 
				content: sampleData
			}
		];
		
		// Test with original provider
		const startTime = Date.now();
		const originalResult = await provider.generateText({
			messages: testMessages,
			modelId: 'test-model', // This would need to be a valid model for the provider
			maxTokens: 100
		});
		const originalTime = Date.now() - startTime;
		
		// Test with TOON-enhanced provider
		const enhancedProvider = enhanceProviderWithToon(provider);
		const enhancedStartTime = Date.now();
		const enhancedResult = await enhancedProvider.generateText({
			messages: testMessages,
			modelId: 'test-model',
			maxTokens: 100
		});
		const enhancedTime = Date.now() - enhancedStartTime;
		
		return {
			suitability,
			originalTokens: originalResult.usage.totalTokens,
			enhancedTokens: enhancedResult.usage.totalTokens,
			tokenSavings: originalResult.usage.totalTokens - enhancedResult.usage.totalTokens,
			originalTime,
			enhancedTime,
			timeDifference: enhancedTime - originalTime,
			success: true
		};
		
	} catch (error) {
		log('error', `TOON effectiveness test failed: ${error.message}`);
		return {
			success: false,
			error: error.message
		};
	}
}