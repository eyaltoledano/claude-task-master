/**
 * src/ai-providers/opencode.js
 *
 * OpenCode provider implementation using the ai-sdk-provider-opencode-sdk package.
 * Delegates model selection, authentication, and provider routing to a running
 * OpenCode server. Task Master stays agnostic about which underlying LLM (Anthropic,
 * OpenAI, GitHub Copilot, etc.) OpenCode is configured to use.
 *
 * Authentication:
 * - Managed entirely by OpenCode — no API key required on the Task Master side.
 * - OpenCode users configure their providers via `opencode auth` or the config file.
 *
 * Model IDs follow the "providerID/modelID" format (e.g., "anthropic/claude-opus-4-5"),
 * or a bare "modelID" that routes to OpenCode's default provider.
 *
 * Troubleshooting:
 * - If calls fail with "Unexpected end of JSON input", the configured model ID is
 *   almost certainly not available in the local OpenCode install. Run
 *   `opencode models` to see valid IDs for your authenticated backends. Note that
 *   GitHub Copilot names its GPT-5 model as "gpt-5.2" (not "gpt-5"), and the
 *   "openai/*" provider prefix only works if OpenCode has direct OpenAI auth.
 * - If calls fail with "terminated", the underlying HTTP request was cut off
 *   mid-response. This is common with reasoning models (e.g., gpt-5.2) that take
 *   longer than the default server timeout. Increase `serverTimeout` in the
 *   `opencode` section of `.taskmaster/config.json`.
 */

import { execSync } from 'child_process';
import { createOpencode } from 'ai-sdk-provider-opencode-sdk';
import {
	getOpencodeSettingsForCommand,
	getSupportedModelsForProvider
} from '../../scripts/modules/config-manager.js';
import { log } from '../../scripts/modules/utils.js';
import { BaseAIProvider } from './base-provider.js';

export class OpencodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'OpenCode';
		const configuredModels = getSupportedModelsForProvider('opencode');
		this.supportedModels = Array.isArray(configuredModels)
			? configuredModels
			: [];

		if (this.supportedModels.length === 0) {
			log(
				'warn',
				'No supported models found for opencode provider. Check supported-models.json configuration.'
			);
		}

		this.needsExplicitJsonSchema = true;
		this.supportsTemperature = false;

		this._opencodeCliChecked = false;
		this._opencodeCliAvailable = null;
	}

	/**
	 * OpenCode manages its own provider credentials; no Task Master API key is needed.
	 * @returns {boolean}
	 */
	isRequiredApiKey() {
		return false;
	}

	/**
	 * Not used — OpenCode handles authentication. Returned for interface compatibility.
	 * @returns {string}
	 */
	getRequiredApiKeyName() {
		return 'OPENCODE_API_KEY';
	}

	/**
	 * Optional CLI availability check. The SDK can auto-start an OpenCode server,
	 * but surfacing a missing CLI early gives clearer guidance.
	 */
	validateAuth() {
		if (process.env.NODE_ENV === 'test') return;

		if (!this._opencodeCliChecked) {
			try {
				execSync('opencode --version', { stdio: 'pipe', timeout: 1000 });
				this._opencodeCliAvailable = true;
			} catch (error) {
				this._opencodeCliAvailable = false;
				log(
					'warn',
					'OpenCode CLI not detected. Install it from: https://opencode.ai'
				);
			} finally {
				this._opencodeCliChecked = true;
			}
		}
	}

	/**
	 * Creates an OpenCode client instance.
	 * @param {object} params
	 * @param {string} [params.commandName] - Command name for settings lookup
	 * @returns {Function} OpenCode provider function
	 */
	getClient(params = {}) {
		try {
			const settings = getOpencodeSettingsForCommand(params.commandName) || {};

			return createOpencode(settings);
		} catch (error) {
			const msg = String(error?.message || '');
			const code = error?.code;
			const missingCli =
				code === 'ENOENT' ||
				/spawn opencode ENOENT|opencode: command not found|command failed: opencode/i.test(
					msg
				);
			if (missingCli) {
				const enhancedError = new Error(
					`OpenCode not available. Install it from: https://opencode.ai - Original error: ${error.message}`
				);
				enhancedError.cause = error;
				this.handleError('OpenCode initialization', enhancedError);
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
	 * Check if a model is supported.
	 * @param {string} modelId
	 * @returns {boolean}
	 */
	isModelSupported(modelId) {
		if (!modelId) return false;
		const needle = String(modelId).toLowerCase();
		return this.supportedModels.some((m) => String(m).toLowerCase() === needle);
	}
}
