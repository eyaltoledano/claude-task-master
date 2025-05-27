/**
 * google-vertex.js
 * AI provider implementation for Google Vertex AI models using Vercel AI SDK.
 */

import { createVertex } from '@ai-sdk/google-vertex';
import { BaseAIProvider } from './base-provider.js';
import { resolveEnvVariable } from '../../scripts/modules/utils.js';
import { log } from '../../scripts/modules/utils.js';

// Vertex-specific error classes
class VertexAuthError extends Error {
	constructor(message) {
		super(message);
		this.name = 'VertexAuthError';
		this.code = 'vertex_auth_error';
	}
}

class VertexConfigError extends Error {
	constructor(message) {
		super(message);
		this.name = 'VertexConfigError';
		this.code = 'vertex_config_error';
	}
}

class VertexApiError extends Error {
	constructor(message, statusCode) {
		super(message);
		this.name = 'VertexApiError';
		this.code = 'vertex_api_error';
		this.statusCode = statusCode;
	}
}

export class VertexAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Google Vertex AI';
	}

	/**
	 * Validates Vertex AI-specific authentication parameters
	 * @param {object} params - Parameters to validate
	 * @throws {Error} If required parameters are missing
	 */
	validateAuth(params) {
		const { apiKey, projectId, location, credentials } = params;

		// Check for API key OR service account credentials
		if (!apiKey && !credentials) {
			throw new VertexAuthError(
				'Either Google API key (GOOGLE_API_KEY) or service account credentials (GOOGLE_APPLICATION_CREDENTIALS) is required for Vertex AI'
			);
		}

		// Project ID is required for Vertex AI
		if (!projectId) {
			throw new VertexConfigError(
				'Google Cloud project ID is required for Vertex AI. Set VERTEX_PROJECT_ID environment variable.'
			);
		}

		// Location is required for Vertex AI
		if (!location) {
			throw new VertexConfigError(
				'Google Cloud location is required for Vertex AI. Set VERTEX_LOCATION environment variable (e.g., "us-central1").'
			);
		}
	}

	/**
	 * Creates and returns a Google Vertex AI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.apiKey] - Google API key
	 * @param {string} params.projectId - Google Cloud project ID
	 * @param {string} params.location - Google Cloud location (e.g., "us-central1")
	 * @param {object} [params.credentials] - Service account credentials object
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} Google Vertex AI client function
	 * @throws {Error} If required parameters are missing or initialization fails
	 */
	getClient(params) {
		try {
			// Validate required parameters
			this.validateAuth(params);

			const { apiKey, projectId, location, credentials, baseURL } = params;

			// Configure auth options - either API key or service account
			const authOptions = {};
			if (apiKey) {
				authOptions.apiKey = apiKey;
			} else if (credentials) {
				authOptions.googleAuthOptions = credentials;
			}

			// Return Vertex AI client
			return createVertex({
				...authOptions,
				projectId,
				location,
				...(baseURL && { baseURL })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}

	/**
	 * Handle errors from Vertex AI
	 * @param {string} operation - Description of the operation that failed
	 * @param {Error} error - The error object
	 * @throws {Error} Rethrows the error with additional context
	 */
	handleError(operation, error) {
		log('error', `Vertex AI ${operation} error:`, error);

		// Handle known error types
		if (
			error.name === 'VertexAuthError' ||
			error.name === 'VertexConfigError' ||
			error.name === 'VertexApiError'
		) {
			throw error;
		}

		// Handle network/API errors
		if (error.response) {
			const statusCode = error.response.status;
			const errorMessage = error.response.data?.error?.message || error.message;

			// Categorize by status code
			if (statusCode === 401 || statusCode === 403) {
				throw new VertexAuthError(`Authentication failed: ${errorMessage}`);
			} else if (statusCode === 400) {
				throw new VertexConfigError(`Invalid request: ${errorMessage}`);
			} else {
				throw new VertexApiError(
					`API error (${statusCode}): ${errorMessage}`,
					statusCode
				);
			}
		}

		// Generic error handling
		throw new Error(`Vertex AI ${operation} failed: ${error.message}`);
	}
}
