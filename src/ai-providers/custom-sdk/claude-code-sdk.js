/**
 * Custom SDK wrapper for @anthropic-ai/claude-code
 *
 * This wrapper provides a consistent interface for the Claude Code CLI SDK
 * that can be used by the ClaudeCodeProvider following the same pattern
 * as other AI providers in the project.
 */

import { log } from '../../../scripts/modules/index.js';

let claudeCodeSDK = null;

/**
 * Dynamically loads the Claude Code SDK
 * @returns {Promise<Object>} The loaded SDK module
 */
async function loadSDK() {
	if (claudeCodeSDK) {
		return claudeCodeSDK;
	}

	try {
		claudeCodeSDK = await import('@anthropic-ai/claude-code');
		return claudeCodeSDK;
	} catch (error) {
		throw new Error(
			'Failed to load @anthropic-ai/claude-code SDK. Install with: npm install -g @anthropic-ai/claude-code'
		);
	}
}

/**
 * Creates a Claude Code client with the provided settings
 * @param {Object} params - Configuration parameters
 * @param {string} [params.pathToClaudeCodeExecutable] - Path to claude executable
 * @param {string} [params.cwd] - Working directory
 * @param {string} [params.executable] - JavaScript runtime to use (node/bun)
 * @param {Array} [params.executableArgs] - Arguments to pass to the executable
 * @returns {Object} Claude Code client interface
 */
export function createClaudeCode(params = {}) {
	const {
		pathToClaudeCodeExecutable,
		cwd = process.cwd(),
		executable,
		executableArgs = []
	} = params;

	// Return a client-like interface that matches the expected pattern
	return {
		/**
		 * Queries the Claude Code CLI with the given model and messages
		 * @param {string} modelId - Model to use ('opus' or 'sonnet')
		 * @param {Array} messages - Array of message objects
		 * @param {Object} options - Additional options
		 * @returns {Promise<Object>} Response from Claude
		 */
		async query(modelId, messages, options = {}) {
			const sdk = await loadSDK();

			// Convert messages to a single prompt
			const prompt = messages
				.map((msg) => {
					if (msg.role === 'system') return `System: ${msg.content}`;
					if (msg.role === 'user' || msg.role === 'human')
						return `Human: ${msg.content}`;
					if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
					return msg.content;
				})
				.join('\n\n');

			try {
				// The SDK expects: query({ prompt, abortController?, options })
				const queryParams = {
					prompt,
					abortController: options.abortController,
					options: {
						cwd,
						pathToClaudeCodeExecutable,
						executable,
						executableArgs,
						maxTurns: options.maxTurns,
						model: modelId // Pass the model ID here
					}
				};

				// Remove undefined options
				Object.keys(queryParams.options).forEach((key) => {
					if (queryParams.options[key] === undefined) {
						delete queryParams.options[key];
					}
				});

				// Import the query function from the SDK
				const { query } = sdk;

				// The SDK returns an async iterator of messages
				const messages = [];
				for await (const message of query(queryParams)) {
					messages.push(message);
				}

				// Find the last assistant message
				const assistantMessages = messages.filter(
					(m) => m.type === 'assistant'
				);
				const lastMessage = assistantMessages[assistantMessages.length - 1];

				// Find the result message for usage info
				const resultMessage = messages.find((m) => m.type === 'result');

				// Extract the text content from the assistant message
				const text = lastMessage?.message?.content?.[0]?.text || '';

				// Get usage data - prefer result message usage as it's more complete
				const usage = resultMessage?.usage || lastMessage?.message?.usage || null;

				return {
					content: text,
					text: text,
					raw: messages,
					usage: usage
				};
			} catch (error) {
				// Check for specific error types
				if (error.message?.includes('not authenticated')) {
					throw new Error(
						'Claude Code authentication required. Run: claude login'
					);
				}
				if (error.message?.includes('command not found')) {
					throw new Error(
						'Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code'
					);
				}
				throw error;
			}
		},

		/**
		 * Streams responses from Claude Code CLI
		 * @param {string} modelId - Model to use ('opus' or 'sonnet')
		 * @param {Array} messages - Array of message objects
		 * @param {Object} options - Additional options
		 * @returns {AsyncIterator} Stream of response chunks
		 */
		async *stream(modelId, messages, options = {}) {
			const sdk = await loadSDK();

			// Convert messages to a single prompt
			const prompt = messages
				.map((msg) => {
					if (msg.role === 'system') return `System: ${msg.content}`;
					if (msg.role === 'user' || msg.role === 'human')
						return `Human: ${msg.content}`;
					if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
					return msg.content;
				})
				.join('\n\n');

			try {
				const queryParams = {
					prompt,
					abortController: options.abortController,
					options: {
						cwd,
						pathToClaudeCodeExecutable,
						executable,
						executableArgs,
						maxTurns: options.maxTurns,
						model: modelId
					}
				};

				// Remove undefined options
				Object.keys(queryParams.options).forEach((key) => {
					if (queryParams.options[key] === undefined) {
						delete queryParams.options[key];
					}
				});

				// Import the query function from the SDK
				const { query } = sdk;

				// Stream the messages and collect them for usage data
				let currentText = '';
				const messages = [];
				
				for await (const message of query(queryParams)) {
					messages.push(message);
					
					if (
						message.type === 'assistant' &&
						message.message?.content?.[0]?.text
					) {
						const newText = message.message.content[0].text;
						const delta = newText.slice(currentText.length);
						currentText = newText;
						if (delta) {
							yield { delta, text: delta, messages };
						}
					}
				}
				
				// Yield final message with complete usage data
				const resultMessage = messages.find((m) => m.type === 'result');
				const lastAssistant = messages.filter((m) => m.type === 'assistant').pop();
				const usage = resultMessage?.usage || lastAssistant?.message?.usage || null;
				
				yield { 
					delta: '', 
					text: '', 
					messages,
					usage,
					isFinal: true 
				};
			} catch (error) {
				if (error.message?.includes('not authenticated')) {
					throw new Error(
						'Claude Code authentication required. Run: claude login'
					);
				}
				if (error.message?.includes('command not found')) {
					throw new Error(
						'Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code'
					);
				}
				throw error;
			}
		}
	};
}

/**
 * Checks if the Claude Code CLI is authenticated
 * @returns {Promise<boolean>} True if authenticated
 */
export async function isAuthenticated() {
	try {
		const sdk = await loadSDK();
		const authFn = sdk.isAuthenticated || sdk.default?.isAuthenticated;
		if (authFn) {
			return await authFn();
		}
		return true; // Assume authenticated if no check available
	} catch (error) {
		log('debug', `Authentication check failed: ${error.message}`);
		return false;
	}
}

/**
 * Gets the Claude Code CLI version
 * @returns {Promise<string>} Version string
 */
export async function getVersion() {
	try {
		const sdk = await loadSDK();
		const versionFn = sdk.getVersion || sdk.default?.getVersion;
		if (versionFn) {
			return await versionFn();
		}
		return 'unknown';
	} catch (error) {
		log('debug', `Version check failed: ${error.message}`);
		return 'unknown';
	}
}
