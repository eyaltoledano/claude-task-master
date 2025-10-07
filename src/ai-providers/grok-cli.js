/**
 * grok-cli.js
 * AI provider implementation for Grok models using Grok CLI.
 */

import { createGrokCli } from '@tm/ai-sdk-provider-grok-cli';
import { BaseAIProvider } from './base-provider.js';
import { getGrokCliSettingsForCommand } from '../../scripts/modules/config-manager.js';

export class GrokCliProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Grok CLI';
		// Grok CLI requires explicit JSON schema mode
		this.needsExplicitJsonSchema = true;
		// Grok CLI does not support temperature parameter
		this.supportsTemperature = false;
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the Grok API key
	 */
	getRequiredApiKeyName() {
		return 'GROK_CLI_API_KEY';
	}

	/**
	 * Override to indicate that API key is optional since Grok CLI can be configured separately
	 * @returns {boolean} False since Grok CLI can use its own config
	 */
	isRequiredApiKey() {
		return false; // Grok CLI can use its own config file
	}

	/**
	 * Override validateAuth to be more flexible with API key validation
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Grok CLI can work with:
		// 1. API key passed in params
		// 2. Environment variable GROK_CLI_API_KEY
		// 3. Grok CLI's own config file (~/.grok/user-settings.json)
		// So we don't enforce API key requirement here
		// Suppress unused parameter warning
		void params;
	}

	/**
	 * Creates and returns a Grok CLI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.apiKey] - Grok CLI API key (optional if configured in CLI)
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @param {string} [params.workingDirectory] - Working directory for CLI commands
	 * @param {number} [params.timeout] - Timeout for CLI commands in milliseconds
	 * @param {string} [params.commandName] - Name of the command invoking the service
	 * @returns {Function} Grok CLI client function
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL, workingDirectory, timeout, commandName } =
				params;

			// Get Grok CLI settings from config
			const grokCliSettings = getGrokCliSettingsForCommand(commandName);

			return createGrokCli({
				defaultSettings: {
					apiKey,
					baseURL,
					workingDirectory:
						workingDirectory || grokCliSettings.workingDirectory,
					timeout: timeout || grokCliSettings.timeout,
					defaultModel: grokCliSettings.defaultModel
				}
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
