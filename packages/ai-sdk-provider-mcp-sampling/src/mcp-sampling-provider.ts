/**
 * MCP Sampling Provider for AI SDK v5
 */

import type { LanguageModelV2 } from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';

import { MCPSamplingLanguageModel } from './mcp-sampling-language-model.js';
import type {
	MCPSamplingModelId,
	MCPSamplingSettings,
	MCPSession
} from './types.js';

/**
 * Create an MCP Sampling provider instance
 */
export function createMCPSampling(options: {
	session: MCPSession;
	defaultSettings?: MCPSamplingSettings;
}) {
	if (!options.session) {
		throw new Error('MCP session is required');
	}

	/**
	 * Create an MCP Sampling language model
	 */
	function languageModel(
		modelId: MCPSamplingModelId,
		settings?: MCPSamplingSettings
	): LanguageModelV2 {
		if (new.target) {
			throw new Error(
				'The MCP Sampling model function cannot be called with the new keyword.'
			);
		}

		// Validate model ID
		if (!modelId || typeof modelId !== 'string' || modelId.trim() === '') {
			throw new NoSuchModelError({
				modelId: modelId || 'undefined',
				modelType: 'languageModel'
			});
		}

		return new MCPSamplingLanguageModel({
			id: modelId,
			settings: {
				...options.defaultSettings,
				...settings
			},
			session: options.session
		});
	}

	const provider = languageModel;

	// Add required provider methods
	provider.languageModel = languageModel;
	provider.chat = languageModel; // Alias for compatibility

	return provider;
}