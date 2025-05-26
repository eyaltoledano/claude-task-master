/**
 * src/ai-providers/claude-code.js
 *
 * Implementation for interacting with Claude Code CLI
 * This provider uses the local Claude Code CLI instead of direct API calls,
 * allowing users to leverage their flat subscription.
 */
import { spawn } from 'child_process';
import { log } from '../../scripts/modules/utils.js';

/**
 * Formats messages array into a single prompt for Claude Code CLI
 * @param {Array<object>} messages - The messages array
 * @returns {string} The formatted prompt
 */
function formatMessagesForCLI(messages) {
	let prompt = '';

	// Find system and user messages
	const systemMessage = messages.find((m) => m.role === 'system');
	const userMessages = messages.filter((m) => m.role === 'user');

	// Add system prompt if exists
	if (systemMessage && systemMessage.content) {
		prompt += `System: ${systemMessage.content}\n\n`;
	}

	// Add user messages
	userMessages.forEach((msg, index) => {
		if (index > 0) prompt += '\n\n';
		prompt += msg.content;
	});

	return prompt;
}

/**
 * Executes Claude Code CLI with proper stdin handling
 * @param {string} command - The command to execute
 * @param {string} input - The input to pass via stdin
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function executeClaudeCommand(command, input) {
	return new Promise((resolve, reject) => {
		const args = command.split(' ').slice(1); // Remove 'claude' from command
		const child = spawn('claude', args);

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		child.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		child.on('error', (error) => {
			reject(error);
		});

		child.on('close', (code) => {
			if (code !== 0) {
				reject(
					new Error(`Claude Code CLI exited with code ${code}: ${stderr}`)
				);
			} else {
				resolve({ stdout, stderr });
			}
		});

		// Write input to stdin
		child.stdin.write(input);
		child.stdin.end();
	});
}

/**
 * Generates text using Claude Code CLI.
 *
 * @param {object} params - Parameters for the text generation.
 * @param {string} params.apiKey - Not used for CLI, but kept for interface compatibility.
 * @param {string} params.modelId - Model ID (used for model selection if supported).
 * @param {Array<object>} params.messages - The messages array.
 * @param {number} [params.maxTokens] - Maximum tokens (CLI may not support this).
 * @param {number} [params.temperature] - Temperature (CLI may not support this).
 * @param {string} [params.baseUrl] - Not used for CLI.
 * @returns {Promise<object>} The generated text content and usage.
 * @throws {Error} If the CLI call fails.
 */
export async function generateClaudeCodeText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature,
	baseUrl
}) {
	log('debug', `Generating Claude Code text with model preference: ${modelId}`);

	try {
		// Format messages into a single prompt
		const prompt = formatMessagesForCLI(messages);

		// Build the command with model selection if applicable
		let command = `claude --print --output-format json`;

		// Map common model IDs to Claude Code CLI model aliases
		if (modelId && modelId !== 'default') {
			const modelMap = {
				'claude-3-opus-20240229': 'opus',
				'claude-3-5-sonnet-20241022': 'sonnet',
				'claude-3-5-haiku-20241022': 'haiku',
				'claude-sonnet-4-20250514': 'sonnet',
				'claude-3-7-sonnet-20250219': 'sonnet'
			};

			const modelAlias = modelMap[modelId] || modelId;
			command += ` --model ${modelAlias}`;
		}

		log(
			'debug',
			`Executing Claude Code CLI with prompt length: ${prompt.length} chars`
		);

		// Execute the command using stdin to avoid shell escaping issues
		const { stdout, stderr } = await executeClaudeCommand(command, prompt);

		if (stderr) {
			log('warn', `Claude Code CLI stderr: ${stderr}`);
		}

		// Parse the JSON response
		const response = JSON.parse(stdout);

		if (response.is_error) {
			throw new Error(
				`Claude Code CLI error: ${response.error || 'Unknown error'}`
			);
		}

		log(
			'debug',
			`Claude Code CLI response received. Cost: $${response.cost_usd || 0}`
		);

		// Return in the expected format
		return {
			text: response.result || '',
			usage: {
				// CLI doesn't provide token counts, so we estimate or use defaults
				inputTokens: 0,
				outputTokens: 0,
				// Include cost information if available
				costUSD: response.cost_usd || 0
			}
		};
	} catch (error) {
		if (error.code === 'ENOENT') {
			log(
				'error',
				'Claude Code CLI not found. Please ensure it is installed and in PATH.'
			);
			throw new Error(
				'Claude Code CLI not found. Please install it first: npm install -g @anthropic-ai/claude-code'
			);
		}

		log('error', `Claude Code generateText failed: ${error.message}`);
		throw error;
	}
}

/**
 * Streams text using Claude Code CLI.
 * Note: CLI doesn't support streaming, so this falls back to regular generation.
 *
 * @param {object} params - Parameters for the text streaming.
 * @returns {Promise<object>} The generated text (not actually streamed).
 */
export async function streamClaudeCodeText(params) {
	log(
		'debug',
		'Claude Code CLI does not support streaming. Using regular generation.'
	);

	// Fall back to regular generation
	const result = await generateClaudeCodeText(params);

	// Simulate a stream-like response structure
	return {
		textStream: {
			// Create an async iterator that yields the full text at once
			async *[Symbol.asyncIterator]() {
				yield result.text;
			}
		},
		usage: Promise.resolve(result.usage),
		text: result.text
	};
}

/**
 * Generates an object using Claude Code CLI.
 *
 * @param {object} params - Parameters for the object generation.
 * @param {object} params.schema - The schema for the object to generate.
 * @returns {Promise<object>} The generated object and usage.
 * @throws {Error} If the CLI call fails or JSON parsing fails.
 */
export async function generateClaudeCodeObject({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature,
	baseUrl,
	schema,
	mode,
	output
}) {
	log(
		'debug',
		`Generating Claude Code object with model preference: ${modelId}`
	);

	try {
		// Add schema instructions to the messages
		const schemaInstructions = `Please respond with a valid JSON object that matches this schema: ${JSON.stringify(schema)}. Respond ONLY with the JSON object, no additional text.`;

		const modifiedMessages = [...messages];
		const lastUserMessage = modifiedMessages.findLast((m) => m.role === 'user');
		if (lastUserMessage) {
			lastUserMessage.content += `\n\n${schemaInstructions}`;
		} else {
			modifiedMessages.push({ role: 'user', content: schemaInstructions });
		}

		// Generate text response
		const result = await generateClaudeCodeText({
			apiKey,
			modelId,
			messages: modifiedMessages,
			maxTokens,
			temperature,
			baseUrl
		});

		// Parse the response as JSON
		let parsedObject;
		try {
			// Try to extract JSON from the response (in case there's extra text)
			const jsonMatch = result.text.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				parsedObject = JSON.parse(jsonMatch[0]);
			} else {
				parsedObject = JSON.parse(result.text);
			}
		} catch (parseError) {
			log(
				'error',
				`Failed to parse Claude Code response as JSON: ${parseError.message}`
			);
			log('debug', `Response text: ${result.text}`);
			throw new Error(
				'Failed to parse Claude Code response as valid JSON object'
			);
		}

		return {
			object: parsedObject,
			usage: result.usage
		};
	} catch (error) {
		log('error', `Claude Code generateObject failed: ${error.message}`);
		throw error;
	}
}
