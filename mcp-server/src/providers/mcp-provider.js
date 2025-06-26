/**
 * mcp-server/src/providers/mcp-provider.js
 *
 * Implementation for MCP custom AI SDK provider that integrates with
 * the existing MCP server infrastructure and provider registry.
 * Follows the Claude Code provider pattern for session-based providers.
 */

import { createMCP } from '../custom-sdk/index.js';
import { BaseAIProvider } from '../../../src/ai-providers/base-provider.js';

export class MCPProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'mcp';
		this.session = null; // MCP server session object
	}

	getRequiredApiKeyName() {
		return 'MCP_API_KEY';
	}

	isRequiredApiKey() {
		return false;
	}

	/**
	 * Override validateAuth to validate MCP session instead of API key
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Validate MCP session instead of API key
		if (!this.session) {
			throw new Error('MCP Provider requires active MCP session');
		}

		if (!this.session.clientCapabilities?.sampling) {
			throw new Error('MCP session must have client sampling capabilities');
		}
	}

	/**
	 * Creates and returns an MCP AI SDK client instance.
	 * @param {object} params - Parameters for client initialization
	 * @returns {Function} MCP AI SDK client function
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
			// Pass MCP session to AI SDK implementation
			return createMCP({
				session: this.session,
				defaultSettings: {
					temperature: params.temperature,
					maxTokens: params.maxTokens
				}
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}

	/**
	 * Method called by MCP server on connect events
	 * @param {object} session - MCP session object
	 */
	setSession(session) {
		this.session = session;

		if (!session) {
			this.logger?.warn('Set null session on MCP Provider');
		} else {
			this.logger?.debug('Updated MCP Provider session');
		}
	}

	/**
	 * Get current session status
	 * @returns {boolean} True if session is available and valid
	 */
	hasValidSession() {
		return !!(this.session && this.session.clientCapabilities?.sampling);
	}
}
