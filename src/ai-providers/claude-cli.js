/**
 * src/ai-providers/claude-cli.js
 *
 * Implementation for interacting with Claude CLI
 * This provider enables using Claude Code application via CLI
 * instead of the Anthropic API. It provides zero-cost local AI
 * assistance when Claude Code is installed.
 *
 * Configure with: CLAUDE_CLI_COMMAND environment variable
 * Examples:
 *   CLAUDE_CLI_COMMAND=claude
 *   CLAUDE_CLI_COMMAND="/path/to/claude --model opus"
 *   CLAUDE_CLI_COMMAND="claude --mcp-config /path/to/config.json --allowedTools 'Read,Write'"
 */

import { BaseAIProvider } from './base-provider.js';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, accessSync, constants } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * Claude CLI AI Provider
 *
 * Provides integration with Claude Code application through command line interface.
 * This allows users to leverage their local Claude installation without API costs.
 *
 * @class ClaudeCliAIProvider
 * @extends {BaseAIProvider}
 *
 * @example
 * // Set environment variable
 * process.env.CLAUDE_CLI_COMMAND = 'claude --model opus';
 *
 * // Use in Task Master
 * const provider = new ClaudeCliAIProvider();
 * const result = await provider.generateText({
 *   messages: [{ role: 'user', content: 'Hello Claude!' }]
 * });
 */
export class ClaudeCliAIProvider extends BaseAIProvider {
	/**
	 * Creates a new Claude CLI provider instance
	 * @constructor
	 */
	constructor() {
		super();
		this.name = 'Claude CLI';
		this.supportsStreaming = false; // CLI doesn't support streaming
		this.supportsObjectGeneration = true; // We can support this through JSON prompting
	}

	/**
	 * Retrieves the Claude CLI command from environment or parameters
	 *
	 * @param {object} [params={}] - Optional parameters object
	 * @param {string} [params.claudeCliCommand] - Claude CLI command override
	 * @returns {string|null} The Claude CLI command string or null if not configured
	 *
	 * @example
	 * // Get from environment
	 * const command = provider.getClaudeCommand();
	 *
	 * @example
	 * // Override with params
	 * const command = provider.getClaudeCommand({
	 *   claudeCliCommand: '/custom/path/claude'
	 * });
	 */
	getClaudeCommand(params = {}) {
		// Check if command is provided in params (from environment via resolveEnvVariable)
		return process.env.CLAUDE_CLI_COMMAND || params.claudeCliCommand || null;
	}

	/**
	 * Generates text using the Claude CLI
	 *
	 * @param {object} params - Parameters for text generation
	 * @param {Array<object>} params.messages - Array of message objects with role and content
	 * @param {string} params.messages[].role - Message role: 'system', 'user', or 'assistant'
	 * @param {string} params.messages[].content - Message content
	 * @param {number} [params.maxTokens] - Maximum tokens to generate (ignored by CLI)
	 * @param {number} [params.temperature] - Temperature for generation (ignored by CLI)
	 * @param {string} [params.modelId] - Model identifier (could be used in future for --model flag)
	 * @returns {Promise<{text: string, usage: {promptTokens: number, completionTokens: number, totalTokens: number}, requestId: string, responseTime: number}>} Response object containing generated text and metadata
	 * @throws {Error} If messages array is empty or command execution fails
	 *
	 * @example
	 * const response = await provider.generateText({
	 *   messages: [
	 *     { role: 'system', content: 'You are a helpful assistant' },
	 *     { role: 'user', content: 'Write a hello world function' }
	 *   ],
	 *   maxTokens: 1000,
	 *   temperature: 0.5
	 * });
	 */
	async generateText(params) {
		const startTime = Date.now();
		const requestId = randomUUID();

		try {
			const { messages } = params;

			if (!messages || messages.length === 0) {
				throw new Error('Messages array is required for text generation.');
			}

			// Format messages into a prompt
			let prompt = messages
				.map((msg) => {
					if (msg.role === 'system') {
						return `System: ${msg.content}`;
					} else if (msg.role === 'user') {
						return `Human: ${msg.content}`;
					} else if (msg.role === 'assistant') {
						return `Assistant: ${msg.content}`;
					}
					return '';
				})
				.join('\n\n');

			// Add final prompt for assistant
			if (messages[messages.length - 1].role !== 'assistant') {
				prompt += '\n\nAssistant:';
			}

			// Execute Claude CLI
			const result = await this.executeClaudeCli(prompt);

			return {
				text: result,
				usage: {
					promptTokens: 0, // CLI doesn't provide token counts
					completionTokens: 0,
					totalTokens: 0
				},
				requestId,
				responseTime: Date.now() - startTime
			};
		} catch (error) {
			this.handleError('text generation', error);
		}
	}

