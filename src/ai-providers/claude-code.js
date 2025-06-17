/**
 * src/ai-providers/claude-code.js
 *
 * Implementation for interacting with Claude models via Claude Code CLI
 * using a custom AI SDK implementation.
 */

import { createClaudeCode } from './custom-sdk/claude-code/index.js';
import { BaseAIProvider } from './base-provider.js';

export class ClaudeCodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Claude Code';
	}

	/**
	 * Override validateAuth to skip API key validation for Claude Code
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Claude Code doesn't require an API key
		// No validation needed
	}

	/**
	 * Creates and returns a Claude Code client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.baseURL] - Optional custom API endpoint (not used by Claude Code)
	 * @returns {Function} Claude Code client function
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
			// Claude Code doesn't use API keys or base URLs
			// Just return the provider factory
			return createClaudeCode({
				defaultSettings: {
					// Add any default settings if needed
					// These can be overridden per request
				}
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
