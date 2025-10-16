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
import {
	getClaudeCodeSettingsForCommand,
	getSupportedModelsForProvider
} from '../../scripts/modules/config-manager.js';
import { execSync } from 'child_process';
import { log } from '../../scripts/modules/utils.js';

let _claudeCliChecked = false;
let _claudeCliAvailable = null;

/**
 * Provider for Claude Code CLI integration via AI SDK
 *
 * Features:
 * - No API key required (uses local Claude Code CLI)
 * - Supported models loaded from supported-models.json
 * - Command-specific configuration support
 */
export class ClaudeCodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Claude Code';
		// Load supported models from supported-models.json
		this.supportedModels = getSupportedModelsForProvider('claude-code');

		// Validate that models were loaded successfully
		if (this.supportedModels.length === 0) {
			log(
				'warn',
				'No supported models found for claude-code provider. Check supported-models.json configuration.'
			);
		}

		// Claude Code requires explicit JSON schema mode
		this.needsExplicitJsonSchema = true;
		// Claude Code does not support temperature parameter
		this.supportsTemperature = false;
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
	 * Optional CLI availability check for Claude Code
	 * @param {object} params - Parameters (ignored)
	 */
	validateAuth(params) {
		// Claude Code uses local CLI - perform lightweight availability check
		// This is optional validation that fails fast with actionable guidance
		if (
			process.env.NODE_ENV !== 'test' &&
			!_claudeCliChecked &&
			!process.env.CLAUDE_CODE_OAUTH_TOKEN
		) {
			try {
				execSync('claude --version', { stdio: 'pipe', timeout: 1000 });
				_claudeCliAvailable = true;
			} catch (error) {
				_claudeCliAvailable = false;
				log(
					'warn',
					'Claude Code CLI not detected. Install it with: npm install -g @anthropic-ai/claude-code'
				);
			} finally {
				_claudeCliChecked = true;
			}
		}
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
			const settings =
				getClaudeCodeSettingsForCommand(params.commandName) || {};

			return createClaudeCode({
				defaultSettings: settings
			});
		} catch (error) {
			// Provide more helpful error message
			const msg = String(error?.message || '');
			const code = error?.code;
			if (code === 'ENOENT' || /claude/i.test(msg)) {
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
		if (!modelId) return false;
		return this.supportedModels.includes(String(modelId).toLowerCase());
	}
}