	/**
	 * Streaming is not supported by Claude CLI
	 *
	 * @param {object} params - Parameters for text streaming (unused)
	 * @throws {Error} Always throws error as streaming is not supported
	 * @override
	 */
	async streamText(params) {
		throw new Error(
			'Streaming is not supported by Claude CLI provider. Use generateText instead.'
		);
	}

	/**
	 * Generates a structured object using Claude CLI
	 *
	 * Works by appending JSON generation instructions to the user prompt
	 * and parsing the response as JSON.
	 *
	 * @param {object} params - Parameters for object generation
	 * @param {Array<object>} params.messages - Array of message objects
	 * @param {object} [params.schema] - JSON schema for the object (reserved for future use)
	 * @param {string} [params.objectName='object'] - Name/description of the object to generate
	 * @param {number} [params.maxTokens] - Maximum tokens to generate (ignored by CLI)
	 * @param {number} [params.temperature] - Temperature for generation (ignored by CLI)
	 * @returns {Promise<{object: any, usage: {promptTokens: number, completionTokens: number, totalTokens: number}, requestId: string, responseTime: number}>} Response object with parsed JSON
	 * @throws {Error} If JSON parsing fails or command execution fails
	 *
	 * @example
	 * const response = await provider.generateObject({
	 *   messages: [{ role: 'user', content: 'Generate a user profile' }],
	 *   objectName: 'UserProfile',
	 *   schema: { type: 'object', properties: { name: { type: 'string' } } }
	 * });
	 * console.log(response.object); // { name: 'John Doe', ... }
	 */
	async generateObject(params) {
		const startTime = Date.now();
		const requestId = randomUUID();

		try {
			const { messages, objectName = 'object' } = params;

			// Modify the last user message to request JSON output
			const modifiedMessages = [...messages];
			const lastMessage = modifiedMessages[modifiedMessages.length - 1];

			if (lastMessage && lastMessage.role === 'user') {
				lastMessage.content += `\n\nIMPORTANT: Your response MUST be valid JSON that matches this structure: ${objectName}\n\nRespond ONLY with the JSON object, no explanation, no markdown, just the raw JSON.`;
			}

			// Use generateText to get the response
			const textResult = await this.generateText({
				...params,
				messages: modifiedMessages
			});

			// Parse the JSON response
			try {
				let jsonText = textResult.text.trim();

				// Remove markdown code blocks if present
				jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

				// Find JSON object boundaries
				const firstBrace = jsonText.indexOf('{');
				const lastBrace = jsonText.lastIndexOf('}');
				if (firstBrace !== -1 && lastBrace !== -1) {
					jsonText = jsonText.substring(firstBrace, lastBrace + 1);
				}

				const parsedObject = JSON.parse(jsonText);

				return {
					object: parsedObject,
					usage: textResult.usage,
					requestId,
					responseTime: Date.now() - startTime
				};
			} catch (parseError) {
				throw new Error(
					`Failed to parse JSON from Claude CLI response: ${parseError.message}`
				);
			}
		} catch (error) {
			this.handleError('object generation', error);
		}
	}

