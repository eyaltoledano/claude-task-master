/**
 * @fileoverview Message format conversion utilities for MCP Sampling
 */

/**
 * Convert AI SDK prompt format to MCP Sampling message format
 * @param {Object} prompt - AI SDK prompt object
 * @param {Object} mode - Generation mode
 * @returns {Object} Converted messages and system prompt
 */
export function convertToMcpSamplingMessages(prompt, mode) {
	const messages = [];
	let systemPrompt = '';

	// Handle different prompt types
	if (typeof prompt === 'string') {
		// Simple string prompt
		messages.push({
			role: 'user',
			content: {
				type: 'text',
				text: prompt
			}
		});
	} else if (Array.isArray(prompt)) {
		// Array of messages
		for (const message of prompt) {
			messages.push(convertMessage(message));
		}
	} else if (prompt.messages) {
		// Prompt object with messages array
		for (const message of prompt.messages) {
			const converted = convertMessage(message);

			// Extract system prompt from first system message
			if (message.role === 'system' && !systemPrompt) {
				systemPrompt = converted.content.text;
				// Don't include system messages in the messages array for MCP
				continue;
			}

			messages.push(converted);
		}

		// Handle system prompt from prompt object
		if (prompt.system && !systemPrompt) {
			systemPrompt = prompt.system;
		}
	}

	// For object generation mode, ensure we have proper instructions
	if (mode?.type === 'object-json' && messages.length > 0) {
		const lastMessage = messages[messages.length - 1];
		if (lastMessage.role === 'user') {
			// Append JSON generation instructions to the last user message
			const jsonInstruction =
				'\n\nPlease respond with a valid JSON object only, no additional text or markdown.';
			if (lastMessage.content.type === 'text') {
				lastMessage.content.text += jsonInstruction;
			}
		}
	}

	return {
		messages: messages,
		systemPrompt: systemPrompt || ''
	};
}

/**
 * Convert a single message to MCP format
 * @param {Object} message - Message to convert
 * @returns {Object} Converted message
 */
function convertMessage(message) {
	// Handle different content types
	if (typeof message.content === 'string') {
		return {
			role: message.role,
			content: {
				type: 'text',
				text: message.content
			}
		};
	}

	// Handle array of content parts
	if (Array.isArray(message.content)) {
		// MCP expects a single content object, so we need to combine parts
		const textParts = [];

		for (const part of message.content) {
			if (part.type === 'text') {
				textParts.push(part.text);
			} else if (part.type === 'tool-call') {
				// Include tool call information as text
				textParts.push(
					`[Tool Call: ${part.toolName}(${JSON.stringify(part.args)})]`
				);
			} else if (part.type === 'tool-result') {
				// Include tool result as text
				textParts.push(`[Tool Result: ${JSON.stringify(part.result)}]`);
			}
			// Note: MCP Sampling doesn't support images, so we skip image parts
		}

		return {
			role: message.role,
			content: {
				type: 'text',
				text: textParts.join('\n')
			}
		};
	}

	// Handle object content
	if (message.content && typeof message.content === 'object') {
		if (message.content.type === 'text') {
			return {
				role: message.role,
				content: {
					type: 'text',
					text: message.content.text || message.content.content || ''
				}
			};
		}
	}

	// Default fallback
	return {
		role: message.role,
		content: {
			type: 'text',
			text: String(message.content || '')
		}
	};
}

/**
 * Extract text content from MCP response
 * @param {Object} response - MCP sampling response
 * @returns {string} Extracted text content
 */
export function extractTextFromResponse(response) {
	if (response?.content?.text) {
		return response.content.text;
	}
	if (response?.content && typeof response.content === 'string') {
		return response.content;
	}
	if (response?.text) {
		return response.text;
	}
	return '';
}
