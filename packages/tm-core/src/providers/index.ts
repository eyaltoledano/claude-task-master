/**
 * @fileoverview AI provider implementations for the tm-core package
 * This file exports all AI provider classes and interfaces
 */

// Provider interfaces and implementations
export * from './base-provider.js';
// export * from './anthropic-provider.js';
// export * from './openai-provider.js';
// export * from './perplexity-provider.js';

// Placeholder exports - these will be implemented in later tasks
export interface AIProvider {
	name: string;
	generateResponse(prompt: string): Promise<string>;
}

/**
 * @deprecated This is a placeholder class that will be properly implemented in later tasks
 */
export class PlaceholderProvider implements AIProvider {
	name = 'placeholder';

	async generateResponse(prompt: string): Promise<string> {
		return `Placeholder response for: ${prompt}`;
	}
}
