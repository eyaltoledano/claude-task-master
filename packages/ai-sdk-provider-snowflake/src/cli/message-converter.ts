/**
 * Message conversion utilities for Cortex Code CLI communication
 */

import type { LanguageModelV2Prompt } from '@ai-sdk/provider';

/**
 * Message format for CLI communication
 */
export interface CliMessage {
	/** Message role (user, assistant, system) */
	role: string;
	/** Message content */
	content: string;
}

/**
 * Response format from CLI stream-json output
 */
export interface CliResponse {
	/** Message role */
	role: string;
	/** Response content */
	content: string;
	/** Token usage information */
	usage?: {
		/** Input tokens used */
		prompt_tokens?: number;
		/** Output tokens used */
		completion_tokens?: number;
		/** Total tokens used */
		total_tokens?: number;
	};
}

/**
 * Convert AI SDK prompt to CLI messages format
 *
 * @param prompt - AI SDK prompt (array of messages)
 * @returns Array of CLI messages
 */
export function convertToCliMessages(
	prompt: LanguageModelV2Prompt
): CliMessage[] {
	const messages: CliMessage[] = [];

	// In AI SDK v5, prompt is an array of messages
	const promptArray = Array.isArray(prompt)
		? prompt
		: (prompt as unknown as unknown[]);

	// Convert prompt messages
	for (const message of promptArray) {
		const msg = message as { role: string; content: unknown };
		switch (msg.role) {
			case 'system': {
				// System messages provide instructions/context
				const content =
					typeof msg.content === 'string'
						? msg.content
						: JSON.stringify(msg.content);

				messages.push({
					role: 'system',
					content: content as string
				});
				break;
			}

			case 'user': {
				// Handle different content types
				const content = Array.isArray(msg.content)
					? (msg.content as { type: string; text?: string }[])
							.map((part) => {
								if (part.type === 'text') {
									return part.text;
								}
								// CLI doesn't support images in the same way
								if (part.type === 'image') {
									return '[Image content not supported in CLI mode]';
								}
								return '';
							})
							.join('\n')
					: msg.content;

				messages.push({
					role: 'user',
					content: content as string
				});
				break;
			}

			case 'assistant': {
				// Handle tool calls if present
				if (Array.isArray(msg.content)) {
					const contentArray = msg.content as { type: string; text?: string }[];
					const textParts = contentArray.filter((part) => part.type === 'text');
					const toolParts = contentArray.filter(
						(part) => part.type === 'tool-call'
					);

					if (textParts.length > 0) {
						const content = textParts.map((part) => part.text).join('\n');
						messages.push({
							role: 'assistant',
							content
						});
					}

					// Note: Tool calls handling would need to be implemented
					// based on CLI tool support
					if (toolParts.length > 0) {
						messages.push({
							role: 'assistant',
							content: `[${toolParts.length} tool call(s) executed]`
						});
					}
				} else {
					messages.push({
						role: 'assistant',
						content: msg.content as string
					});
				}
				break;
			}

			case 'tool': {
				// Tool results would need special handling
				const toolContent = msg.content as {
					toolName: string;
					result: unknown;
				}[];
				for (const toolResult of toolContent) {
					messages.push({
						role: 'user',
						content: `Tool result for ${toolResult.toolName}: ${JSON.stringify(toolResult.result)}`
					});
				}
				break;
			}
		}
	}

	return messages;
}

/**
 * Convert CLI response to AI SDK format
 *
 * @param response - CLI response object
 * @returns AI SDK compatible response data
 */
export function convertFromCliResponse(response: CliResponse): {
	text: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
	};
} {
	return {
		text: response.content,
		usage: response.usage
			? {
					promptTokens: response.usage.prompt_tokens || 0,
					completionTokens: response.usage.completion_tokens || 0
				}
			: undefined
	};
}

/**
 * Create a simple prompt string from AI SDK messages
 * This is used for the --print flag in Cortex Code
 *
 * @param prompt - AI SDK prompt object
 * @returns A formatted prompt string
 */
export function createPromptFromMessages(
	prompt: LanguageModelV2Prompt
): string {
	const messages = convertToCliMessages(prompt);

	// Combine all messages into a single prompt
	const parts: string[] = [];

	for (const message of messages) {
		if (message.role === 'system') {
			parts.push(`System: ${message.content}`);
		} else if (message.role === 'user') {
			parts.push(`User: ${message.content}`);
		} else if (message.role === 'assistant') {
			parts.push(`Assistant: ${message.content}`);
		}
	}

	return parts.join('\n\n');
}

/**
 * Escape a string for safe usage in shell arguments
 * This prevents command injection when passing user input to CLI
 *
 * @param arg - The argument to escape
 * @returns Escaped argument safe for shell usage
 */
export function escapeShellArg(arg: string): string {
	if (!arg || typeof arg !== 'string') {
		return "''";
	}

	// On Windows, use double quotes
	if (process.platform === 'win32') {
		return `"${arg.replace(/"/g, '""')}"`;
	}

	// On Unix-like systems, use single quotes
	// Replace single quotes with '\'' (end quote, escaped quote, start quote)
	return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Build CLI arguments array from prompt
 *
 * @param prompt - AI SDK prompt object
 * @returns Array of CLI arguments
 */
export function buildCliArgs(prompt: LanguageModelV2Prompt): string[] {
	const promptText = createPromptFromMessages(prompt);

	// For Cortex Code, we'll use the --print flag with the prompt
	return ['--print', promptText];
}

/**
 * Parse conversation context from message history
 * Useful for maintaining context across multiple calls
 *
 * @param messages - Array of messages
 * @returns Formatted conversation context
 */
export function formatConversationContext(messages: CliMessage[]): string {
	return messages
		.map((msg) => {
			const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
			return `${role}: ${msg.content}`;
		})
		.join('\n\n');
}
