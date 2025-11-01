/**
 * @fileoverview Model fetching utilities for OpenRouter, Ollama, and other providers
 */

import https from 'https';
import http from 'http';
import type { FetchResult, OpenRouterModel, OllamaModel } from './types.js';

/**
 * Fetch available models from OpenRouter API
 */
export async function fetchOpenRouterModels(): Promise<
	FetchResult<OpenRouterModel[]>
> {
	return new Promise((resolve) => {
		const options = {
			hostname: 'openrouter.ai',
			path: '/api/v1/models',
			method: 'GET',
			headers: {
				Accept: 'application/json'
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode === 200) {
					try {
						const parsedData = JSON.parse(data);
						resolve({
							success: true,
							data: parsedData.data || []
						});
					} catch (e) {
						resolve({
							success: false,
							error: 'Failed to parse OpenRouter response'
						});
					}
				} else {
					resolve({
						success: false,
						error: `OpenRouter API returned status ${res.statusCode}`
					});
				}
			});
		});

		req.on('error', (e) => {
			resolve({
				success: false,
				error: `Failed to fetch OpenRouter models: ${e.message}`
			});
		});

		req.end();
	});
}

/**
 * Fetch available models from Ollama instance
 */
export async function fetchOllamaModels(
	baseURL = 'http://localhost:11434/api'
): Promise<FetchResult<OllamaModel[]>> {
	return new Promise((resolve) => {
		try {
			// Parse the base URL to extract hostname, port, and base path
			const url = new URL(baseURL);
			const isHttps = url.protocol === 'https:';
			const port = url.port || (isHttps ? 443 : 80);
			const basePath = url.pathname.endsWith('/')
				? url.pathname.slice(0, -1)
				: url.pathname;

			const options = {
				hostname: url.hostname,
				port: parseInt(String(port), 10),
				path: `${basePath}/tags`,
				method: 'GET',
				headers: {
					Accept: 'application/json'
				}
			};

			const requestLib = isHttps ? https : http;
			const req = requestLib.request(options, (res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					if (res.statusCode === 200) {
						try {
							const parsedData = JSON.parse(data);
							resolve({
								success: true,
								data: parsedData.models || []
							});
						} catch (e) {
							resolve({
								success: false,
								error: 'Failed to parse Ollama response'
							});
						}
					} else {
						resolve({
							success: false,
							error: `Ollama API returned status ${res.statusCode}`
						});
					}
				});
			});

			req.on('error', (e) => {
				resolve({
					success: false,
					error: `Failed to connect to Ollama: ${e.message}`
				});
			});

			req.end();
		} catch (e) {
			resolve({
				success: false,
				error: `Invalid Ollama base URL: ${e instanceof Error ? e.message : 'Unknown error'}`
			});
		}
	});
}

/**
 * Validate if a model ID exists in OpenRouter
 */
export async function validateOpenRouterModel(
	modelId: string
): Promise<boolean> {
	const result = await fetchOpenRouterModels();
	if (!result.success || !result.data) {
		return false;
	}
	return result.data.some((m) => m.id === modelId);
}

/**
 * Validate if a model ID exists in Ollama instance
 */
export async function validateOllamaModel(
	modelId: string,
	baseURL?: string
): Promise<boolean> {
	const result = await fetchOllamaModels(baseURL);
	if (!result.success || !result.data) {
		return false;
	}
	return result.data.some((m) => m.model === modelId);
}
