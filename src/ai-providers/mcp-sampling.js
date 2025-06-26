/**
 * src/ai-providers/mcp-sampling.js
 *
 * Implementation for interacting with AI models via MCP Sampling
 * using a custom AI SDK implementation.
 */

import { createMcpSampling } from './custom-sdk/mcp-sampling/index.js';
import { BaseAIProvider } from './base-provider.js';

export class McpSamplingProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'MCP Sampling';
	}

	/**
	 * Override validateAuth to check for MCP session instead of API key
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// MCP Sampling requires a session, not an API key
		// The session validation happens in the language model itself
		// Here we just skip the default API key check
	}

	/**
	 * Creates and returns a MCP Sampling client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {object} [params.session] - MCP session with sampling capabilities
	 * @param {string} [params.baseURL] - Not used by MCP Sampling
	 * @returns {Function} MCP Sampling client function
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
			// Create the provider with session and other settings
			return createMcpSampling({
				defaultSettings: {
					session: params.session,
					timeout: params.timeout || 120000,
					includeContext: params.includeContext || 'thisServer',
					// Pass through any other settings
					...(params.settings || {})
				}
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
