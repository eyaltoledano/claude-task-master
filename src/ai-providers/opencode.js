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
 */

import { execSync } from 'child_process';
import {
	getOpencodeSettingsForCommand,
	getSupportedModelsForProvider
} from '../../scripts/modules/config-manager.js';
import { log } from '../../scripts/modules/utils.js';
import { BaseAIProvider } from './base-provider.js';

// Lazy-loaded to avoid crashing task-master on startup if the SDK has
// environment-specific incompatibilities (e.g., ai-sdk-provider-opencode-sdk
// 0.0.2 evaluates zod v3 APIs at module-load time and fails under zod v4).
// Users who never select opencode as a provider are unaffected.
let _createOpencode = null;
async function _loadCreateOpencode() {
	if (!_createOpencode) {
		const mod = await import('ai-sdk-provider-opencode-sdk');
		_createOpencode = mod.createOpencode;
	}
	return _createOpencode;
}

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
	async getClient(params = {}) {
		try {
			const settings = getOpencodeSettingsForCommand(params.commandName) || {};
			const createOpencode = await _loadCreateOpencode();

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
		return this.supportedModels.includes(String(modelId).toLowerCase());
	}
}
