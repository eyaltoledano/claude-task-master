/**
 * @fileoverview Grok CLI Language Model implementation
 */

import { NoSuchModelError } from '@ai-sdk/provider';
import { generateId } from '@ai-sdk/provider-utils';
import { createPromptFromMessages, convertFromGrokCliResponse, escapeShellArg } from './message-converter.js';
import { extractJson } from './json-extractor.js';
import { createAPICallError, createAuthenticationError, createInstallationError, createTimeoutError } from './errors.js';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * @typedef {import('./types.js').GrokCliSettings} GrokCliSettings
 * @typedef {import('./types.js').GrokCliModelId} GrokCliModelId
 */

/**
 * @typedef {Object} GrokCliLanguageModelOptions
 * @property {GrokCliModelId} id - Model ID
 * @property {GrokCliSettings} [settings] - Model settings
 */

export class GrokCliLanguageModel {
	specificationVersion = 'v1';
	defaultObjectGenerationMode = 'json';
	supportsImageUrls = false;
	supportsStructuredOutputs = false;

	/** @type {GrokCliModelId} */
	modelId;

	/** @type {GrokCliSettings} */
	settings;

	/**
	 * @param {GrokCliLanguageModelOptions} options
	 */
	constructor(options) {
		this.modelId = options.id;
		this.settings = options.settings ?? {};

		// Validate model ID format
		if (
			!this.modelId ||
			typeof this.modelId !== 'string' ||
			this.modelId.trim() === ''
		) {
			throw new NoSuchModelError({
				modelId: this.modelId,
				modelType: 'languageModel'
			});
		}
	}

	get provider() {
		return 'grok-cli';
	}

	/**
	 * Check if Grok CLI is installed and available
	 * @returns {Promise<boolean>}
	 */
	async checkGrokCliInstallation() {
		return new Promise((resolve) => {
			const child = spawn('grok', ['--version'], {
				stdio: 'pipe'
			});
			
			child.on('error', () => resolve(false));
			child.on('exit', (code) => resolve(code === 0));
		});
	}

