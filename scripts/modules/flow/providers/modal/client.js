/**
 * @fileoverview Modal API Client
 *
 * Handles communication with Modal's API for serverless function management.
 * Provides function lifecycle management and execution.
 */

import { ModalConnectionError, ModalError } from './errors.js';

/**
 * Modal API Client
 * Manages authentication and API communication
 */
export class ModalClient {
	constructor(config) {
		this.config = config;
		this.baseUrl = config.baseUrl || 'https://api.modal.com';
		this.apiKey = config.apiKey;
		this.timeout = config.timeout || 60000;
	}

	/**
	 * Make authenticated HTTP request
	 */
	async makeRequest(endpoint, options = {}) {
		const url = `${this.baseUrl}${endpoint}`;
		const config = {
			timeout: this.timeout,
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
				...options.headers
			},
			...options
		};

		try {
			const response = await fetch(url, config);

			if (!response.ok) {
				const errorText = await response.text();
				throw new ModalConnectionError({
					code: `HTTP_${response.status}`,
					message: `HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`,
					category: 'connection',
					details: {
						status: response.status,
						statusText: response.statusText,
						url,
						body: errorText
					}
				});
			}

			return await response.json();
		} catch (error) {
			if (error instanceof ModalConnectionError) {
				throw error;
			}

			throw new ModalConnectionError({
				code: 'NETWORK_ERROR',
				message: `Network request failed: ${error.message}`,
				category: 'connection',
				details: { url, originalError: error }
			});
		}
	}

	/**
	 * List all apps
	 */
	async listApps() {
		return this.makeRequest('/v1/apps');
	}

	/**
	 * Create a new function
	 */
	async createFunction(config) {
		return this.makeRequest('/v1/functions', {
			method: 'POST',
			body: JSON.stringify(config)
		});
	}

	/**
	 * Get function status
	 */
	async getFunctionStatus(functionId) {
		return this.makeRequest(`/v1/functions/${functionId}`);
	}

	/**
	 * Execute function
	 */
	async executeFunction(functionId, payload) {
		return this.makeRequest(`/v1/functions/${functionId}/run`, {
			method: 'POST',
			body: JSON.stringify(payload)
		});
	}

	/**
	 * Get function logs
	 */
	async getFunctionLogs(functionId, options = {}) {
		const params = new URLSearchParams();
		if (options.since) params.append('since', options.since);
		if (options.until) params.append('until', options.until);
		if (options.lines) params.append('lines', options.lines);

		const query = params.toString();
		const endpoint = `/v1/functions/${functionId}/logs${query ? `?${query}` : ''}`;

		return this.makeRequest(endpoint);
	}

	/**
	 * Delete function
	 */
	async deleteFunction(functionId) {
		return this.makeRequest(`/v1/functions/${functionId}`, {
			method: 'DELETE'
		});
	}
}

/**
 * Create Modal client instance
 */
export async function createModalClient(config) {
	const client = new ModalClient(config);

	// Test connection by listing apps
	try {
		await client.listApps();
		return client;
	} catch (error) {
		throw new ModalConnectionError({
			code: 'CLIENT_INITIALIZATION_FAILED',
			message: `Failed to initialize Modal client: ${error.message}`,
			category: 'connection',
			details: { originalError: error }
		});
	}
}
