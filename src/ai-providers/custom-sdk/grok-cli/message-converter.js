/**
 * @fileoverview Message format conversion utilities for Grok CLI provider
 */

/**
 * @typedef {import('./types.js').GrokCliMessage} GrokCliMessage
 */

/**
 * Convert AI SDK messages to Grok CLI compatible format
 * @param {Array<Object>} messages - AI SDK message array
 * @returns {Array<GrokCliMessage>} Grok CLI compatible messages
 */
export function convertToGrokCliMessages(messages) {
	return messages.map((message) => {
		// Handle different message content types
		let content = '';
		
		if (typeof message.content === 'string') {
			content = message.content;
		} else if (Array.isArray(message.content)) {
			// Handle multi-part content (text and images)
			content = message.content
				.filter((part) => part.type === 'text')
				.map((part) => part.text)
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
 * @param {string} responseText - Raw response text from Grok CLI (JSONL format)
 * @returns {Object} AI SDK compatible response object
 */
export function convertFromGrokCliResponse(responseText) {
	try {
		// Grok CLI outputs JSONL format - each line is a separate JSON message
		const lines = responseText.trim().split('\n').filter(line => line.trim());
		
		// Parse each line as JSON and find assistant messages
		const messages = [];
		for (const line of lines) {
			try {
				const message = JSON.parse(line);
				messages.push(message);
			} catch (parseError) {
				// Skip invalid JSON lines
				continue;
			}
		}
		
		// Find the last assistant message
		const assistantMessage = messages
			.filter(msg => msg.role === 'assistant')
			.pop();
		
		if (assistantMessage && assistantMessage.content) {
			return {
				text: assistantMessage.content,
				usage: assistantMessage.usage ? {
					promptTokens: assistantMessage.usage.prompt_tokens || 0,
					completionTokens: assistantMessage.usage.completion_tokens || 0,
					totalTokens: assistantMessage.usage.total_tokens || 0
				} : undefined
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
 * @param {Array<Object>} messages - AI SDK message array
 * @returns {string} Formatted prompt string
 */
export function createPromptFromMessages(messages) {
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
 * @param {string} arg - Argument to escape
 * @returns {string} Shell-escaped argument
 */
export function escapeShellArg(arg) {
	if (typeof arg !== 'string') {
		arg = String(arg);
	}
	
	// Replace single quotes with '\''
	return "'" + arg.replace(/'/g, "'\\''") + "'";
}