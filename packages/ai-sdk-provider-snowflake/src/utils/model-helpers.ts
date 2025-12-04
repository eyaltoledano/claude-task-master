/**
 * Model-specific utility functions for Cortex Code Provider
 * 
 * This module provides helper functions for working with different Cortex models,
 * including capability detection and model ID normalization.
 */

/**
 * Model utility class with static helper methods
 */
export class ModelHelpers {
	/**
	 * Check if a model ID supports native structured outputs
	 * 
	 * Only OpenAI and Claude models in Snowflake Cortex support structured outputs.
	 * Other models (Llama, Mistral, etc.) will fall back to JSON mode.
	 * 
	 * @param modelId - Model identifier (e.g., 'cortex/claude-sonnet-4-5', 'claude-haiku-4-5')
	 * @returns True if model supports structured outputs
	 */
	static supportsStructuredOutputs(modelId: string): boolean {
		if (!modelId || typeof modelId !== 'string') {
			return false;
		}

		const normalized = modelId.toLowerCase();
		return (
			normalized.includes('openai') ||
			normalized.includes('claude') ||
			normalized.includes('gpt-')
		);
	}

	/**
	 * Check if a model ID supports temperature parameter
	 * 
	 * OpenAI models in Snowflake Cortex don't support the temperature parameter
	 * when using structured outputs.
	 * 
	 * @param modelId - Model identifier
	 * @param isStructuredOutput - Whether this is for structured output generation
	 * @returns True if model supports temperature
	 */
	static supportsTemperature(
		modelId: string,
		isStructuredOutput = false
	): boolean {
		if (!modelId || typeof modelId !== 'string') {
			return true; // Default to allowing temperature
		}

		const normalized = modelId.toLowerCase();

		// OpenAI models don't support temperature with structured outputs
		if (normalized.includes('openai') && isStructuredOutput) {
			return false;
		}

		return true;
	}

	/**
	 * Normalize model ID by removing provider prefixes and converting to lowercase
	 * 
	 * @param modelId - Model identifier (e.g., 'cortex/claude-sonnet-4-5', 'CLAUDE-SONNET-4-5')
	 * @returns Normalized model ID (e.g., 'claude-sonnet-4-5')
	 */
	static normalizeModelId(modelId: string): string {
		if (!modelId || typeof modelId !== 'string') {
			return modelId;
		}

		const withoutPrefix = modelId.startsWith('cortex/')
			? modelId.substring(7)
			: modelId;
		return withoutPrefix.toLowerCase();
	}

	/**
	 * Get a warning message for unsupported structured outputs
	 * 
	 * @param modelId - Model identifier
	 * @returns Warning message
	 */
	static getUnsupportedStructuredOutputsWarning(modelId: string): string {
		return (
			`Model '${modelId}' does not support structured outputs. ` +
			`Attempting JSON mode fallback. For best results, use OpenAI or Claude models.`
		);
	}
}

