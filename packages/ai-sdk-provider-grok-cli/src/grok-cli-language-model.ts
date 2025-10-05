/**
 * Grok CLI Language Model implementation for AI SDK v5
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type {
	LanguageModelV2,
	LanguageModelV2CallOptions,
	LanguageModelV2CallWarning
} from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import { generateId } from '@ai-sdk/provider-utils';

import {
	createAPICallError,
	createAuthenticationError,
	createInstallationError,
	createTimeoutError
} from './errors.js';
import { extractJson } from './json-extractor.js';
import {
	convertFromGrokCliResponse,
	createPromptFromMessages,
	escapeShellArg
} from './message-converter.js';
import type {
	GrokCliLanguageModelOptions,
	GrokCliModelId,
	GrokCliSettings
} from './types.js';

/**
 * Grok CLI Language Model implementation for AI SDK v5
 */
export class GrokCliLanguageModel implements LanguageModelV2 {
	readonly specificationVersion = 'v2' as const;
	readonly defaultObjectGenerationMode = 'json' as const;
	readonly supportsImageUrls = false;
	readonly supportsStructuredOutputs = false;
	readonly supportedUrls: Record<string, RegExp[]> = {};

	readonly modelId: GrokCliModelId;
	readonly settings: GrokCliSettings;

	constructor(options: GrokCliLanguageModelOptions) {
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

	get provider(): string {
		return 'grok-cli';
	}

	/**
	 * Check if Grok CLI is installed and available
	 */
	private async checkGrokCliInstallation(): Promise<boolean> {
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
	 */
	private async getApiKey(): Promise<string | null> {
		// Check settings first
		if (this.settings.apiKey) {
			return this.settings.apiKey;
		}

		// Check environment variable
		if (process.env.GROK_CLI_API_KEY) {
			return process.env.GROK_CLI_API_KEY;
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
	 */
	private async executeGrokCli(
		args: string[],
		options: { timeout?: number; apiKey?: string } = {}
	): Promise<{ stdout: string; stderr: string; exitCode: number }> {
		// Default timeout based on model type
		let defaultTimeout = 120000; // 2 minutes default
		if (this.modelId.includes('grok-4')) {
			defaultTimeout = 600000; // 10 minutes for grok-4 models (they seem to hang during setup)
		}

		const timeout = options.timeout ?? this.settings.timeout ?? defaultTimeout;

		return new Promise((resolve, reject) => {
			const child = spawn('grok', args, {
				stdio: 'pipe',
				cwd: this.settings.workingDirectory || process.cwd(),
				env:
					options.apiKey === undefined
						? process.env
						: { ...process.env, GROK_CLI_API_KEY: options.apiKey }
			});

			let stdout = '';
			let stderr = '';
			let timeoutId: NodeJS.Timeout | undefined;

			// Set up timeout
			if (timeout > 0) {
				timeoutId = setTimeout(() => {
					child.kill('SIGTERM');
					reject(
						createTimeoutError({
							message: `Grok CLI command timed out after ${timeout}ms`,
							timeoutMs: timeout,
							promptExcerpt: args.join(' ').substring(0, 200)
						})
					);
				}, timeout);
			}

			child.stdout?.on('data', (data) => {
				const chunk = data.toString();
				stdout += chunk;
			});

			child.stderr?.on('data', (data) => {
				const chunk = data.toString();
				stderr += chunk;
			});

			child.on('error', (error) => {
				if (timeoutId) clearTimeout(timeoutId);

				if ((error as any).code === 'ENOENT') {
					reject(createInstallationError({}));
				} else {
					reject(
						createAPICallError({
							message: `Failed to execute Grok CLI: ${error.message}`,
							code: (error as any).code,
							stderr: error.message,
							isRetryable: false
						})
					);
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
	 * Generate comprehensive warnings for unsupported parameters and validation issues
	 */
	private generateAllWarnings(
		options: LanguageModelV2CallOptions,
		prompt: string
	): LanguageModelV2CallWarning[] {
		const warnings: LanguageModelV2CallWarning[] = [];
		const unsupportedParams: string[] = [];

		// Check for unsupported parameters
		if (options.temperature !== undefined)
			unsupportedParams.push('temperature');
		if (options.topP !== undefined) unsupportedParams.push('topP');
		if (options.topK !== undefined) unsupportedParams.push('topK');
		if (options.presencePenalty !== undefined)
			unsupportedParams.push('presencePenalty');
		if (options.frequencyPenalty !== undefined)
			unsupportedParams.push('frequencyPenalty');
		if (options.stopSequences !== undefined && options.stopSequences.length > 0)
			unsupportedParams.push('stopSequences');
		if (options.seed !== undefined) unsupportedParams.push('seed');

		if (unsupportedParams.length > 0) {
			// Add a warning for each unsupported parameter
			for (const param of unsupportedParams) {
				warnings.push({
					type: 'unsupported-setting',
					setting: param as
						| 'temperature'
						| 'topP'
						| 'topK'
						| 'presencePenalty'
						| 'frequencyPenalty'
						| 'stopSequences'
						| 'seed',
					details: `Grok CLI does not support the ${param} parameter. It will be ignored.`
				});
			}
		}

		// Add model validation warnings if needed
		if (!this.modelId || this.modelId.trim() === '') {
			warnings.push({
				type: 'other',
				message: 'Model ID is empty or invalid'
			});
		}

		// Add prompt validation
		if (!prompt || prompt.trim() === '') {
			warnings.push({
				type: 'other',
				message: 'Prompt is empty'
			});
		}

		return warnings;
	}

	/**
	 * Generate text using Grok CLI
	 */
	async doGenerate(options: LanguageModelV2CallOptions) {
		// Handle abort signal early
		if (options.abortSignal?.aborted) {
			throw options.abortSignal.reason || new Error('Request aborted');
		}

		// Check CLI installation
		const isInstalled = await this.checkGrokCliInstallation();
		if (!isInstalled) {
			throw createInstallationError({});
		}

		// Get API key
		const apiKey = await this.getApiKey();
		if (!apiKey) {
			throw createAuthenticationError({
				message:
					'Grok CLI API key not found. Set GROK_CLI_API_KEY environment variable or configure grok-cli.'
			});
		}

		const prompt = createPromptFromMessages(options.prompt);
		const warnings = this.generateAllWarnings(options, prompt);

		// Build command arguments
		const args = ['--prompt', escapeShellArg(prompt)];

		// Add model if specified
		if (this.modelId && this.modelId !== 'default') {
			args.push('--model', this.modelId);
		}

		// Skip API key parameter if it's likely already configured to avoid hanging
		// The CLI seems to hang when trying to save API keys for grok-4 models
		// if (apiKey) {
		//	args.push('--api-key', apiKey);
		// }

		// Add base URL if provided in settings
		if (this.settings.baseURL) {
			args.push('--base-url', this.settings.baseURL);
		}

		// Add working directory if specified
		if (this.settings.workingDirectory) {
			args.push('--directory', this.settings.workingDirectory);
		}

		try {
			const result = await this.executeGrokCli(args, { apiKey });

			if (result.exitCode !== 0) {
				// Handle authentication errors
				if (
					result.stderr.toLowerCase().includes('unauthorized') ||
					result.stderr.toLowerCase().includes('authentication')
				) {
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
					isRetryable: false
				});
			}

			// Parse response
			const response = convertFromGrokCliResponse(result.stdout);
			let text = response.text || '';

			// Extract JSON if in object-json mode
			const isObjectJson = (
				o: unknown
			): o is { mode: { type: 'object-json' } } =>
				!!o &&
				typeof o === 'object' &&
				'mode' in o &&
				(o as any).mode?.type === 'object-json';
			if (isObjectJson(options) && text) {
				text = extractJson(text);
			}

			return {
				content: [
					{
						type: 'text' as const,
						text: text || ''
					}
				],
				usage: response.usage
					? {
							inputTokens: response.usage.promptTokens,
							outputTokens: response.usage.completionTokens,
							totalTokens: response.usage.totalTokens
						}
					: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				finishReason: 'stop' as const,
				rawCall: {
					rawPrompt: prompt,
					rawSettings: args
				},
				warnings: warnings,
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
						...(result.stderr && { stderr: result.stderr })
					}
				}
			};
		} catch (error) {
			// Re-throw our custom errors
			if (
				(error as any).name === 'APICallError' ||
				(error as any).name === 'LoadAPIKeyError'
			) {
				throw error;
			}

			// Wrap other errors
			throw createAPICallError({
				message: `Grok CLI execution failed: ${(error as Error).message}`,
				code: (error as any).code,
				promptExcerpt: prompt.substring(0, 200),
				isRetryable: false
			});
		}
	}

	/**
	 * Stream text using Grok CLI
	 * Note: Grok CLI doesn't natively support streaming, so this simulates streaming
	 * by generating the full response and then streaming it in chunks
	 */
	async doStream(options: LanguageModelV2CallOptions) {
		const prompt = createPromptFromMessages(options.prompt);
		const warnings = this.generateAllWarnings(options, prompt);

		const stream = new ReadableStream({
			start: async (controller) => {
				let abortListener: (() => void) | undefined;

				try {
					// Handle abort signal
					if (options.abortSignal?.aborted) {
						throw options.abortSignal.reason || new Error('Request aborted');
					}

					// Set up abort listener
					if (options.abortSignal) {
						abortListener = () => {
							controller.enqueue({
								type: 'error',
								error:
									options.abortSignal?.reason || new Error('Request aborted')
							});
							controller.close();
						};
						options.abortSignal.addEventListener('abort', abortListener, {
							once: true
						});
					}

					// Emit stream-start with warnings
					controller.enqueue({ type: 'stream-start', warnings });

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
					const content = result.content || [];
					const text =
						content.length > 0 && content[0].type === 'text'
							? content[0].text
							: '';
					const chunkSize = 50; // Characters per chunk
					let textPartId: string | undefined;

					// Emit text-start if we have content
					if (text.length > 0) {
						textPartId = generateId();
						controller.enqueue({
							type: 'text-start',
							id: textPartId
						});
					}

					for (let i = 0; i < text.length; i += chunkSize) {
						// Check for abort during streaming
						if (options.abortSignal?.aborted) {
							throw options.abortSignal.reason || new Error('Request aborted');
						}

						const chunk = text.slice(i, i + chunkSize);
						controller.enqueue({
							type: 'text-delta',
							id: textPartId!,
							delta: chunk
						});

						// Add small delay to simulate streaming
						await new Promise((resolve) => setTimeout(resolve, 20));
					}

					// Close text part if opened
					if (textPartId) {
						controller.enqueue({
							type: 'text-end',
							id: textPartId
						});
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
				} finally {
					// Clean up abort listener
					if (options.abortSignal && abortListener) {
						options.abortSignal.removeEventListener('abort', abortListener);
					}
				}
			},
			cancel: () => {
				// Clean up if stream is cancelled
			}
		});

		return {
			stream,
			request: {
				body: prompt
			}
		};
	}
}
