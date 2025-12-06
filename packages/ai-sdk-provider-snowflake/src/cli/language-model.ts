/**
 * Cortex Code CLI Language Model implementation for AI SDK v5
 */

import { spawn } from 'child_process';
import type {
	LanguageModelV2,
	LanguageModelV2CallOptions,
	LanguageModelV2CallWarning,
	LanguageModelV2Content,
	LanguageModelV2FinishReason,
	LanguageModelV2Prompt
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
import { SnowflakeConnectionConfig } from './connection-config.js';
import { logger } from '../utils/logger.js';
import {
	removeUnsupportedFeatures,
	convertPromptToMessages,
	isClaudeModel,
	extractFirstJsonObject,
	parseJsonWithFallback
} from '../schema/index.js';
import type { CortexMessage } from '../schema/index.js';
import type { SnowflakeProviderSettings, SnowflakeModelId } from '../types.js';

/**
 * Options for creating a CLI language model
 */
export interface CliLanguageModelOptions {
	/** Model identifier */
	id: SnowflakeModelId;
	/** Model settings */
	settings?: SnowflakeProviderSettings;
}

/**
 * Cortex Code CLI Language Model implementation for AI SDK v5
 */
export class CliLanguageModel implements LanguageModelV2 {
	readonly specificationVersion = 'v2' as const;
	readonly defaultObjectGenerationMode = 'json' as const;
	readonly supportsImageUrls = false;
	readonly supportsStructuredOutputs = true;
	readonly supportedUrls: Record<string, RegExp[]> = {};

	readonly modelId: SnowflakeModelId;
	readonly settings: SnowflakeProviderSettings;
	private connectionConfig: SnowflakeConnectionConfig;

	constructor(options: CliLanguageModelOptions) {
		this.modelId = options.id;
		this.settings = options.settings ?? {};
		this.connectionConfig = new SnowflakeConnectionConfig(this.settings);

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
		return 'snowflake';
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
	 * Execute Cortex Code command with stream-json output
	 */
	private async executeCortexCli(
		args: string[],
		options: { timeout?: number } = {}
	): Promise<{ stdout: string; stderr: string; exitCode: number | null; signal: NodeJS.Signals | null }> {
		const timeout = options.timeout ?? this.settings.timeout ?? 60000;

		return new Promise((resolve, reject) => {
			const child = spawn('cortex', args, {
				stdio: ['ignore', 'pipe', 'pipe'],
				cwd: this.settings.workingDirectory || process.cwd(),
				env: { ...process.env },
				detached: false
			});

			let stdout = '';
			let stderr = '';
			let timeoutId: NodeJS.Timeout | undefined;

			// Set up timeout
			if (timeout > 0) {
				timeoutId = setTimeout(() => {
					// Clean up streams and unref child before rejecting
					if (child.stdout) child.stdout.destroy();
					if (child.stderr) child.stderr.destroy();
					child.kill('SIGTERM');
					child.unref();

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
			child.on('close', (code, signal) => {
				if (timeoutId) {
					clearTimeout(timeoutId);
				}

				// Clean up streams and unref child
				if (child.stdout) child.stdout.destroy();
				if (child.stderr) child.stderr.destroy();
				child.unref();

				resolve({
					stdout,
					stderr,
					exitCode: code,
					signal
				});
			});

			// Handle process errors
			child.on('error', (error) => {
				if (timeoutId) {
					clearTimeout(timeoutId);
				}

				// Clean up streams and unref child (same as close handler)
				if (child.stdout) child.stdout.destroy();
				if (child.stderr) child.stderr.destroy();
				child.unref();

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
	 * Strip ANSI escape codes and terminal control sequences from output
	 */
	private stripEscapeCodes(str: string): string {
		// Remove ANSI escape codes (colors, cursor movement, etc.)
		// Also removes OSC (Operating System Command) sequences like ]0;title
		return str
			.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // ANSI CSI sequences
			.replace(/\x1b\][^\x07]*\x07/g, '') // OSC sequences ending with BEL
			.replace(/\x1b\][^\x1b]*(?:\x1b\\)?/g, '') // OSC sequences ending with ST
			.replace(/\]0;[^\n\x07]*/g, ''); // Bare OSC title sequences
	}

	/**
	 * Extract and parse JSON from model response text
	 * Handles various formats including markdown code blocks and JavaScript syntax
	 *
	 * Ported from the original ai-sdk-provider-cortex-code package
	 *
	 * @param responseText - Raw response text from the model
	 * @returns Extracted JSON string (not parsed - caller handles that)
	 */
	private extractJsonFromResponse(responseText: string): string {
		const trimmed = responseText.trim();

		// Strategy 1: Try to extract JSON object directly
		let jsonText = extractFirstJsonObject(trimmed);

		// Strategy 2: Try markdown code blocks
		if (!jsonText) {
			const codeBlockMatch = trimmed.match(
				/```(?:json)?\s*\n?([\s\S]*?)\n?```/
			);
			if (codeBlockMatch) {
				jsonText = extractFirstJsonObject(codeBlockMatch[1]);
			}
		}

		// Strategy 3: Find array if no object
		if (!jsonText) {
			const arrayStart = trimmed.indexOf('[');
			if (arrayStart !== -1) {
				// Simple extraction for arrays - find matching bracket
				let bracketCount = 0;
				let inString = false;
				let escapeNext = false;

				for (let i = arrayStart; i < trimmed.length; i++) {
					const char = trimmed[i];
					if (escapeNext) {
						escapeNext = false;
						continue;
					}
					if (char === '\\') {
						escapeNext = true;
						continue;
					}
					if (char === '"') {
						inString = !inString;
						continue;
					}
					if (inString) continue;
					if (char === '[') bracketCount++;
					if (char === ']') {
						bracketCount--;
						if (bracketCount === 0) {
							jsonText = trimmed.substring(arrayStart, i + 1);
							break;
						}
					}
				}
			}
		}

		// Return extracted JSON or original text (let caller handle parsing errors)
		return jsonText || trimmed;
	}

	/**
	 * Parse stream-json output from Cortex Code
	 *
	 * Priority:
	 * 1. "result" type messages - contains the final, clean response
	 * 2. "assistant" type messages with text content - fallback for intermediate responses
	 */
	private parseStreamJsonOutput(stdout: string): {
		text: string;
		usage?: {
			promptTokens: number;
			completionTokens: number;
		};
		finishReason: LanguageModelV2FinishReason;
	} {
		let resultText = ''; // Text from "result" type (preferred)
		let assistantText = ''; // Text from "assistant" type (fallback)
		let usage: { promptTokens: number; completionTokens: number } | undefined =
			undefined;
		let finishReason: LanguageModelV2FinishReason = 'stop';

		// Strip terminal escape codes before parsing
		const cleanedOutput = this.stripEscapeCodes(stdout);

		// Parse newline-separated JSON from Cortex Code CLI
		const lines = cleanedOutput.trim().split('\n');

		for (const line of lines) {
			if (!line.trim()) continue;

			// Find the start of JSON object in the line
			const jsonStart = line.indexOf('{');
			if (jsonStart === -1) continue;

			const jsonLine = line.substring(jsonStart);

			try {
				const obj = JSON.parse(jsonLine);

				// PREFERRED: {"type": "result", "result": "...", "subtype": "success"}
				// This is the final, clean response from Cortex Code
				if (obj.type === 'result' && obj.result) {
					resultText = obj.result;
					// Check subtype for errors
					if (obj.subtype === 'error') {
						finishReason = 'error';
					}
				}

				// FALLBACK: {"type": "assistant", "message": {"content": [{"type": "text", "text": "..."}]}}
				// Only use if no result type message is found
				else if (obj.type === 'assistant' && obj.message?.content) {
					const contentArray = Array.isArray(obj.message.content)
						? obj.message.content
						: [obj.message.content];

					for (const item of contentArray) {
						if (item.type === 'text' && item.text) {
							assistantText += item.text;
						}
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
			} catch {
				// Skip malformed JSON lines - only warn in debug mode if there was actual JSON-like content
				if (jsonLine.includes('{')) {
					logger.debugWarn(
						'snowflake:cli',
						'Failed to parse JSON:',
						jsonLine.substring(0, 100)
					);
				}
			}
		}

		// Prefer result text over assistant text
		let text = resultText || assistantText;

		// Extract JSON from response (handles markdown fences, nested braces, etc.)
		text = this.extractJsonFromResponse(text);

		return { text, usage, finishReason };
	}

	/**
	 * Convert AI SDK prompt to messages array (same format as REST API)
	 *
	 * Uses the shared convertPromptToMessages function from schema/transformer.ts.
	 * CLI doesn't enable caching format by default since not all Claude models support it.
	 */
	private convertPrompt(prompt: LanguageModelV2Prompt): CortexMessage[] {
		// CLI doesn't enable caching by default - some Claude models (like claude-4-opus) don't support it
		return convertPromptToMessages(
			prompt as Array<{ role: string; content: unknown }>,
			{ enableCaching: false }
		);
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

		// Add model - strip cortex/ prefix if present
		const modelId = this.modelId.replace(/^cortex\//, '');

		// Cortex Code CLI only supports Claude/Anthropic models directly
		// For non-Claude models (OpenAI, etc.), use "auto" and let CLI decide
		const isClaude = isClaudeModel(modelId);
		const cliModelId = isClaude ? modelId : 'auto';

		args.push('--model', cliModelId);

		if (process.env.DEBUG?.includes('snowflake:cli')) {
			console.log(
				`[DEBUG snowflake:cli] Building CLI arguments for model: ${modelId}`
			);
			if (!isClaude) {
				console.log(
					`[DEBUG snowflake:cli] ⚠️ Non-Claude model detected, using "auto" for CLI (requested: ${modelId})`
				);
			}
		}

		// Add connection if available
		const connection = this.connectionConfig.getConnectionName();
		if (connection) {
			args.push('-c', connection);
			if (process.env.DEBUG?.includes('snowflake:cli')) {
				console.log(`[DEBUG snowflake:cli] Using connection: ${connection}`);
			}
		}

		// Add plan mode if requested
		if (this.settings.plan) {
			args.push('--plan');
			if (process.env.DEBUG?.includes('snowflake:cli')) {
				console.log(`[DEBUG snowflake:cli] Plan mode enabled`);
			}
		}

		// Add no-mcp flag if requested
		if (this.settings.noMcp) {
			args.push('--no-mcp');
			if (process.env.DEBUG?.includes('snowflake:cli')) {
				console.log(`[DEBUG snowflake:cli] MCP disabled`);
			}
		}

		// Add skills file if provided
		if (this.settings.skillsFile) {
			args.push('--skills-file', this.settings.skillsFile);
			if (process.env.DEBUG?.includes('snowflake:cli')) {
				console.log(
					`[DEBUG snowflake:cli] Skills file: ${this.settings.skillsFile}`
				);
			}
		}

		// Add dangerously-allow-all-tool-calls flag if enabled
		if (this.settings.dangerouslyAllowAllToolCalls) {
			args.push('--dangerously-allow-all-tool-calls');
			if (process.env.DEBUG?.includes('snowflake:cli')) {
				console.log(`[DEBUG snowflake:cli] Dangerous tool calls enabled`);
			}
		}

		// Build JSON request body (same format as REST API)
		// The CLI accepts JSON input via --print, just like the REST API body
		const messages = this.convertPrompt(options.prompt);

		// Build request object matching REST API format
		// Use the same model ID as CLI args (auto for non-Claude models)
		const requestBody: Record<string, unknown> = {
			model: cliModelId,
			messages
		};

		// Add response_format for structured outputs (same as REST API)
		// Use removeUnsupportedFeatures to ensure:
		// 1. additionalProperties: false is set on ALL object nodes (required for OpenAI)
		// 2. required array includes ALL properties (required for OpenAI)
		// 3. Unsupported keywords are removed or converted to descriptions
		if (
			options.responseFormat?.type === 'json' &&
			options.responseFormat.schema
		) {
			const cleanedSchema = removeUnsupportedFeatures(
				options.responseFormat.schema as Record<string, unknown>
			);

			requestBody.response_format = {
				type: 'json',
				schema: cleanedSchema
			};

			if (process.env.DEBUG?.includes('snowflake:cli')) {
				console.log(`[DEBUG snowflake:cli] 🎯 STRUCTURED OUTPUT REQUESTED`);
				console.log(
					`[DEBUG snowflake:cli] Schema name: ${options.responseFormat.name || 'unnamed'}`
				);
				console.log(
					`[DEBUG snowflake:cli] Original schema: ${JSON.stringify(options.responseFormat.schema, null, 2)}`
				);
				console.log(
					`[DEBUG snowflake:cli] Cleaned schema: ${JSON.stringify(cleanedSchema, null, 2)}`
				);
			}
		}

		// Convert to JSON string for --print flag
		const promptJson = JSON.stringify(requestBody);

		// Add the JSON request using --print flag
		args.push('--print', promptJson);

		if (process.env.DEBUG?.includes('snowflake:cli')) {
			console.log(
				`[DEBUG snowflake:cli] Final CLI command: cortex ${args.slice(0, args.length - 1).join(' ')} --print="<JSON ${promptJson.length} chars>"`
			);
			console.log(`[DEBUG snowflake:cli] JSON Request Body:`);
			console.log(JSON.stringify(requestBody, null, 2));
		}

		return args;
	}

	/**
	 * Main text generation method
	 */
	async doGenerate(options: LanguageModelV2CallOptions): Promise<{
		content: Array<LanguageModelV2Content>;
		usage: {
			inputTokens: number;
			outputTokens: number;
			totalTokens: number;
		};
		finishReason: LanguageModelV2FinishReason;
		warnings: LanguageModelV2CallWarning[];
	}> {
		if (process.env.DEBUG?.includes('snowflake:cli')) {
			console.log(
				`[DEBUG snowflake:cli] ========================================`
			);
			console.log(
				`[DEBUG snowflake:cli] Starting CLI generation for model: ${this.modelId}`
			);
			console.log(
				`[DEBUG snowflake:cli] Structured output: ${options.responseFormat?.type === 'json' ? 'YES' : 'NO'}`
			);
		}

		// Check if CLI is installed
		const installation = await this.checkCortexCliInstallation();
		if (!installation.available) {
			throw createInstallationError({
				message:
					'Cortex Code is not installed or not available in PATH. ' +
					'Please see your Snowflake Account Executive to request access to Cortex Code.'
			});
		}

		if (process.env.DEBUG?.includes('snowflake:cli')) {
			console.log(
				`[DEBUG snowflake:cli] ✅ CLI available, version: ${installation.version || 'unknown'}`
			);
		}

		// Build CLI arguments
		const args = await this.buildCliArguments(options);

		// Build the exact command string for error messages
		// This shows exactly what we're executing
		const promptArg = args[args.length - 1]; // Last arg is the prompt
		const otherArgs = args.slice(0, -1);
		const exactCommand = `cortex ${otherArgs.join(' ')} --print "${promptArg.length > 500 ? promptArg.substring(0, 500) + '...[truncated]' : promptArg}"`;
		const fullPromptForErrors = promptArg;

		if (process.env.DEBUG?.includes('snowflake:cli')) {
			console.log(
				`[DEBUG snowflake:cli] ========================================`
			);
			console.log(`[DEBUG snowflake:cli] EXACT COMMAND TO BE EXECUTED:`);
			console.log(
				`[DEBUG snowflake:cli] cortex ${args.slice(0, -1).join(' ')} --print "<PROMPT>"`
			);
			console.log(
				`[DEBUG snowflake:cli] ========================================`
			);
			console.log(
				`[DEBUG snowflake:cli] FULL PROMPT (${promptArg.length} chars):`
			);
			console.log(`[DEBUG snowflake:cli] ${promptArg}`);
			console.log(
				`[DEBUG snowflake:cli] ========================================`
			);
		}

		// Execute CLI command with retries
		const maxRetries = this.settings.maxRetries ?? 3;
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				if (process.env.DEBUG?.includes('snowflake:cli')) {
					console.log(
						`[DEBUG snowflake:cli] 🚀 Executing CLI (attempt ${attempt + 1}/${maxRetries + 1})...`
					);
				}

				const cliResult = await this.executeCortexCli(args, {
					timeout: this.settings.timeout
				});

				if (process.env.DEBUG?.includes('snowflake:cli')) {
					console.log(`[DEBUG snowflake:cli] ✅ CLI execution complete`);
					console.log(`[DEBUG snowflake:cli] Exit code: ${cliResult.exitCode}`);
					console.log(
						`[DEBUG snowflake:cli] Stdout length: ${cliResult.stdout.length} chars`
					);
					console.log(
						`[DEBUG snowflake:cli] Stderr length: ${cliResult.stderr.length} chars`
					);
					if (cliResult.stdout.length < 500) {
						console.log(
							`[DEBUG snowflake:cli] Full stdout: ${cliResult.stdout}`
						);
					} else {
						console.log(
							`[DEBUG snowflake:cli] Stdout preview: ${cliResult.stdout.substring(0, 500)}...`
						);
					}
				}

				// Check for errors - exit code is the primary indicator
				// A non-zero exit code means failure, regardless of stderr content
				if (cliResult.exitCode !== 0) {
					// Parse stderr for specific error types if available
					const errorInfo = cliResult.stderr
						? parseErrorFromStderr(cliResult.stderr)
						: { type: 'unknown', message: `CLI exited with code ${cliResult.exitCode}` };

					if (errorInfo.type === 'authentication') {
						throw createAuthenticationError({
							message: `${errorInfo.message}\n\nEXACT COMMAND:\n${exactCommand}`,
							connection: this.settings.connection,
							stderr: cliResult.stderr || ''
						});
					} else if (errorInfo.type === 'connection') {
						throw createConnectionError({
							message: `${errorInfo.message}\n\nEXACT COMMAND:\n${exactCommand}`,
							connection: this.settings.connection,
							stderr: cliResult.stderr || ''
						});
					} else {
						throw createAPICallError({
							message: `${errorInfo.message}\n\nEXACT COMMAND:\n${exactCommand}\n\nFULL PROMPT:\n${fullPromptForErrors}`,
							metadata: {
								exitCode: cliResult.exitCode,
								stderr: cliResult.stderr || '',
								stdout: cliResult.stdout,
								command: exactCommand,
								fullPrompt: fullPromptForErrors
							}
						});
					}
				}

				// Parse the response
				const parsed = this.parseStreamJsonOutput(cliResult.stdout);

				if (process.env.DEBUG?.includes('snowflake:cli')) {
					console.log(`[DEBUG snowflake:cli] 📝 Parsed response`);
					console.log(
						`[DEBUG snowflake:cli] Text length: ${parsed.text.length} chars`
					);
					console.log(
						`[DEBUG snowflake:cli] Usage: ${JSON.stringify(parsed.usage)}`
					);
					console.log(
						`[DEBUG snowflake:cli] Finish reason: ${parsed.finishReason}`
					);
					if (parsed.text.length < 200) {
						console.log(`[DEBUG snowflake:cli] Full text: ${parsed.text}`);
					} else {
						console.log(
							`[DEBUG snowflake:cli] Text preview: ${parsed.text.substring(0, 200)}...`
						);
					}
				}

				// Check if the CLI returned an error response
				if (parsed.finishReason === 'error') {
					throw createAPICallError({
						message: `Cortex Code CLI returned an error response.\n\nERROR DETAILS:\n${parsed.text}\n\nEXACT COMMAND EXECUTED:\n${exactCommand}\n\nFULL PROMPT:\n${fullPromptForErrors}\n\nRAW STDOUT:\n${cliResult.stdout}`,
						metadata: {
							exitCode: cliResult.exitCode,
							stderr: cliResult.stderr,
							stdout: cliResult.stdout,
							command: exactCommand,
							fullPrompt: fullPromptForErrors,
							errorResponse: parsed.text
						}
					});
				}

				// Ensure we have text
				if (!parsed.text) {
					throw createAPICallError({
						message: `No text content received from Cortex Code.\n\nEXACT COMMAND EXECUTED:\n${exactCommand}\n\nFULL PROMPT:\n${fullPromptForErrors}\n\nRAW STDOUT:\n${cliResult.stdout}`,
						metadata: {
							exitCode: cliResult.exitCode,
							stderr: cliResult.stderr,
							stdout: cliResult.stdout,
							command: exactCommand,
							fullPrompt: fullPromptForErrors
						}
					});
				}

				// If structured output was requested, validate and potentially fix the JSON
				// This handles cases where the model returns JavaScript object syntax
				// (unquoted keys like {name: "value"} instead of {"name": "value"})
				let finalText = parsed.text;
				if (options.responseFormat?.type === 'json') {
					if (process.env.DEBUG?.includes('snowflake:cli')) {
						console.log(
							`[DEBUG snowflake:cli] 🎯 Validating structured output JSON...`
						);
					}

					try {
						// Try to parse and re-stringify to ensure valid JSON
						const parsedObj = parseJsonWithFallback(parsed.text);
						finalText = JSON.stringify(parsedObj);

						if (process.env.DEBUG?.includes('snowflake:cli')) {
							console.log(
								`[DEBUG snowflake:cli] ✅ JSON validation successful`
							);
							console.log(
								`[DEBUG snowflake:cli] Validated object: ${JSON.stringify(parsedObj, null, 2)}`
							);
						}
					} catch (parseError) {
						// If parsing fails, return the original text and let the AI SDK handle the error
						// This provides better error messages from the SDK
						finalText = parsed.text;

						if (process.env.DEBUG?.includes('snowflake:cli')) {
							console.log(
								`[DEBUG snowflake:cli] ⚠️ JSON validation failed: ${parseError}`
							);
							console.log(
								`[DEBUG snowflake:cli] Returning original text for AI SDK to handle`
							);
						}
					}
				}

				return {
					content: [{ type: 'text' as const, text: finalText }],
					usage: {
						inputTokens: parsed.usage?.promptTokens ?? 0,
						outputTokens: parsed.usage?.completionTokens ?? 0,
						totalTokens:
							(parsed.usage?.promptTokens ?? 0) +
							(parsed.usage?.completionTokens ?? 0)
					},
					finishReason: parsed.finishReason,
					warnings: [] as LanguageModelV2CallWarning[]
				};
			} catch (error) {
				lastError = error as Error;

				// Don't retry for non-retryable errors
				if (
					error instanceof Error &&
					'isRetryable' in error &&
					!(error as Error & { isRetryable: boolean }).isRetryable
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
	}

	/**
	 * Streaming is not supported in current implementation
	 */
	async doStream(): Promise<never> {
		throw createAPICallError({
			message:
				'Streaming is not yet supported for Cortex Code CLI provider. ' +
				'Use doGenerate() instead.'
		});
	}
}

/**
 * Check if Cortex Code CLI is available
 */
export async function isCortexCliAvailable(): Promise<boolean> {
	return new Promise((resolve) => {
		const child = spawn('cortex', ['--version'], {
			stdio: ['ignore', 'pipe', 'pipe'],
			detached: false
		});

		child.on('error', () => {
			if (child.stdout) child.stdout.destroy();
			if (child.stderr) child.stderr.destroy();
			child.unref();
			resolve(false);
		});

		child.on('exit', (code) => {
			if (child.stdout) child.stdout.destroy();
			if (child.stderr) child.stderr.destroy();
			child.unref();
			resolve(code === 0);
		});
	});
}
