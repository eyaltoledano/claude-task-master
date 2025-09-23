/**
 * src/ai-providers/claude-code.js
 *
 * Implementation for interacting with Claude models via Claude Code CLI
 * using a custom AI SDK implementation.
 */

import { createClaudeCode } from './custom-sdk/claude-code/index.js';
import { BaseAIProvider } from './base-provider.js';
import { getClaudeCodeSettingsForCommand } from '../../scripts/modules/config-manager.js';

export class ClaudeCodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Claude Code';
	}

	getRequiredApiKeyName() {
		return 'CLAUDE_CODE_API_KEY';
	}

	isRequiredApiKey() {
		return false;
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
	 * @param {string} [params.commandName] - Name of the command invoking the service
	 * @param {string} [params.baseURL] - Optional custom API endpoint (not used by Claude Code)
	 * @returns {Function} Claude Code client function
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
			// Claude Code doesn't use API keys or base URLs
			// Just return the provider factory
			return createClaudeCode({
				defaultSettings: getClaudeCodeSettingsForCommand(params?.commandName)
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
