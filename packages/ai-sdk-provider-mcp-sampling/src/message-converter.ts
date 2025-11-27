/**
 * Message conversion utilities for MCP Sampling provider
 */

import type { LanguageModelV2Prompt } from '@ai-sdk/provider';
import type { MCPSamplingResponse } from './types.js';

/**
 * Convert AI SDK prompt to MCP format
 */
export function convertToMCPFormat(prompt: LanguageModelV2Prompt): {
	messages: Array<{
		role: 'user' | 'assistant' | 'system';
		content: string;
	}>;
	systemPrompt?: string;
} {
	const messages: Array<{
		role: 'user' | 'assistant' | 'system';
		content: string;
	}> = [];
	let systemPrompt: string | undefined;

	for (const message of prompt) {
		if (message.role === 'system') {
			// MCP handles system messages separately
			systemPrompt = message.content;
		} else if (message.role === 'user' || message.role === 'assistant') {
			// Convert content array to string
			let content = '';
			if (typeof message.content === 'string') {
				content = message.content;
			} else if (Array.isArray(message.content)) {
				content = message.content
					.map((part) => {
						if (part.type === 'text') {
							return part.text;
						}
						// Skip non-text content for now (images, etc.)
						return '';
					})
					.join('');
			}

			messages.push({
				role: message.role,
				content
			});
		}
	}

	return { messages, systemPrompt };
}

/**
 * Convert MCP response to AI SDK format
 */
export function convertFromMCPFormat(response: {
	content: Array<{
		type: 'text';
		text: string;
	}>;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
	};
	stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
}): MCPSamplingResponse {
	// Extract text from content array
	const text = response.content
		?.map((item) => (item.type === 'text' ? item.text : ''))
		.join('') || '';

	// Map MCP stop reason to AI SDK finish reason
	let finishReason: string = 'stop';
	switch (response.stopReason) {
		case 'endTurn':
			finishReason = 'stop';
			break;
		case 'stopSequence':
			finishReason = 'stop';
			break;
		case 'maxTokens':
			finishReason = 'length';
			break;
		default:
			finishReason = 'stop';
	}

	return {
		text,
		finishReason,
		usage: response.usage ? {
			inputTokens: response.usage.inputTokens || 0,
			outputTokens: response.usage.outputTokens || 0
		} : undefined
	};
}

/**
 * Create a simple prompt from messages (for debugging/logging)
 */
export function createPromptFromMessages(prompt: LanguageModelV2Prompt): string {
	return prompt
		.map((message) => {
			const role = message.role.toUpperCase();
			let content = '';
			
			if (typeof message.content === 'string') {
				content = message.content;
			} else if (Array.isArray(message.content)) {
				content = message.content
					.map((part) => {
						if (part.type === 'text') {
							return part.text;
						}
						return '[non-text content]';
					})
					.join('');
			}
			
			return `${role}: ${content}`;
		})
		.join('\n\n');
}