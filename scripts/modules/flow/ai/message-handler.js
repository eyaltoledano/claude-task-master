/**
 * AI Message Handler for Task Master Flow
 * Handles AI interactions, streaming responses, and MCP tool execution
 */

import { streamTextService } from '../../ai-services-unified.js';
import { log } from '../../utils.js';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { tool } from 'ai';

// Debug logging to file
function debugLog(message, data = null) {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
	fs.appendFileSync(path.join(process.cwd(), 'ai-handler-debug.log'), logMessage);
}

// Define the available Task Master MCP tools with Vercel AI SDK tool helper
const TASK_MASTER_TOOLS = {
	get_tasks: tool({
		description: 'List all tasks in the current tag context',
		parameters: z.object({
			status: z.string().optional().describe('Filter by status (pending, done, in-progress)'),
			withSubtasks: z.boolean().optional().describe('Include subtasks in the list'),
			tag: z.string().optional().describe('Specify which tag context to list from')
		})
	}),
	
	next_task: tool({
		description: 'Get the next available task based on dependencies and status',
		parameters: z.object({
			tag: z.string().optional().describe('Specify which tag context to use')
		})
	}),
	
	get_task: tool({
		description: 'Get detailed information about a specific task',
		parameters: z.object({
			id: z.string().describe('Task ID (e.g., "1" or "1.2")'),
			tag: z.string().optional().describe('Specify which tag context to get from')
		})
	}),
	
	set_task_status: tool({
		description: 'Update the status of a task',
		parameters: z.object({
			id: z.string().describe('Task ID to update'),
			status: z.string().describe('New status (pending, in-progress, done, cancelled)'),
			tag: z.string().optional().describe('Specify which tag context')
		})
	}),
	
	add_task: tool({
		description: 'Add a new task using AI to structure it',
		parameters: z.object({
			prompt: z.string().describe('Description of the task to create'),
			dependencies: z.string().optional().describe('Comma-separated list of dependency IDs'),
			priority: z.string().optional().describe('Priority level (high, medium, low)'),
			research: z.boolean().optional().describe('Use research model for better context'),
			tag: z.string().optional().describe('Tag context to add to')
		})
	}),
	
	expand_task: tool({
		description: 'Break down a task into subtasks using AI',
		parameters: z.object({
			id: z.string().describe('Task ID to expand'),
			num: z.number().optional().describe('Number of subtasks to create'),
			research: z.boolean().optional().describe('Use research model'),
			prompt: z.string().optional().describe('Additional context for expansion'),
			force: z.boolean().optional().describe('Replace existing subtasks'),
			tag: z.string().optional().describe('Tag context')
		})
	}),
	
	update_task: tool({
		description: 'Update a specific task with new information',
		parameters: z.object({
			id: z.string().describe('Task ID to update'),
			prompt: z.string().describe('Changes or new information to incorporate'),
			append: z.boolean().optional().describe('Append to details instead of replacing'),
			research: z.boolean().optional().describe('Use research model'),
			tag: z.string().optional().describe('Tag context')
		})
	}),
	
	update_subtask: tool({
		description: 'Append timestamped notes to a subtask',
		parameters: z.object({
			id: z.string().describe('Subtask ID (e.g., "1.2")'),
			prompt: z.string().describe('Progress notes or findings to append'),
			research: z.boolean().optional().describe('Use research model'),
			tag: z.string().optional().describe('Tag context')
		})
	}),
	
	research: tool({
		description: 'Perform AI-powered research with project context',
		parameters: z.object({
			query: z.string().describe('Research question or topic'),
			taskIds: z.string().optional().describe('Comma-separated task IDs for context'),
			filePaths: z.string().optional().describe('Comma-separated file paths for context'),
			customContext: z.string().optional().describe('Additional context'),
			includeProjectTree: z.boolean().optional().describe('Include project structure'),
			detailLevel: z.string().optional().describe('Detail level (low, medium, high)'),
			tag: z.string().optional().describe('Tag context')
		})
	}),
	
	list_tags: tool({
		description: 'List all available task tags',
		parameters: z.object({})
	}),
	
	use_tag: tool({
		description: 'Switch to a different tag context',
		parameters: z.object({
			tagName: z.string().describe('Name of the tag to switch to')
		})
	}),
	
	add_tag: tool({
		description: 'Create a new tag context',
		parameters: z.object({
			tagName: z.string().describe('Name for the new tag'),
			description: z.string().optional().describe('Description of the tag'),
			copyFromCurrent: z.boolean().optional().describe('Copy tasks from current tag')
		})
	})
};

