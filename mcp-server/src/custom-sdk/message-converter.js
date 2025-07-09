/**
 * src/ai-providers/custom-sdk/mcp/message-converter.js
 *
 * Message conversion utilities for converting between AI SDK prompt format
 * and MCP sampling format.
 */

/**
 * Convert AI SDK prompt format to MCP sampling format
 * @param {Array} prompt - AI SDK prompt array
 * @returns {object} MCP format with messages and systemPrompt
 */
export function convertToMCPFormat(prompt) {
	const messages = [];
	let systemPrompt = '';

	for (const message of prompt) {
		if (message.role === 'system') {
			// Extract system prompt
			systemPrompt = extractTextContent(message.content);
		} else if (message.role === 'user' || message.role === 'assistant') {
			// Convert user/assistant messages
			messages.push({
				role: message.role,
				content: {
					type: 'text',
					text: extractTextContent(message.content)
				}
			});
		}
	}

	return {
		messages,
		systemPrompt
	};
}

/**
 * Convert MCP response format to AI SDK format
 * @param {object} response - MCP sampling response
 * @returns {object} AI SDK compatible result
 */
export function convertFromMCPFormat(response) {
	// Handle different possible response formats
	let text = '';
	let usage = null;
	let finishReason = 'stop';
	let warnings = [];

	if (typeof response === 'string') {
		text = response;
	} else if (response.content) {
		text = extractTextContent(response.content);
		usage = response.usage;
		finishReason = response.finishReason || 'stop';
	} else if (response.text) {
		text = response.text;
		usage = response.usage;
		finishReason = response.finishReason || 'stop';
	} else {
		// Fallback: try to extract text from response
		text = JSON.stringify(response);
		warnings.push('Unexpected MCP response format, used JSON fallback');
	}

	return {
		text,
		usage,
		finishReason,
		warnings
	};
}

/**
 * Extract text content from various content formats
 * @param {string|Array|object} content - Content in various formats
 * @returns {string} Extracted text
 */
function extractTextContent(content) {
	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		// Handle array of content parts
		return content
			.map((part) => {
				if (typeof part === 'string') {
					return part;
				}
				if (part.type === 'text' && part.text) {
					return part.text;
				}
				if (part.text) {
					return part.text;
				}
				// Skip non-text content (images, etc.)
				return '';
			})
			.filter((text) => text.length > 0)
			.join(' ');
	}

	if (content && typeof content === 'object') {
		if (content.type === 'text' && content.text) {
			return content.text;
		}
		if (content.text) {
			return content.text;
		}
	}

	// Fallback
	return String(content || '');
}
