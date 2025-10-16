/**
 * src/ai-providers/codex-cli.js
 *
 * Codex CLI provider implementation using the ai-sdk-provider-codex-cli package.
 * This provider uses the local OpenAI Codex CLI with OAuth (preferred) or
 * an optional OPENAI_CODEX_API_KEY if provided.
 */

import { createCodexCli } from 'ai-sdk-provider-codex-cli';
import { BaseAIProvider } from './base-provider.js';
import { execSync } from 'child_process';
import { log } from '../../scripts/modules/utils.js';
import {
	getCodexCliSettingsForCommand,
	getSupportedModelsForProvider
} from '../../scripts/modules/config-manager.js';

export class CodexCliProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Codex CLI';
		// Codex CLI has native schema support, no explicit JSON schema mode required
		this.needsExplicitJsonSchema = false;
		// Codex CLI does not support temperature parameter
		this.supportsTemperature = false;
		// Load supported models from supported-models.json
		this.supportedModels = getSupportedModelsForProvider('codex-cli');

		// Validate that models were loaded successfully
		if (this.supportedModels.length === 0) {
			log(
				'warn',
				'No supported models found for codex-cli provider. Check supported-models.json configuration.'
			);
		}

		// CLI availability check cache
		this._codexCliChecked = false;
		this._codexCliAvailable = null;
	}

	/**
	 * Codex CLI does not require an API key when using OAuth via `codex login`.
	 * @returns {boolean}
	 */
	isRequiredApiKey() {
		return false;
	}

	/**
	 * Returns the environment variable name used when an API key is provided.
	 * Even though the API key is optional for Codex CLI (OAuth-first),
	 * downstream resolution expects a non-throwing implementation.
	 * Uses OPENAI_CODEX_API_KEY to avoid conflicts with OpenAI provider.
	 * @returns {string}
	 */
	getRequiredApiKeyName() {
		return 'OPENAI_CODEX_API_KEY';
	}

	/**
	 * Optional CLI availability check; provide helpful guidance if missing.
	 */
	validateAuth() {
		if (process.env.NODE_ENV === 'test') return;

		if (!this._codexCliChecked) {
			try {
				execSync('codex --version', { stdio: 'pipe', timeout: 1000 });
				this._codexCliAvailable = true;
			} catch (error) {
				this._codexCliAvailable = false;
				log(
					'warn',
					'Codex CLI not detected. Install with: npm i -g @openai/codex or enable fallback with allowNpx.'
				);
			} finally {
				this._codexCliChecked = true;
			}
		}
	}

	/**
	 * Creates a Codex CLI client instance
	 * @param {object} params
	 * @param {string} [params.commandName] - Command name for settings lookup
	 * @param {string} [params.apiKey] - Optional API key (injected as OPENAI_API_KEY for Codex CLI)
	 * @returns {Function}
	 */
	getClient(params = {}) {
		try {
			// Merge global + command-specific settings from config
			const settings = getCodexCliSettingsForCommand(params.commandName) || {};

			// Inject API key only if explicitly provided; OAuth is the primary path
			const defaultSettings = {
				...settings,
				...(params.apiKey
					? { env: { ...(settings.env || {}), OPENAI_API_KEY: params.apiKey } }
					: {})
			};

			return createCodexCli({ defaultSettings });
		} catch (error) {
			const msg = String(error?.message || '');
			const code = error?.code;
			if (code === 'ENOENT' || /codex/i.test(msg)) {
				const enhancedError = new Error(
					`Codex CLI not available. Please install Codex CLI first. Original error: ${error.message}`
				);
				enhancedError.cause = error;
				this.handleError('Codex CLI initialization', enhancedError);
			} else {
				this.handleError('client initialization', error);
			}
		}
	}
}
