/**
 * Chat Session Manager for Task Master Flow
 * Manages conversation history, context, and MCP tool interactions
 */

import { v4 as uuidv4 } from 'uuid';
import { getCurrentTag } from '../../../utils.js';

export class ChatSession {
	constructor(sessionId, mcpClient, projectRoot) {
		this.id = sessionId || uuidv4();
		this.messages = [];
		this.mcpClient = mcpClient;
		this.projectRoot = projectRoot;
		this.context = {
			currentTag: getCurrentTag(projectRoot) || 'master',
			projectRoot: projectRoot,
			recentTasks: [],
			openFiles: [],
			lastToolCalls: []
		};
		this.createdAt = new Date().toISOString();
		this.lastActivityAt = new Date().toISOString();
	}

	/**
	 * Add a message to the conversation history
	 */
	addMessage(role, content, metadata = {}) {
		const message = {
			id: uuidv4(),
			role,
			content,
			timestamp: new Date().toISOString(),
			metadata
		};
		this.messages.push(message);
		this.lastActivityAt = new Date().toISOString();
		return message;
	}

	/**
	 * Get the system prompt with current context
	 */
	getSystemPrompt() {
		const toolList = this.getAvailableTools()
			.map((t) => `- ${t.name}: ${t.description}`)
			.join('\n');

		return `You are Task Master AI, an intelligent assistant integrated into the Task Master Flow TUI.

Current Context:
- Project: ${this.context.projectRoot}
- Active Tag: ${this.context.currentTag}
${
	this.context.recentTasks.length > 0
		? `- Recent Tasks: ${this.context.recentTasks
				.slice(0, 5)
				.map((t) => `${t.id}: ${t.title}`)
				.join(', ')}`
		: ''
}

Available MCP Tools:
${toolList}

Guidelines:
- Help users manage tasks and development workflow effectively
- Execute appropriate tools when the user asks you to perform actions
- Be concise but helpful in your responses
- Format code snippets with proper markdown
- Reference task IDs when discussing specific tasks
- Stream your responses for better user experience`;
	}

	/**
	 * Update session context
	 */
	updateContext(updates) {
		this.context = { ...this.context, ...updates };
		this.lastActivityAt = new Date().toISOString();
	}

	/**
	 * Get available MCP tools from the client
	 */
	getAvailableTools() {
		// This would be populated from the MCP client's available tools
		// For now, returning the core Task Master tools
		return [
			{ name: 'get_tasks', description: 'List tasks with optional filtering' },
			{ name: 'next_task', description: 'Get the next available task' },
			{ name: 'get_task', description: 'Show details for specific tasks' },
			{ name: 'set_task_status', description: 'Update task status' },
			{ name: 'add_task', description: 'Create a new task' },
			{ name: 'expand_task', description: 'Break down a task into subtasks' },
			{ name: 'update_task', description: 'Update task details' },
			{ name: 'add_subtask', description: 'Add a subtask to a parent task' },
			{ name: 'research', description: 'Perform AI-powered research' }
		];
	}

	/**
	 * Get messages for AI context (with optional limit)
	 */
	getMessagesForAI(limit = 50) {
		const systemMessage = {
			role: 'system',
			content: this.getSystemPrompt()
		};

		// Get the most recent messages up to the limit
		const recentMessages = this.messages.slice(-limit);

		return [
			systemMessage,
			...recentMessages.map((m) => ({
				role: m.role,
				content: m.content
			}))
		];
	}

	/**
	 * Clear the session
	 */
	clear() {
		this.messages = [];
		this.context.lastToolCalls = [];
		this.lastActivityAt = new Date().toISOString();
	}

	/**
	 * Clear messages (alias for clear)
	 */
	clearMessages() {
		this.clear();
	}

	/**
	 * Export session for persistence
	 */
	toJSON() {
		return {
			id: this.id,
			messages: this.messages,
			context: this.context,
			createdAt: this.createdAt,
			lastActivityAt: this.lastActivityAt
		};
	}

	/**
	 * Import session from saved data
	 */
	static fromJSON(data, mcpClient, projectRoot) {
		const session = new ChatSession(data.id, mcpClient, projectRoot);
		session.messages = data.messages || [];
		session.context = { ...session.context, ...data.context };
		session.createdAt = data.createdAt || new Date().toISOString();
		session.lastActivityAt = data.lastActivityAt || new Date().toISOString();
		return session;
	}
}
