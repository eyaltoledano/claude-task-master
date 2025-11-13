/**
 * Message conversion utilities for Cortex Code CLI communication
 */

import type { LanguageModelV2Prompt } from '@ai-sdk/provider';
import type { CortexCodeMessage, CortexCodeResponse } from '../core/types.js';

/**
 * Convert AI SDK prompt to Cortex Code messages format
 * 
 * @param prompt - AI SDK prompt (array of messages)
 * @returns Array of Cortex Code messages
 */
export function convertToCortexCodeMessages(
	prompt: LanguageModelV2Prompt
): CortexCodeMessage[] {
	const messages: CortexCodeMessage[] = [];

	// In AI SDK v5, prompt is an array of messages
	// Cast to any to handle the actual structure
	const promptArray = Array.isArray(prompt) ? prompt : (prompt as any);

	// Convert prompt messages
	for (const message of promptArray) {
		switch (message.role) {
			case 'system': {
				// System messages provide instructions/context
				const content = typeof message.content === 'string' 
					? message.content 
					: JSON.stringify(message.content);
				
				messages.push({
					role: 'system',
					content: content as string
				});
				break;
			}

			case 'user': {
				// Handle different content types
				const content = Array.isArray(message.content)
					? message.content
							.map((part: any) => {
								if (part.type === 'text') {
									return part.text;
								}
								// Cortex Code CLI doesn't support images in the same way
								// For now, we'll just note that an image was provided
								if (part.type === 'image') {
									return '[Image content not supported in CLI mode]';
								}
								return '';
							})
							.join('\n')
					: message.content;

				messages.push({
					role: 'user',
					content: content as string
				});
				break;
			}

			case 'assistant': {
				// Handle tool calls if present
				if (Array.isArray(message.content)) {
					const textParts = message.content.filter(
						(part: any) => part.type === 'text'
					);
					const toolParts = message.content.filter(
						(part: any) => part.type === 'tool-call'
					);

					if (textParts.length > 0) {
						const content = textParts.map((part: any) => part.text).join('\n');
						messages.push({
							role: 'assistant',
							content
						});
					}

					// Note: Tool calls handling would need to be implemented
					// based on Cortex Code's tool support
					if (toolParts.length > 0) {
						// For now, just note that tools were called
						messages.push({
							role: 'assistant',
							content: `[${toolParts.length} tool call(s) executed]`
						});
					}
				} else {
					messages.push({
						role: 'assistant',
						content: message.content
					});
				}
				break;
			}

			case 'tool': {
				// Tool results would need special handling based on Cortex Code
				for (const toolResult of message.content) {
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
 * Convert Cortex Code response to AI SDK format
 * 
 * @param response - Cortex Code response object
 * @returns AI SDK compatible response data
 */
export function convertFromCortexCodeResponse(response: CortexCodeResponse): {
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
	const messages = convertToCortexCodeMessages(prompt);

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
export function formatConversationContext(
	messages: CortexCodeMessage[]
): string {
	return messages
		.map((msg) => {
			const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
			return `${role}: ${msg.content}`;
		})
		.join('\n\n');
}