	/**
	 * Get API key from settings or environment
	 * @returns {Promise<string|null>}
	 */
	async getApiKey() {
		// Check settings first
		if (this.settings.apiKey) {
			return this.settings.apiKey;
		}

		// Check environment variable
		if (process.env.GROK_API_KEY) {
			return process.env.GROK_API_KEY;
		}

		// Check grok-cli config file
		try {
			const configPath = join(homedir(), '.grok', 'user-settings.json');
			const configContent = await fs.readFile(configPath, 'utf8');
			const config = JSON.parse(configContent);
			return config.apiKey || null;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Execute Grok CLI command
	 * @param {Array<string>} args - Command line arguments
	 * @param {Object} options - Execution options
	 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
	 */
	async executeGrokCli(args, options = {}) {
		const timeout = options.timeout || this.settings.timeout || 120000; // 2 minutes default

		return new Promise((resolve, reject) => {
			const child = spawn('grok', args, {
				stdio: 'pipe',
				cwd: this.settings.workingDirectory || process.cwd()
			});

			let stdout = '';
			let stderr = '';
			let timeoutId;

			// Set up timeout
			if (timeout > 0) {
				timeoutId = setTimeout(() => {
					child.kill('SIGTERM');
					reject(createTimeoutError({
						message: `Grok CLI command timed out after ${timeout}ms`,
						timeoutMs: timeout,
						promptExcerpt: args.join(' ').substring(0, 200)
					}));
				}, timeout);
			}

			child.stdout.on('data', (data) => {
				stdout += data.toString();
			});

			child.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			child.on('error', (error) => {
				if (timeoutId) clearTimeout(timeoutId);
				
				if (error.code === 'ENOENT') {
					reject(createInstallationError({}));
				} else {
					reject(createAPICallError({
						message: `Failed to execute Grok CLI: ${error.message}`,
						code: error.code,
						stderr: error.message,
						isRetryable: false
					}));
				}
			});

			child.on('exit', (exitCode) => {
				if (timeoutId) clearTimeout(timeoutId);

				resolve({
					stdout: stdout.trim(),
					stderr: stderr.trim(),
					exitCode: exitCode || 0
				});
			});
		});
	}

	/**
	 * Generate unsupported parameter warnings
	 * @param {Object} options - Generation options
	 * @returns {Array} Warnings array
	 */
	generateUnsupportedWarnings(options) {
		const warnings = [];
		const unsupportedParams = [];

		// Grok CLI supports some parameters but not all AI SDK parameters
		if (options.topP !== undefined) unsupportedParams.push('topP');
		if (options.topK !== undefined) unsupportedParams.push('topK');
		if (options.presencePenalty !== undefined) unsupportedParams.push('presencePenalty');
		if (options.frequencyPenalty !== undefined) unsupportedParams.push('frequencyPenalty');
		if (options.stopSequences !== undefined && options.stopSequences.length > 0)
			unsupportedParams.push('stopSequences');
		if (options.seed !== undefined) unsupportedParams.push('seed');

		if (unsupportedParams.length > 0) {
			for (const param of unsupportedParams) {
				warnings.push({
					type: 'unsupported-setting',
					setting: param,
					details: `Grok CLI does not support the ${param} parameter. It will be ignored.`
				});
			}
		}

		return warnings;
	}

	/**
	 * Generate text using Grok CLI
	 * @param {Object} options - Generation options
	 * @returns {Promise<Object>}
	 */
	async doGenerate(options) {
		// Check CLI installation
		const isInstalled = await this.checkGrokCliInstallation();
		if (!isInstalled) {
			throw createInstallationError({});
		}

		// Get API key
		const apiKey = await this.getApiKey();
		if (!apiKey) {
			throw createAuthenticationError({
				message: 'Grok CLI API key not found. Set GROK_API_KEY environment variable or configure grok-cli.'
			});
		}

		const prompt = createPromptFromMessages(options.prompt);
		const warnings = this.generateUnsupportedWarnings(options);

		// Build command arguments
		const args = [
			'--prompt', escapeShellArg(prompt)
		];

		// Add model if specified
		if (this.modelId && this.modelId !== 'default') {
			args.push('--model', this.modelId);
		}

		// Add API key if available
		if (apiKey) {
			args.push('--api-key', apiKey);
		}

		// Add base URL if provided in settings
		if (this.settings.baseURL) {
			args.push('--base-url', this.settings.baseURL);
		}

		// Add working directory if specified
		if (this.settings.workingDirectory) {
			args.push('--directory', this.settings.workingDirectory);
		}

		try {
			const result = await this.executeGrokCli(args, {
				timeout: this.settings.timeout
			});

			if (result.exitCode !== 0) {
				// Handle authentication errors
				if (result.exitCode === 401 || result.stderr.includes('unauthorized') || result.stderr.includes('authentication')) {
					throw createAuthenticationError({
						message: `Grok CLI authentication failed: ${result.stderr}`
					});
				}

				throw createAPICallError({
					message: `Grok CLI failed with exit code ${result.exitCode}: ${result.stderr || 'Unknown error'}`,
					exitCode: result.exitCode,
					stderr: result.stderr,
					stdout: result.stdout,
					promptExcerpt: prompt.substring(0, 200),
					isRetryable: result.exitCode >= 500
				});
			}

			// Parse response
			const response = convertFromGrokCliResponse(result.stdout);
			let text = response.text || '';

			// Extract JSON if in object-json mode
			if (options.mode?.type === 'object-json' && text) {
				text = extractJson(text);
			}

			return {
				text: text || undefined,
				usage: response.usage || { promptTokens: 0, completionTokens: 0 },
				finishReason: 'stop',
				rawCall: {
					rawPrompt: prompt,
					rawSettings: args
				},
				warnings: warnings.length > 0 ? warnings : undefined,
				response: {
					id: generateId(),
					timestamp: new Date(),
					modelId: this.modelId
				},
				request: {
					body: prompt
				},
				providerMetadata: {
					'grok-cli': {
						exitCode: result.exitCode,
						stderr: result.stderr || undefined
					}
				}
			};
		} catch (error) {
			// Re-throw our custom errors
			if (error.name === 'APICallError' || error.name === 'LoadAPIKeyError') {
				throw error;
			}

			// Wrap other errors
			throw createAPICallError({
				message: `Grok CLI execution failed: ${error.message}`,
				code: error.code,
				promptExcerpt: prompt.substring(0, 200),
				isRetryable: false
			});
		}
	}

	/**
	 * Stream text using Grok CLI
	 * Note: Grok CLI doesn't natively support streaming, so this simulates streaming
	 * by generating the full response and then streaming it in chunks
	 * @param {Object} options - Stream options
	 * @returns {Promise<Object>}
	 */
	async doStream(options) {
		const warnings = this.generateUnsupportedWarnings(options);

		const stream = new ReadableStream({
			start: async (controller) => {
				try {
					// Generate the full response first
					const result = await this.doGenerate(options);

					// Emit response metadata
					controller.enqueue({
						type: 'response-metadata',
						id: result.response.id,
						timestamp: result.response.timestamp,
						modelId: result.response.modelId
					});

					// Simulate streaming by chunking the text
					const text = result.text || '';
					const chunkSize = 50; // Characters per chunk
					
					for (let i = 0; i < text.length; i += chunkSize) {
						const chunk = text.slice(i, i + chunkSize);
						controller.enqueue({
							type: 'text-delta',
							textDelta: chunk
						});
						
						// Add small delay to simulate streaming
						await new Promise(resolve => setTimeout(resolve, 20));
					}

					// Emit finish event
					controller.enqueue({
						type: 'finish',
						finishReason: result.finishReason,
						usage: result.usage,
						providerMetadata: result.providerMetadata
					});

					controller.close();
				} catch (error) {
					controller.enqueue({
						type: 'error',
						error
					});
					controller.close();
				}
			}
		});

		return {
			stream,
			rawCall: {
				rawPrompt: createPromptFromMessages(options.prompt),
				rawSettings: {}
			},
			warnings: warnings.length > 0 ? warnings : undefined,
			request: {
				body: createPromptFromMessages(options.prompt)
			}
		};
	}
}