/**
 * google-vertex-anthropic.js
 * AI provider implementation for Anthropic models on Google Vertex AI using Vercel AI SDK.
 * This provider uses the createVertexAnthropic client to route requests to the
 * publishers/anthropic endpoint instead of publishers/google.
 *
 * Extends VertexAIProvider — only the client factory and display name differ.
 */

import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { VertexAIProvider } from './google-vertex.js';

export class VertexAnthropicProvider extends VertexAIProvider {
	constructor() {
		super();
		this.name = 'Google Vertex AI (Anthropic)';
	}

	/**
	 * Creates and returns a Google Vertex AI Anthropic client instance.
	 * Uses createVertexAnthropic to route to the publishers/anthropic endpoint.
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
				authOptions.googleAuthOptions = {
					...credentials,
					apiKey
				};
			} else if (credentials) {
				authOptions.googleAuthOptions = credentials;
			}

			// Return Vertex AI Anthropic client (publishers/anthropic endpoint)
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
}
