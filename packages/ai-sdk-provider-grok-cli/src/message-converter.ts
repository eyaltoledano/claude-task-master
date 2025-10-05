/**
 * Message format conversion utilities for Grok CLI provider
 */

import type { GrokCliMessage, GrokCliResponse } from './types.js';

/**
 * AI SDK message type (simplified interface)
 */
interface AISDKMessage {
	role: string;
	content:
		| string
		| Array<{ type: string; text?: string }>
		| { text?: string; [key: string]: unknown };
}

/**
 * Convert AI SDK messages to Grok CLI compatible format
 * @param messages - AI SDK message array
 * @returns Grok CLI compatible messages
 */
export function convertToGrokCliMessages(
	messages: AISDKMessage[]
): GrokCliMessage[] {
	return messages.map((message) => {
		// Handle different message content types
		let content = '';

		if (typeof message.content === 'string') {
			content = message.content;
		} else if (Array.isArray(message.content)) {
			// Handle multi-part content (text and images)
			content = message.content
				.filter((part) => part.type === 'text')
				.map((part) => part.text || '')
				.join('\n');
		} else if (message.content && typeof message.content === 'object') {
			// Handle object content
			content = message.content.text || JSON.stringify(message.content);
		}

		return {
			role: message.role,
			content: content.trim()
		};
	});
}

/**
 * Convert Grok CLI response to AI SDK format
 * @param responseText - Raw response text from Grok CLI (JSONL format)
 * @returns AI SDK compatible response object
 */
export function convertFromGrokCliResponse(responseText: string): {
	text: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
} {
	try {
		// Grok CLI outputs JSONL format - each line is a separate JSON message
		const lines = responseText
			.trim()
			.split('\n')
			.filter((line) => line.trim());

		// Parse each line as JSON and find assistant messages
		const messages: GrokCliResponse[] = [];
		for (const line of lines) {
			try {
				const message = JSON.parse(line) as GrokCliResponse;
				messages.push(message);
			} catch (parseError) {
				// Skip invalid JSON lines
				continue;
			}
		}

		// Find the last assistant message
		const assistantMessage = messages
			.filter((msg) => msg.role === 'assistant')
			.pop();

		if (assistantMessage && assistantMessage.content) {
			return {
				text: assistantMessage.content,
				usage: assistantMessage.usage
					? {
							promptTokens: assistantMessage.usage.prompt_tokens || 0,
							completionTokens: assistantMessage.usage.completion_tokens || 0,
							totalTokens: assistantMessage.usage.total_tokens || 0
						}
					: undefined
			};
		}

		// Fallback: if no assistant message found, return the raw text
		return {
			text: responseText.trim(),
			usage: undefined
		};
	} catch (error) {
		// If parsing fails completely, treat as plain text response
		return {
			text: responseText.trim(),
			usage: undefined
		};
	}
}

/**
 * Create a prompt string for Grok CLI from messages
 * @param messages - AI SDK message array
 * @returns Formatted prompt string
 */
export function createPromptFromMessages(messages: AISDKMessage[]): string {
	const grokMessages = convertToGrokCliMessages(messages);

	// Create a conversation-style prompt
	const prompt = grokMessages
		.map((message) => {
			switch (message.role) {
				case 'system':
					return `System: ${message.content}`;
				case 'user':
					return `User: ${message.content}`;
				case 'assistant':
					return `Assistant: ${message.content}`;
				default:
					return `${message.role}: ${message.content}`;
			}
		})
		.join('\n\n');

	return prompt;
}

/**
 * Escape shell arguments for safe CLI execution
 * @param arg - Argument to escape
 * @returns Shell-escaped argument
 */
export function escapeShellArg(arg: string | unknown): string {
	if (typeof arg !== 'string') {
		arg = String(arg);
	}

	// Replace single quotes with '\''
	return "'" + (arg as string).replace(/'/g, "'\\''") + "'";
}
