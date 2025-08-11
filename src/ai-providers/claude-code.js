/**
 * src/ai-providers/claude-code.js
 *
 * Claude Code provider implementation using the ai-sdk-provider-claude-code package.
 * This provider uses the local Claude Code CLI with OAuth token authentication.
 * 
 * Authentication:
 * - Uses CLAUDE_CODE_OAUTH_TOKEN managed by Claude Code CLI
 * - Token is set up via: claude setup-token
 * - No manual API key configuration required
 */

import { createClaudeCode } from 'ai-sdk-provider-claude-code';
import { BaseAIProvider } from './base-provider.js';
import { getClaudeCodeSettingsForCommand } from '../../scripts/modules/config-manager.js';

/**
 * Provider for Claude Code CLI integration via AI SDK
 * 
 * Features:
 * - No API key required (uses local Claude Code CLI)
 * - Supports 'sonnet' and 'opus' models
 * - Command-specific configuration support
 */
export class ClaudeCodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Claude Code';
		this.supportedModels = ['sonnet', 'opus'];
	}

	/**
	 * @returns {string} The environment variable name for API key (not used)
	 */
	getRequiredApiKeyName() {
		return 'CLAUDE_CODE_API_KEY';
	}

	/**
	 * @returns {boolean} False - Claude Code doesn't require API keys
	 */
	isRequiredApiKey() {
		return false;
	}

	/**
	 * No authentication validation needed for Claude Code
	 * @param {object} params - Parameters (ignored)
	 */
	validateAuth(params) {
		// Claude Code uses local CLI - no API key validation needed
	}

	/**
	 * Creates a Claude Code client instance
	 * @param {object} params - Client parameters
	 * @param {string} [params.commandName] - Command name for settings lookup
	 * @returns {Function} Claude Code provider function
	 * @throws {Error} If Claude Code CLI is not available or client creation fails
	 */
	getClient(params = {}) {
		try {
			const settings = getClaudeCodeSettingsForCommand(params.commandName);
			
			return createClaudeCode({
				defaultSettings: settings
			});
		} catch (error) {
			// Provide more helpful error message
			if (error.message.includes('Claude Code') || error.message.includes('claude')) {
				const enhancedError = new Error(
					`Claude Code CLI not available. Please install Claude Code CLI first. Original error: ${error.message}`
				);
				enhancedError.cause = error;
				this.handleError('Claude Code CLI initialization', enhancedError);
			} else {
				this.handleError('client initialization', error);
			}
		}
	}

	/**
	 * @returns {string[]} List of supported model IDs
	 */
	getSupportedModels() {
		return this.supportedModels;
	}

	/**
	 * Check if a model is supported
	 * @param {string} modelId - Model ID to check
	 * @returns {boolean} True if supported
	 */
	isModelSupported(modelId) {
		return this.supportedModels.includes(modelId);
	}
}
