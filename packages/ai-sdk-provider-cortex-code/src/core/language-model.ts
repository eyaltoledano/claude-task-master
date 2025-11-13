/**
 * Cortex Code CLI Language Model implementation for AI SDK v5
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type {
	LanguageModelV2,
	LanguageModelV2CallOptions,
	LanguageModelV2CallWarning,
	LanguageModelV2Content,
	LanguageModelV2FinishReason
} from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';

import {
	createAPICallError,
	createAuthenticationError,
	createConnectionError,
	createInstallationError,
	createTimeoutError,
	parseErrorFromStderr
} from './errors.js';
import { createPromptFromMessages } from '../cli/message-converter.js';
import type {
	CortexCodeLanguageModelOptions,
	CortexCodeModelId,
	CortexCodeSettings
} from './types.js';

/**
 * Cortex Code CLI Language Model implementation for AI SDK v5
 */
export class CortexCodeLanguageModel implements LanguageModelV2 {
	readonly specificationVersion = 'v2' as const;
	readonly defaultObjectGenerationMode = 'json' as const;
	readonly supportsImageUrls = false;
	readonly supportsStructuredOutputs = true; // Enable structured outputs via JSON mode
	readonly supportedUrls: Record<string, RegExp[]> = {};

	readonly modelId: CortexCodeModelId;
	readonly settings: CortexCodeSettings;

	constructor(options: CortexCodeLanguageModelOptions) {
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
		return 'cortex-code';
	}

	/**
	 * Check if Cortex Code is installed and available
	 */
	private async checkCortexCliInstallation(): Promise<{
		available: boolean;
		version?: string;
	}> {
		return new Promise((resolve) => {
			const child = spawn('cortex', ['--version'], {
				stdio: ['ignore', 'pipe', 'pipe'],
				detached: false
			});

			let stdout = '';

			child.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			child.on('error', () => {
				// Clean up streams
				if (child.stdout) child.stdout.destroy();
				if (child.stderr) child.stderr.destroy();
				child.unref();
				resolve({ available: false });
			});
			
			child.on('exit', (code) => {
				// Clean up streams
				if (child.stdout) child.stdout.destroy();
				if (child.stderr) child.stderr.destroy();
				child.unref();
				
				if (code === 0) {
					const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
					resolve({
						available: true,
						version: versionMatch?.[1]
					});
				} else {
					resolve({ available: false });
				}
			});
		});
	}

	/**
	 * Get Snowflake connection from settings or config file
	 */
	private getConnection(): string | null {
		// Check settings first
		if (this.settings.connection) {
			return this.settings.connection;
		}

		// Check for default connection in Snowflake config
		try {
			const configPath = join(homedir(), '.snowflake', 'config.toml');
			const configContent = readFileSync(configPath, 'utf8');

			// Simple TOML parsing for [connections.default] section
			const defaultMatch = configContent.match(
				/\[connections\.default\]([\s\S]*?)(?=\[|$)/
			);
			if (defaultMatch) {
				return 'default';
			}

			// Look for any connection
			const anyConnectionMatch = configContent.match(/\[connections\.(\w+)\]/);
			if (anyConnectionMatch) {
				return anyConnectionMatch[1];
			}
		} catch (error) {
			// Config file doesn't exist or can't be read
		}

		return null;
	}

	/**
	 * Execute Cortex Code command with stream-json output
	 */
	private async executeCortexCli(
		args: string[],
		options: { timeout?: number } = {}
	): Promise<{ stdout: string; stderr: string; exitCode: number }> {
		const timeout = options.timeout ?? this.settings.timeout ?? 60000;

		return new Promise((resolve, reject) => {
			const child = spawn('cortex', args, {
				stdio: ['ignore', 'pipe', 'pipe'], // stdin: ignore, stdout/stderr: pipe
				cwd: this.settings.workingDirectory || process.cwd(),
				env: { ...process.env }, // Explicitly pass environment
				detached: false // Ensure child dies with parent
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
							message: `Cortex Code command timed out after ${timeout}ms`,
							timeoutMs: timeout,
							promptExcerpt: args.join(' ').substring(0, 200)
						})
					);
				}, timeout);
			}

			// Collect stdout
			child.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			// Collect stderr
			child.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			// Handle process completion
			child.on('close', (code) => {
				if (timeoutId) {
					clearTimeout(timeoutId);
				}

				// Clean up streams and unref child to allow Jest to exit
				if (child.stdout) child.stdout.destroy();
				if (child.stderr) child.stderr.destroy();
				child.unref();

				resolve({
					stdout,
					stderr,
					exitCode: code ?? 0
				});
			});