export class AIMessageHandler {
	constructor(session, mcpClient) {
		this.session = session;
		this.mcpClient = mcpClient;
		this.activeStream = null;
		this.isProcessing = false;
	}

	/**
	 * Handle a user message and stream the AI response
	 * @param {string} content - The user's message
	 * @param {Function} onChunk - Callback for each text chunk
	 * @param {Function} onToolCall - Callback for tool calls
	 * @param {Function} onComplete - Callback when response is complete
	 * @param {Function} onError - Callback for errors
	 */
	async handleUserMessage(content, { onChunk, onToolCall, onComplete, onError }) {
		// console.log(`[AIMessageHandler] Starting to handle user message: "${content}"`);
		log('info', `[AIMessageHandler] Starting to handle user message: "${content}"`);
		debugLog('handleUserMessage called', { content, hasCallbacks: { onChunk: !!onChunk, onToolCall: !!onToolCall, onComplete: !!onComplete, onError: !!onError } });
		
		if (this.isProcessing) {
			onError(new Error('Already processing a message'));
			return;
		}

		this.isProcessing = true;

		try {
			// Add user message to session
			this.session.addMessage('user', content);
			log('debug', '[AIMessageHandler] Added user message to session');
			debugLog('Added user message to session');

			// Get messages for AI context
			const messages = this.session.getMessagesForAI();
			log('debug', `[AIMessageHandler] Retrieved ${messages.length} messages for AI context`);
			debugLog('Retrieved messages for AI', { messageCount: messages.length });

			// Get MCP tool definitions
			const tools = this.getMCPToolDefinitions();
			log('debug', `[AIMessageHandler] Configured ${tools.length} MCP tools`);
			debugLog('Configured MCP tools', { toolCount: tools.length });

			// Extract system prompt and build conversation context
			const baseSystemPrompt = messages.find(m => m.role === 'system')?.content || '';
			const conversationMessages = messages.filter(m => m.role !== 'system');
			
			// Build conversation history into the system prompt
			let conversationContext = '';
			if (conversationMessages.length > 1) { // More than just the current message
				conversationContext = '\n\nPrevious conversation:\n';
				// Include all messages except the last one (which is the current user message)
				for (let i = 0; i < conversationMessages.length - 1; i++) {
					const msg = conversationMessages[i];
					conversationContext += `${msg.role}: ${msg.content}\n`;
				}
			}
			
			const systemPrompt = baseSystemPrompt + conversationContext;

			log('debug', 'Preparing AI stream request', {
				hasSystemPrompt: !!systemPrompt,
				messageCount: conversationMessages.length,
				toolCount: tools.length,
				hasSession: !!this.mcpClient?.session,
				projectRoot: this.session.projectRoot
			});
			
			debugLog('Preparing AI stream request', {
				hasSystemPrompt: !!systemPrompt,
				conversationLength: conversationMessages.length,
				toolCount: tools.length,
				hasSession: !!this.mcpClient?.session
			});

			// Create the stream - streamTextService expects a prompt parameter
			// Note: The AI service internally builds messages from systemPrompt and prompt
			// We don't pass messages directly as it expects to build them itself
			// console.log('[AIMessageHandler] About to call streamTextService');
			debugLog('About to call streamTextService');
			
			const streamResponse = await streamTextService({
				systemPrompt: systemPrompt,
				prompt: content, // The current user message as the prompt
				tools,
				session: this.mcpClient?.session, // Pass session for API key access
				projectRoot: this.session.projectRoot,
				commandName: 'flow-chat',
				outputType: 'mcp',
				role: 'main' // Add the role parameter
			});
			
			// Don't log the full response as it might interfere with the stream
			// console.log('[AIMessageHandler] streamTextService returned successfully');
			// console.log('[AIMessageHandler] Has mainResult:', !!streamResponse.mainResult);
			
			debugLog('streamTextService returned', { 
				hasResponse: !!streamResponse,
				mainResultType: streamResponse.mainResult?.constructor?.name
			});

			// Store the stream
			this.activeStream = streamResponse;

			// Process the stream
			await this.processStream(streamResponse, { onChunk, onToolCall, onComplete, onError });

		} catch (error) {
			// console.error('[AIMessageHandler] Error caught:', error.message, error.stack);
			log('error', `[AIMessageHandler] AI message handling error: ${error.message}`, { 
				stack: error.stack,
				errorType: error.constructor?.name
			});
			debugLog('Error in handleUserMessage', { error: error.message, stack: error.stack });
			onError(error);
		} finally {
			this.isProcessing = false;
			this.activeStream = null;
			log('info', '[AIMessageHandler] Message handling complete');
			debugLog('Message handling complete');
		}
	}

