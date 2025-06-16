/**
 * @fileoverview Converts AI SDK prompt format to Claude Code message format
 */

/**
 * Convert AI SDK prompt to Claude Code messages format
 * @param {Array} prompt - AI SDK prompt array
 * @param {Object} [mode] - Generation mode
 * @param {string} mode.type - Mode type ('regular', 'object-json', 'object-tool')
 * @returns {{messagesPrompt: string, systemPrompt?: string}}
 */
export function convertToClaudeCodeMessages(prompt, mode) {
	const messages = [];
	let systemPrompt;

	for (const message of prompt) {
		switch (message.role) {
			case 'system':
				systemPrompt = message.content;
				break;

			case 'user':
				if (typeof message.content === 'string') {
					messages.push(message.content);
				} else {
					// Handle multi-part content
					const textParts = message.content
						.filter((part) => part.type === 'text')
						.map((part) => part.text)
						.join('\n');

					if (textParts) {
						messages.push(textParts);
					}

					// Note: Image parts are not supported by Claude Code CLI
					const imageParts = message.content.filter(
						(part) => part.type === 'image'
					);
					if (imageParts.length > 0) {
						console.warn(
							'Claude Code CLI does not support image inputs. Images will be ignored.'
						);
					}
				}
				break;

			case 'assistant':
				if (typeof message.content === 'string') {
					messages.push(`Assistant: ${message.content}`);
				} else {
					const textParts = message.content
						.filter((part) => part.type === 'text')
						.map((part) => part.text)
						.join('\n');

					if (textParts) {
						messages.push(`Assistant: ${textParts}`);
					}

					// Handle tool calls if present
					const toolCalls = message.content.filter(
						(part) => part.type === 'tool-call'
					);
					if (toolCalls.length > 0) {
						// For now, we'll just note that tool calls were made
						messages.push(`Assistant: [Tool calls made]`);
					}
				}
				break;

			case 'tool':
				// Tool results could be included in the conversation
				messages.push(
					`Tool Result (${message.content[0].toolName}): ${JSON.stringify(
						message.content[0].result
					)}`
				);
				break;
		}
	}

	// For the SDK, we need to provide a single prompt string
	// Format the conversation history properly

	// Combine system prompt with messages
	let finalPrompt = '';

	// Add system prompt at the beginning if present
	if (systemPrompt) {
		finalPrompt = systemPrompt;
	}

	if (messages.length === 0) {
		return { messagesPrompt: finalPrompt, systemPrompt };
	}

	// Format messages
	const formattedMessages = [];
	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		// Check if this is a user or assistant message based on content
		if (msg.startsWith('Assistant:') || msg.startsWith('Tool Result')) {
			formattedMessages.push(msg);
		} else {
			// User messages
			formattedMessages.push(`Human: ${msg}`);
		}
	}

	// Combine system prompt with messages
	if (finalPrompt) {
		finalPrompt = finalPrompt + '\n\n' + formattedMessages.join('\n\n');
	} else {
		finalPrompt = formattedMessages.join('\n\n');
	}

	// For JSON mode, add explicit instruction to ensure JSON output
	if (mode?.type === 'object-json') {
		// Make the JSON instruction even more explicit
		finalPrompt = `${finalPrompt}

CRITICAL INSTRUCTION: You MUST respond with ONLY valid JSON. Follow these rules EXACTLY:
1. Start your response with an opening brace {
2. End your response with a closing brace }
3. Do NOT include any text before the opening brace
4. Do NOT include any text after the closing brace
5. Do NOT use markdown code blocks or backticks
6. Do NOT include explanations or commentary
7. The ENTIRE response must be valid JSON that can be parsed with JSON.parse()

Begin your response with { and end with }`;
	}

	return {
		messagesPrompt: finalPrompt,
		systemPrompt
	};
}