			// Handle process errors
			child.on('error', (error) => {
				if (timeoutId) {
					clearTimeout(timeoutId);
				}

				reject(
					createInstallationError({
						message: `Failed to execute Cortex Code: ${error.message}`,
						stderr: error.message
					})
				);
			});
		});
	}

	/**
	 * Parse stream-json output from Cortex Code
	 */
	private parseStreamJsonOutput(stdout: string): {
		text: string;
		usage?: {
			promptTokens: number;
			completionTokens: number;
		};
		finishReason: LanguageModelV2FinishReason;
	} {
		let text = '';
		let usage:
			| { promptTokens: number; completionTokens: number }
			| undefined = undefined;
		let finishReason: LanguageModelV2FinishReason = 'stop';

		// Parse newline-separated JSON from Cortex Code CLI
		const lines = stdout.trim().split('\n');
		
		for (const line of lines) {
			if (!line.trim()) continue;
			
			try {
				const obj = JSON.parse(line);
				
				// Format 1: {"type": "assistant", "message": {"content": [{"type": "text", "text": "..."}]}}
				if (obj.type === 'assistant' && obj.message?.content) {
					const contentArray = Array.isArray(obj.message.content) 
						? obj.message.content 
						: [obj.message.content];
					
					for (const item of contentArray) {
						if (item.type === 'text' && item.text) {
							text += item.text;
						}
					}
				}
				
				// Format 2: {"type": "result", "result": "..."}
				else if (obj.type === 'result' && obj.result) {
					if (!text) { // Only use result if we don't have text from assistant message
						text = obj.result;
					}
				}
				
				// Usage information (if provided)
				else if (obj.type === 'usage' && obj.usage) {
					usage = {
						promptTokens: obj.usage.prompt_tokens || 0,
						completionTokens: obj.usage.completion_tokens || 0
					};
				}
				
				// Error handling
				else if (obj.type === 'error') {
					finishReason = 'error';
				}
			} catch (error) {
				// Skip malformed JSON lines
				console.warn('[Cortex Code] Failed to parse line:', line.substring(0, 100));
			}
		}

		return { text, usage, finishReason };
	}

	/**
	 * Build CLI arguments for doGenerate
	 */
	private async buildCliArguments(
		options: LanguageModelV2CallOptions
	): Promise<string[]> {
		const args: string[] = [];

		// Always use stream-json output format
		args.push('--output-format', 'stream-json');

		// Add model
		args.push('--model', this.modelId);

		// Add connection if available
		const connection = this.getConnection();
		if (connection) {
			args.push('-c', connection);
		}

		// Add plan mode if requested
		if (this.settings.plan) {
			args.push('--plan');
		}

		// Add no-mcp flag if requested
		if (this.settings.noMcp) {
			args.push('--no-mcp');
		}

		// Add skills file if provided
		if (this.settings.skillsFile) {
			args.push('--skills-file', this.settings.skillsFile);
		}

		// Add the prompt using --print flag
		const promptText = createPromptFromMessages(options.prompt);
		args.push('--print', promptText);

		return args;
	}

	/**
	 * Main text generation method
	 */
	async doGenerate(
		options: LanguageModelV2CallOptions
	): Promise<{
		content: Array<LanguageModelV2Content>;
		usage: {
			inputTokens: number;
			outputTokens: number;
			totalTokens: number;
		};
		finishReason: LanguageModelV2FinishReason;
		warnings: LanguageModelV2CallWarning[];
	}> {
		try {
			// Check if CLI is installed
			const installation = await this.checkCortexCliInstallation();
		if (!installation.available) {
			throw createInstallationError({
				message:
					'Cortex Code is not installed or not available in PATH. ' +
					'Please see your Snowflake Account Executive to request access to the PrPr of Cortex Code.'
			});
		}

		// Build CLI arguments
		const args = await this.buildCliArguments(options);

		// Execute CLI command with retries
		const maxRetries = this.settings.maxRetries ?? 3;
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const cliResult = await this.executeCortexCli(args, {
					timeout: this.settings.timeout
				});

				// Check for errors in stderr
				if (cliResult.stderr && cliResult.exitCode !== 0) {
					const errorInfo = parseErrorFromStderr(cliResult.stderr);

					if (errorInfo.type === 'authentication') {
						throw createAuthenticationError({
							message: errorInfo.message,
							connection: this.settings.connection,
							stderr: cliResult.stderr
						});
					} else if (errorInfo.type === 'connection') {
						throw createConnectionError({
							message: errorInfo.message,
							connection: this.settings.connection,
							stderr: cliResult.stderr
						});
					} else {
						throw createAPICallError({
							message: errorInfo.message,
							metadata: {
								exitCode: cliResult.exitCode,
								stderr: cliResult.stderr,
								stdout: cliResult.stdout
							}
						});
					}
				}

				// Parse the response
				const parsed = this.parseStreamJsonOutput(cliResult.stdout);

				// Ensure we have text
				if (!parsed.text) {
					throw createAPICallError({
						message: 'No text content received from Cortex Code',
						metadata: {
							exitCode: cliResult.exitCode,
							stderr: cliResult.stderr,
							stdout: cliResult.stdout
						}
					});
				}

				const result = {
					content: [{ type: 'text' as const, text: parsed.text }],
					usage: {
						inputTokens: parsed.usage?.promptTokens ?? 0,
						outputTokens: parsed.usage?.completionTokens ?? 0,
						totalTokens: (parsed.usage?.promptTokens ?? 0) + (parsed.usage?.completionTokens ?? 0)
					},
					finishReason: parsed.finishReason,
					warnings: [] as LanguageModelV2CallWarning[]
				};

				return result;
			} catch (error) {
				lastError = error as Error;

				// Don't retry for non-retryable errors
				if (
					error instanceof Error &&
					'isRetryable' in error &&
					!(error as any).isRetryable
				) {
					throw error;
				}

				// Wait before retrying (exponential backoff)
				if (attempt < maxRetries) {
					await new Promise((resolve) =>
						setTimeout(resolve, Math.pow(2, attempt) * 1000)
					);
				}
			}
		}

		// All retries failed
		throw lastError!;
		} catch (error) {
			// Catch any unexpected errors
			throw error;
		}
	}

	/**
	 * Streaming is not supported in current implementation
	 * The CLI uses --output-format stream-json, but we collect all output
	 * before returning.
	 */
	async doStream(): Promise<never> {
		throw createAPICallError({
			message:
				'Streaming is not yet supported for Cortex Code CLI provider. ' +
				'Use doGenerate() instead.'
		});
	}
}