	/**
	 * Cancel the current stream if active
	 */
	async cancelStream() {
		if (this.activeStream) {
			try {
				// The stream should support cancellation
				if (this.activeStream.cancel) {
					await this.activeStream.cancel();
				}
			} catch (error) {
				log('error', `Error cancelling stream: ${error.message}`);
			}
			this.activeStream = null;
			this.isProcessing = false;
		}
	}

	/**
	 * Execute an MCP tool
	 */
	async executeMCPTool(toolName, args) {
		if (!this.mcpClient) {
			throw new Error('MCP client not initialized');
		}

		try {
			// Add current tag to args if not specified
			if (!args.tag && this.session.context.currentTag) {
				args = { ...args, tag: this.session.context.currentTag };
			}

			// Add project root if needed
			if (!args.projectRoot && this.session.projectRoot) {
				args = { ...args, projectRoot: this.session.projectRoot };
			}

			log('info', `Executing MCP tool: ${toolName}`, args);

			// Call the tool through MCP client
			const result = await this.mcpClient.callTool(toolName, args);

			// Update context if we got tasks
			if (toolName === 'get_tasks' && result.data?.tasks) {
				this.session.updateContext({ 
					recentTasks: result.data.tasks.slice(0, 10)
				});
			}

			return result;
		} catch (error) {
			log('error', `MCP tool execution error: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Get MCP tool definitions for the AI
	 */
	getMCPToolDefinitions() {
		// The tools are already properly formatted with the tool helper
		return TASK_MASTER_TOOLS;
	}

	/**
	 * Check if currently processing
	 */
	isBusy() {
		return this.isProcessing;
	}

	/**
	 * Process the stream response
	 */
	async processStream(streamResponse, { onChunk, onToolCall, onComplete, onError }) {
		debugLog('processStream called', { hasStreamResponse: !!streamResponse });
		
		try {
			// The streamTextService returns an object with mainResult containing the stream
			const streamResult = streamResponse.mainResult;
			
			if (!streamResult) {
				throw new Error('No stream returned from AI service');
			}
			
			// console.log('[processStream] Stream result type:', streamResult.constructor.name);
			// console.log('[processStream] Stream properties:', Object.keys(streamResult));
			
			// Check what streams are available
			// console.log('[processStream] Has textStream:', !!streamResult.textStream);
			// console.log('[processStream] Has fullStream:', !!streamResult.fullStream);
			// console.log('[processStream] Has baseStream:', !!streamResult.baseStream);
			
			let assistantMessage = '';
			const toolCalls = [];

			// Try different stream properties
			let streamToUse = null;
			let streamName = '';
			
			if (streamResult.fullStream) {
				streamToUse = streamResult.fullStream;
				streamName = 'fullStream';
			} else if (streamResult.textStream) {
				streamToUse = streamResult.textStream;
				streamName = 'textStream';
			} else if (streamResult.baseStream) {
				streamToUse = streamResult.baseStream;
				streamName = 'baseStream';
			}
			
			if (streamToUse) {
				// console.log(`[processStream] Using ${streamName}`);
				// console.log(`[processStream] Stream type:`, streamToUse.constructor.name);
				// console.log(`[processStream] Stream locked:`, streamToUse.locked);
				
				try {
					const reader = streamToUse.getReader();
					let chunkCount = 0;
					
					while (true) {
						const { done, value } = await reader.read();
						
						if (done) {
							// console.log(`[processStream] ${streamName} complete after ${chunkCount} chunks`);
							break;
						}
						
						chunkCount++;
						// console.log(`[processStream] Chunk ${chunkCount} - type:`, typeof value, 'value:', value);
						
						// Log the exact structure of the value
						// if (value) {
						// 	console.log('[processStream] Chunk details:', {
						// 		type: typeof value,
						// 		constructor: value.constructor?.name,
						// 		isUint8Array: value instanceof Uint8Array,
						// 		keys: typeof value === 'object' ? Object.keys(value) : 'N/A',
						// 		stringified: JSON.stringify(value, null, 2)
						// 	});
						// }
						
						// Handle different value types
						if (typeof value === 'string') {
							assistantMessage += value;
							onChunk(value);
						} else if (value instanceof Uint8Array) {
							// Decode Uint8Array
							const decoder = new TextDecoder();
							const text = decoder.decode(value, { stream: true });
							assistantMessage += text;
							onChunk(text);
						} else if (value && typeof value === 'object') {
							// Handle structured events
							if (value.type === 'text-delta' && value.textDelta) {
								assistantMessage += value.textDelta;
								onChunk(value.textDelta);
							} else if (value.type === 'tool-call') {
								// Handle tool calls
								const toolCallData = {
									id: value.toolCallId,
									name: value.toolName,
									args: value.args,
									status: 'pending'
								};
								toolCalls.push(toolCallData);
								
								try {
									onToolCall({ ...toolCallData, status: 'executing' });
									const result = await this.executeMCPTool(value.toolName, value.args);
									toolCallData.result = result;
									toolCallData.status = 'completed';
									onToolCall(toolCallData);
								} catch (error) {
									toolCallData.error = error.message;
									toolCallData.status = 'failed';
									onToolCall(toolCallData);
								}
							} else if (value.type === 'error') {
								// Handle error chunks
								// console.error('[processStream] Error chunk received:', value.error);
								debugLog('Error chunk received', { 
									error: value.error,
									errorName: value.error?.name,
									errorMessage: value.error?.message,
									statusCode: value.error?.statusCode,
									responseBody: value.error?.responseBody 
								});
								
								// Extract error message
								let errorMessage = 'An error occurred while processing your request.';
								if (value.error) {
									if (value.error.message) {
										errorMessage = value.error.message;
									} else if (value.error.responseBody) {
										try {
											const errorBody = JSON.parse(value.error.responseBody);
											if (errorBody.error?.message) {
												errorMessage = errorBody.error.message;
											}
										} catch (e) {
											// Fallback to responseBody string
											errorMessage = value.error.responseBody || errorMessage;
										}
									}
									
									// Check for specific API key error
									if (value.error.statusCode === 401 || errorMessage.includes('invalid x-api-key')) {
										errorMessage = 'Authentication failed: Invalid or missing API key. Please ensure your ANTHROPIC_API_KEY is set in the .env file.';
									}
								}
								
								// Call onError with a proper error object
								onError(new Error(errorMessage));
								
								// Exit the stream processing
								reader.releaseLock();
								return;
							}
						}
					}
					
					reader.releaseLock();
				} catch (error) {
					debugLog(`[processStream] Error reading ${streamName}:`, error);
					throw error;
				}
			} else {
				// If no recognized stream format, log what we have
				debugLog('[processStream] No recognized stream format. Result:', streamResult);
				throw new Error('No suitable stream found in the response');
			}

			// console.log('[processStream] Final message length:', assistantMessage.length);

			// Save complete assistant message
			this.session.addMessage('assistant', assistantMessage, { toolCalls });
			debugLog('Assistant message saved', { length: assistantMessage.length });

			// Update session context with tool calls
			if (toolCalls.length > 0) {
				this.session.updateContext({ 
					lastToolCalls: toolCalls.map(tc => ({
						name: tc.name,
						status: tc.status,
						timestamp: new Date().toISOString()
					}))
				});
			}

			onComplete({ message: assistantMessage, toolCalls });
			
		} catch (error) {
			debugLog('Error in processStream', { error: error.message, stack: error.stack });
			throw error;
		}
	}
} 