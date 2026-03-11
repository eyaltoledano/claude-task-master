/**
 * google-vertex-anthropic.js
 * AI provider implementation for Anthropic models on Google Vertex AI using Vercel AI SDK.
 * This provider uses the createVertexAnthropic client to route requests to the
 * publishers/anthropic endpoint instead of publishers/google.
 */

import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { resolveEnvVariable } from '../../scripts/modules/utils.js';
import { log } from '../../scripts/modules/utils.js';
import { BaseAIProvider } from './base-provider.js';

// Vertex Anthropic-specific error classes
class VertexAnthropicAuthError extends Error {
	constructor(message) {
		super(message);
		this.name = 'VertexAnthropicAuthError';
		this.code = 'vertex_anthropic_auth_error';
	}
}

class VertexAnthropicConfigError extends Error {
	constructor(message) {
		super(message);
		this.name = 'VertexAnthropicConfigError';
		this.code = 'vertex_anthropic_config_error';
	}
}

class VertexAnthropicApiError extends Error {
	constructor(message, statusCode) {
		super(message);
		this.name = 'VertexAnthropicApiError';
		this.code = 'vertex_anthropic_api_error';
		this.statusCode = statusCode;
	}
}

export class VertexAnthropicProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Google Vertex AI (Anthropic)';
	}

	/**
	 * Returns the required API key environment variable name for Vertex AI Anthropic.
	 * @returns {string} The environment variable name
	 */
	getRequiredApiKeyName() {
		return 'GOOGLE_API_KEY';
	}

	/**
	 * API key is optional, Service Account credentials can be used instead.
	 * @returns {boolean}
	 */
	isRequiredApiKey() {
		return false;
	}

	/**
	 * API key or Service Account is mandatory.
	 * @returns {boolean}
	 */
	isAuthenticationRequired() {
		return true;
	}

	/**
	 * Validates that a credential value is present and non-empty.
	 * @private
	 * @param {string|object|null|undefined} value
	 * @returns {boolean}
	 */
	isValidCredential(value) {
		if (!value) return false;
		if (typeof value === 'string') {
			return value.trim().length > 0;
		}
		return typeof value === 'object';
	}

	/**
	 * Validates Vertex AI Anthropic-specific authentication parameters
	 * @param {object} params - Parameters to validate
	 * @throws {VertexAnthropicAuthError|VertexAnthropicConfigError}
	 */
	validateAuth(params) {
		const { apiKey, projectId, location, credentials } = params;

		// Check for API key OR service account credentials
		const hasValidApiKey = this.isValidCredential(apiKey);
		const hasValidCredentials = this.isValidCredential(credentials);

		if (!hasValidApiKey && !hasValidCredentials) {
			throw new VertexAnthropicAuthError(
				'Vertex AI (Anthropic) requires authentication. Provide one of the following:\n' +
					'  • GOOGLE_API_KEY environment variable (typical for API-based auth), OR\n' +
					'  • GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON file (recommended for production)'
			);
		}

		// Project ID is required for Vertex AI
		if (
			!projectId ||
			(typeof projectId === 'string' && projectId.trim().length === 0)
		) {
			throw new VertexAnthropicConfigError(
				'Google Cloud project ID is required for Vertex AI. Set VERTEX_PROJECT_ID environment variable.'
			);
		}

		// Location is required for Vertex AI
		if (
			!location ||
			(typeof location === 'string' && location.trim().length === 0)
		) {
			throw new VertexAnthropicConfigError(
				'Google Cloud location is required for Vertex AI. Set VERTEX_LOCATION environment variable (e.g., "us-central1").'
			);
		}
	}

	/**
	 * Creates and returns a Google Vertex AI Anthropic client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.apiKey] - Google API key
	 * @param {string} params.projectId - Google Cloud project ID
	 * @param {string} params.location - Google Cloud location (e.g., "us-central1")
	 * @param {object} [params.credentials] - Service account credentials object
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} Google Vertex AI Anthropic client function
	 * @throws {Error} If required parameters are missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, projectId, location, credentials, baseURL } = params;
			const fetchImpl = this.createProxyFetch();

			// Configure auth options - either API key or service account
			const authOptions = {};
			if (apiKey) {
				// Vercel AI SDK expects googleAuthOptions even when using apiKey for some configurations
				authOptions.googleAuthOptions = {
					...credentials,
					apiKey
				};
			} else if (credentials) {
				authOptions.googleAuthOptions = credentials;
			}

			// Return Vertex AI Anthropic client
			return createVertexAnthropic({
				...authOptions,
				project: projectId,
				location,
				...(baseURL && { baseURL }),
				...(fetchImpl && { fetch: fetchImpl })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}

	/**
	 * Handle errors from Vertex AI Anthropic
	 * @param {string} operation - Description of the operation that failed
	 * @param {Error} error - The error object
	 * @throws {Error} Rethrows the error with additional context
	 */
	handleError(operation, error) {
		log('error', `Vertex AI (Anthropic) ${operation} error:`, error);

		// Handle known error types
		if (
			error.name === 'VertexAnthropicAuthError' ||
			error.name === 'VertexAnthropicConfigError' ||
			error.name === 'VertexAnthropicApiError'
		) {
			throw error;
		}

		// Handle network/API errors
		if (error.response) {
			const statusCode = error.response.status;
			const errorMessage = error.response.data?.error?.message || error.message;

			// Categorize by status code
			if (statusCode === 401 || statusCode === 403) {
				throw new VertexAnthropicAuthError(`Authentication failed: ${errorMessage}`);
			} else if (statusCode === 400) {
				throw new VertexAnthropicConfigError(`Invalid request: ${errorMessage}`);
			} else {
				throw new VertexAnthropicApiError(
					`API error (${statusCode}): ${errorMessage}`,
					statusCode
				);
			}
		}

		// Generic error handling
		throw new Error(`Vertex AI (Anthropic) ${operation} failed: ${error.message}`);
	}
}