	/**
	 * Executes the Claude CLI command with the given input
	 *
	 * This method handles the low-level execution of the Claude CLI command,
	 * including temporary file creation, command validation, and timeout handling.
	 *
	 * @param {string} input - The formatted prompt text to send to Claude
	 * @returns {Promise<string>} The raw text response from Claude CLI
	 * @throws {Error} If command is not set, not found, times out, or returns error
	 * @private
	 *
	 * @description
	 * The method performs the following steps:
	 * 1. Validates the Claude CLI command exists and is executable
	 * 2. Handles file reference mode for large PRDs if enabled
	 * 3. Adds -p flag for print mode if not present
	 * 4. Creates a temporary file with the prompt
	 * 5. Executes the command with input redirection
	 * 6. Cleans up the temporary file
	 *
	 * Environment variables:
	 * - CLAUDE_CLI_COMMAND: The Claude CLI command to execute
	 * - CLAUDE_CLI_USE_FILE_REFERENCE: Enable file reference mode for large inputs
	 */
	async executeClaudeCli(input) {
		let command = this.getClaudeCommand();
		let tempFile;

		try {
			if (!command) {
				throw new Error('CLAUDE_CLI_COMMAND environment variable is not set');
			}

			// Check if we should use file reference mode
			const useFileReference =
				process.env.CLAUDE_CLI_USE_FILE_REFERENCE === 'true';

			// Check if input contains file path marker
			let actualInput = input;
			if (useFileReference) {
				// Check if the input contains a file path reference
				const filePathMatch = input.match(/FILE_PATH:\s*(.+?)(?:\n|$)/);
				if (filePathMatch) {
					const filePath = filePathMatch[1].trim();
					// Replace the PRD content with a file reference
					actualInput = input.replace(
						/Product Requirements Document \(PRD\) Content:[\s\S]*?(?=\n\nIMPORTANT:|$)/,
						`Product Requirements Document (PRD) Content:\n<Please read the PRD from this file: ${filePath}>`
					);
				}
			}

			// Parse command into executable and args
			const commandParts = command.split(' ');
			const claudePath = commandParts[0];
			let args = commandParts.slice(1);

			// Add -p flag if not already present (required for piped input)
			if (!args.includes('-p') && !args.includes('--print')) {
				args.push('-p');
			}

			// Validate the command exists and is executable
			try {
				accessSync(claudePath, constants.F_OK | constants.X_OK);
			} catch (error) {
				throw new Error(
					`Claude CLI not found or not executable at: ${claudePath}. Please check your CLAUDE_CLI_COMMAND environment variable.`
				);
			}

			// Create a temporary file for the prompt
			tempFile = join(tmpdir(), `claude-prompt-${Date.now()}.txt`);
			writeFileSync(tempFile, actualInput, 'utf8');

			// Execute the command using spawn for better security
			return new Promise((resolve, reject) => {
				const child = spawn(claudePath, args, {
					stdio: ['pipe', 'pipe', 'pipe']
				});

				let stdout = '';
				let stderr = '';
				const timeout = setTimeout(
					() => {
						child.kill();
						reject(new Error('Claude CLI timed out after 5 minutes'));
					},
					5 * 60 * 1000
				);

				// Read from temp file and pipe to stdin
				const fs = require('fs');
				const readStream = fs.createReadStream(tempFile);
				readStream.pipe(child.stdin);

				child.stdout.on('data', (data) => {
					stdout += data.toString();
				});

				child.stderr.on('data', (data) => {
					stderr += data.toString();
				});

				child.on('close', (code) => {
					clearTimeout(timeout);
					if (code !== 0) {
						reject(new Error(`Claude CLI error (code ${code}): ${stderr}`));
					} else if (stderr && !stdout) {
						reject(new Error(`Claude CLI error: ${stderr}`));
					} else {
						resolve(stdout.trim());
					}
				});

				child.on('error', (error) => {
					clearTimeout(timeout);
					reject(error);
				});
			});
		} catch (error) {
			throw error;
		} finally {
			// Clean up temp file
			if (tempFile) {
				try {
					unlinkSync(tempFile);
				} catch (e) {
					// Ignore cleanup errors
				}
			}
		}
	}

	/**
	 * Get client instance (not applicable for Claude CLI)
	 *
	 * This method is required by the BaseAIProvider interface but is not
	 * applicable for the Claude CLI provider since it uses command-line
	 * execution rather than an API client.
	 *
	 * @returns {null} Always returns null as no client instance is needed
	 * @override
	 *
	 * @description
	 * The Claude CLI provider executes commands directly via child_process
	 * rather than maintaining a persistent client connection. This method
	 * exists only for interface compatibility with other AI providers.
	 */
	getClient() {
		return null;
	}
}
