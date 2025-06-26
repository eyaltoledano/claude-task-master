import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { ChatSession } from '../session/chat-session.js';
import { AIMessageHandler } from '../ai/message-handler.js';
import { getCurrentTheme } from '../theme.js';
import fs from 'fs';
import path from 'path';

// Debug logging to file
function debugLog(message, data = null) {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] [ChatScreen] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
	fs.appendFileSync(path.join(process.cwd(), 'chat-screen-debug.log'), logMessage);
}

/**
 * Message component for displaying chat messages
 */
const Message = ({ message, isStreaming = false }) => {
	const theme = getCurrentTheme();
	const roleColor = message.role === 'user' ? theme.info : theme.success;
	const roleSymbol = message.role === 'user' ? '👤' : '🤖';

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box>
				<Text color={roleColor} bold>
					{roleSymbol} {message.role === 'user' ? 'You' : 'AI'}:
				</Text>
			</Box>
			<Box marginLeft={3}>
				<Text>
					{message.content}
					{isStreaming && <Text color={theme.textDim}>▊</Text>}
				</Text>
			</Box>
			{message.metadata?.toolCalls && message.metadata.toolCalls.length > 0 && (
				<Box flexDirection="column" marginLeft={3} marginTop={1}>
					{message.metadata.toolCalls.map((toolCall, idx) => (
						<ToolCallDisplay key={idx} toolCall={toolCall} />
					))}
				</Box>
			)}
		</Box>
	);
};

/**
 * Parse and format taskmaster tool responses for natural display
 */
const formatToolResponse = (toolCall) => {
	const theme = getCurrentTheme();
	
	if (!toolCall.result || toolCall.status !== 'completed') {
		return null;
	}

	const { name, result } = toolCall;
	
	// Handle error responses
	if (!result.success && result.error) {
		return (
			<Box flexDirection="column">
				<Text color={theme.error}>❌ Error: {result.error.message || result.error}</Text>
			</Box>
		);
	}
	
	// Helper to format task status with emoji
	const getStatusEmoji = (status) => {
		switch(status) {
			case 'done': return '✅';
			case 'in-progress': return '🔄';
			case 'blocked': return '🚫';
			case 'cancelled': return '❌';
			case 'deferred': return '⏸️';
			default: return '○';
		}
	};

	// Helper to format dependencies
	const formatDependencies = (deps) => {
		if (!deps || deps.length === 0) return null;
		return (
			<Box flexDirection="column">
				<Text color={theme.textDim}>Dependencies:</Text>
				{deps.map((dep, idx) => (
					<Box key={idx} marginLeft={2}>
						<Text color={theme.text}>
							{dep.completed ? '✅' : '⏱️'} Task {dep.id}
							{dep.title && `: ${dep.title}`}
						</Text>
					</Box>
				))}
			</Box>
		);
	};

	// Helper to format subtasks
	const formatSubtasks = (subtasks) => {
		if (!subtasks || subtasks.length === 0) return null;
		const completed = subtasks.filter(st => st.status === 'done').length;
		return (
			<Box flexDirection="column">
				<Text color={theme.textDim}>
					Subtasks ({completed}/{subtasks.length} completed):
				</Text>
				{subtasks.slice(0, 5).map((subtask, idx) => (
					<Box key={idx} marginLeft={2}>
						<Text color={theme.text}>
							{getStatusEmoji(subtask.status)} {subtask.id}: {subtask.title}
						</Text>
					</Box>
				))}
				{subtasks.length > 5 && (
					<Box marginLeft={2}>
						<Text color={theme.textDim}>... and {subtasks.length - 5} more</Text>
					</Box>
				)}
			</Box>
		);
	};
	
	// Handle different taskmaster tools
	switch (name) {
		case 'get_tasks': {
			if (result.data?.tasks) {
				const tasks = result.data.tasks;
				if (tasks.length === 0) {
					return <Text color={theme.textDim}>No tasks found in the current tag.</Text>;
				}
				
				// Group tasks by status
				const byStatus = tasks.reduce((acc, task) => {
					const status = task.status || 'pending';
					if (!acc[status]) acc[status] = [];
					acc[status].push(task);
					return acc;
				}, {});
				
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>Found {tasks.length} task{tasks.length !== 1 ? 's' : ''}:</Text>
						{Object.entries(byStatus).map(([status, statusTasks]) => (
							<Box key={status} flexDirection="column" marginTop={1}>
								<Text color={theme.accent}>{status.charAt(0).toUpperCase() + status.slice(1)} ({statusTasks.length}):</Text>
								{statusTasks.slice(0, 3).map((task, idx) => (
									<Box key={idx} marginLeft={2}>
										<Text color={theme.text}>
											{getStatusEmoji(task.status)} Task {task.id}: {task.title}
											{task.priority === 'high' && <Text color={theme.error}> [HIGH]</Text>}
										</Text>
									</Box>
								))}
								{statusTasks.length > 3 && (
									<Box marginLeft={2}>
										<Text color={theme.textDim}>... and {statusTasks.length - 3} more</Text>
									</Box>
								)}
							</Box>
						))}
						{result.data.tag && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>Current tag: {result.data.tag}</Text>
							</Box>
						)}
					</Box>
				);
			}
			break;
		}
		
		case 'next_task': {
			if (result.data?.task) {
				const task = result.data.task;
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>📌 Next task to work on:</Text>
						<Box marginLeft={2} flexDirection="column">
							<Text color={theme.accent} bold>Task {task.id}: {task.title}</Text>
							{task.priority && (
								<Text color={
									task.priority === 'high' ? theme.error :
									task.priority === 'medium' ? theme.warning :
									theme.text
								}>
									Priority: {task.priority}
								</Text>
							)}
							{task.description && (
								<Box marginTop={1}>
									<Text color={theme.text}>{task.description}</Text>
								</Box>
							)}
							{task.dependencies && task.dependencies.length > 0 && (
								<Box marginTop={1}>
									{formatDependencies(task.dependencies)}
								</Box>
							)}
							{task.subtasks && task.subtasks.length > 0 && (
								<Box marginTop={1}>
									{formatSubtasks(task.subtasks)}
								</Box>
							)}
							<Box marginTop={1}>
								<Text color={theme.textDim}>💡 Tip: Use /tasks to see more details or mark as in-progress</Text>
							</Box>
						</Box>
					</Box>
				);
			} else {
				return (
					<Box flexDirection="column">
						<Text color={theme.warning}>No pending tasks found!</Text>
						<Text color={theme.textDim}>All tasks are either completed or have unmet dependencies.</Text>
					</Box>
				);
			}
		}
		
		case 'get_task': {
			if (result.data?.task) {
				const task = result.data.task;
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>📋 Task Details:</Text>
						<Box marginLeft={2} flexDirection="column">
							<Text color={theme.accent} bold>Task {task.id}: {task.title}</Text>
							<Box flexDirection="row">
								<Text color={theme.text}>Status: </Text>
								<Text color={
									task.status === 'done' ? theme.success :
									task.status === 'in-progress' ? theme.warning :
									theme.text
								}>
									{getStatusEmoji(task.status)} {task.status}
								</Text>
							</Box>
							{task.priority && (
								<Text color={theme.text}>
									Priority: <Text color={
										task.priority === 'high' ? theme.error :
										task.priority === 'medium' ? theme.warning :
										theme.text
									}>{task.priority}</Text>
								</Text>
							)}
							{task.description && (
								<Box marginTop={1} flexDirection="column">
									<Text color={theme.textDim}>Description:</Text>
									<Box marginLeft={2}>
										<Text color={theme.text}>{task.description}</Text>
									</Box>
								</Box>
							)}
							{task.details && (
								<Box marginTop={1} flexDirection="column">
									<Text color={theme.textDim}>Implementation Details:</Text>
									<Box marginLeft={2}>
										<Text color={theme.text}>
											{task.details.length > 200 
												? task.details.substring(0, 200) + '...' 
												: task.details}
										</Text>
									</Box>
								</Box>
							)}
							{task.testStrategy && (
								<Box marginTop={1} flexDirection="column">
									<Text color={theme.textDim}>Test Strategy:</Text>
									<Box marginLeft={2}>
										<Text color={theme.text}>
											{task.testStrategy.length > 150 
												? task.testStrategy.substring(0, 150) + '...' 
												: task.testStrategy}
										</Text>
									</Box>
								</Box>
							)}
							{task.dependencies && task.dependencies.length > 0 && (
								<Box marginTop={1}>
									{formatDependencies(task.dependencies)}
								</Box>
							)}
							{task.subtasks && task.subtasks.length > 0 && (
								<Box marginTop={1}>
									{formatSubtasks(task.subtasks)}
								</Box>
							)}
						</Box>
					</Box>
				);
			} else {
				return <Text color={theme.error}>Task not found.</Text>;
			}
		}
		
		case 'set_task_status': {
			if (result.data?.task) {
				const task = result.data.task;
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>✓ Task status updated successfully!</Text>
						<Box marginLeft={2}>
							<Text color={theme.text}>
								Task {task.id}: {task.title}
							</Text>
							<Text color={theme.text}>
								New status: {getStatusEmoji(task.status)} {task.status}
							</Text>
						</Box>
					</Box>
				);
			}
			break;
		}
		
		case 'add_task': {
			if (result.data?.task) {
				const task = result.data.task;
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>✨ New task created successfully!</Text>
						<Box marginLeft={2} flexDirection="column">
							<Text color={theme.accent} bold>Task {task.id}: {task.title}</Text>
							{task.description && (
								<Text color={theme.text}>{task.description}</Text>
							)}
							{task.priority && (
								<Text color={theme.text}>Priority: {task.priority}</Text>
							)}
							{task.dependencies && task.dependencies.length > 0 && (
								<Text color={theme.text}>
									Dependencies: {task.dependencies.map(d => `Task ${d.id || d}`).join(', ')}
								</Text>
							)}
						</Box>
						{result.data.telemetryData && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>
									AI Model: {result.data.telemetryData.modelUsed} | 
									Cost: ${result.data.telemetryData.totalCost?.toFixed(4) || '0.00'}
								</Text>
							</Box>
						)}
					</Box>
				);
			}
			break;
		}
		
		case 'expand_task': {
			if (result.data?.subtasks) {
				const subtasks = result.data.subtasks;
				const parentTask = result.data.parentTask;
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>✨ Task expanded successfully!</Text>
						{parentTask && (
							<Box marginLeft={2}>
								<Text color={theme.accent}>Task {parentTask.id}: {parentTask.title}</Text>
							</Box>
						)}
						<Box marginLeft={2} marginTop={1}>
							<Text color={theme.text}>Created {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}:</Text>
						</Box>
						{subtasks.map((subtask, idx) => (
							<Box key={idx} marginLeft={4}>
								<Text color={theme.text}>
									{getStatusEmoji(subtask.status)} {subtask.id}: {subtask.title}
								</Text>
							</Box>
						))}
						{result.data.telemetryData && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>
									AI Model: {result.data.telemetryData.modelUsed} | 
									Cost: ${result.data.telemetryData.totalCost?.toFixed(4) || '0.00'}
								</Text>
							</Box>
						)}
					</Box>
				);
			}
			break;
		}
		
		case 'update_task':
		case 'update_subtask': {
			if (result.data?.task) {
				const task = result.data.task;
				const isSubtask = name === 'update_subtask';
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>
							✓ {isSubtask ? 'Subtask' : 'Task'} updated successfully!
						</Text>
						<Box marginLeft={2}>
							<Text color={theme.accent}>
								{isSubtask ? 'Subtask' : 'Task'} {task.id}: {task.title}
							</Text>
							{isSubtask && (
								<Text color={theme.textDim}>
									Progress notes have been appended with timestamp
								</Text>
							)}
						</Box>
						{result.data.telemetryData && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>
									AI Model: {result.data.telemetryData.modelUsed} | 
									Cost: ${result.data.telemetryData.totalCost?.toFixed(4) || '0.00'}
								</Text>
							</Box>
						)}
					</Box>
				);
			}
			break;
		}
		
		case 'research': {
			if (result.data?.response) {
				// Show more of the research response
				const response = result.data.response;
				const truncated = response.length > 500 ? response.substring(0, 500) + '...' : response;
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>🔍 Research completed:</Text>
						<Box marginLeft={2} marginTop={1}>
							<Text color={theme.text}>{truncated}</Text>
						</Box>
						{response.length > 500 && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>
									(Showing first 500 characters of {response.length} total)
								</Text>
							</Box>
						)}
						{result.data.savedTo && (
							<Box marginTop={1}>
								<Text color={theme.success}>
									✓ Research saved to {result.data.savedTo}
								</Text>
							</Box>
						)}
						{result.data.telemetryData && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>
									Research Model: {result.data.telemetryData.modelUsed} | 
									Cost: ${result.data.telemetryData.totalCost?.toFixed(4) || '0.00'}
								</Text>
							</Box>
						)}
					</Box>
				);
			}
			break;
		}
		
		case 'list_tags': {
			if (result.data?.tags) {
				const tags = result.data.tags;
				const currentTag = result.data.currentTag;
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>📁 Available tags ({tags.length}):</Text>
						{tags.map((tag, idx) => (
							<Box key={idx} marginLeft={2}>
								<Text color={theme.text}>
									{tag.name === currentTag ? '▶ ' : '  '}
									<Text color={tag.name === currentTag ? theme.accent : theme.text} bold={tag.name === currentTag}>
										{tag.name}
									</Text>
									<Text color={theme.textDim}> ({tag.taskCount} tasks, {tag.completedCount} done)</Text>
								</Text>
								{tag.description && (
									<Box marginLeft={4}>
										<Text color={theme.textDim}>{tag.description}</Text>
									</Box>
								)}
							</Box>
						))}
					</Box>
				);
			}
			break;
		}
		
		case 'use_tag': {
			if (result.data?.tag) {
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>✓ Switched to tag: {result.data.tag}</Text>
						{result.data.taskCount !== undefined && (
							<Text color={theme.textDim}>
								This tag contains {result.data.taskCount} task{result.data.taskCount !== 1 ? 's' : ''}
							</Text>
						)}
					</Box>
				);
			}
			break;
		}
		
		case 'add_tag': {
			if (result.data?.tag) {
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>✨ New tag created: {result.data.tag}</Text>
						{result.data.copiedFrom && (
							<Text color={theme.textDim}>
								Tasks copied from: {result.data.copiedFrom}
							</Text>
						)}
					</Box>
				);
			}
			break;
		}
		
		case 'analyze_project_complexity': {
			if (result.data?.report) {
				const report = result.data.report;
				const highComplexity = report.tasks?.filter(t => t.complexityScore >= 8) || [];
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>📊 Complexity analysis complete!</Text>
						{report.summary && (
							<Box marginLeft={2} marginTop={1}>
								<Text color={theme.text}>Average complexity: {report.summary.averageComplexity?.toFixed(1) || 'N/A'}</Text>
								<Text color={theme.text}>Tasks needing expansion: {report.summary.tasksNeedingExpansion || 0}</Text>
							</Box>
						)}
						{highComplexity.length > 0 && (
							<Box marginTop={1} flexDirection="column">
								<Text color={theme.warning}>High complexity tasks:</Text>
								{highComplexity.slice(0, 3).map((task, idx) => (
									<Box key={idx} marginLeft={2}>
										<Text color={theme.text}>
											Task {task.id}: {task.title} (score: {task.complexityScore})
										</Text>
									</Box>
								))}
							</Box>
						)}
						{result.data.telemetryData && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>
									AI Model: {result.data.telemetryData.modelUsed} | 
									Cost: ${result.data.telemetryData.totalCost?.toFixed(4) || '0.00'}
								</Text>
							</Box>
						)}
					</Box>
				);
			}
			break;
		}
		
		case 'move_task': {
			if (result.data?.movedTasks) {
				const moves = result.data.movedTasks;
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>✓ Task{moves.length > 1 ? 's' : ''} moved successfully!</Text>
						{moves.map((move, idx) => (
							<Box key={idx} marginLeft={2}>
								<Text color={theme.text}>
									Task {move.from} → {move.to}
								</Text>
							</Box>
						))}
					</Box>
				);
			}
			break;
		}
		
		case 'add_dependency':
		case 'remove_dependency': {
			const action = name === 'add_dependency' ? 'added' : 'removed';
			if (result.data?.task) {
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>✓ Dependency {action} successfully!</Text>
						<Box marginLeft={2}>
							<Text color={theme.text}>
								Task {result.data.task.id} now has {result.data.task.dependencies?.length || 0} dependencies
							</Text>
						</Box>
					</Box>
				);
			}
			break;
		}
		
		case 'clear_subtasks': {
			if (result.data?.clearedCount !== undefined) {
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>✓ Cleared subtasks from {result.data.clearedCount} task{result.data.clearedCount !== 1 ? 's' : ''}</Text>
					</Box>
				);
			}
			break;
		}
		
		case 'remove_task': {
			if (result.data?.removedId) {
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>✓ Task {result.data.removedId} removed successfully</Text>
						{result.data.cleanedDependencies && result.data.cleanedDependencies > 0 && (
							<Text color={theme.textDim}>
								Cleaned up {result.data.cleanedDependencies} dependency reference{result.data.cleanedDependencies !== 1 ? 's' : ''}
							</Text>
						)}
					</Box>
				);
			}
			break;
		}
		
		default:
			// For unknown tools, show a generic success message with any data
			if (result.success) {
				return (
					<Box flexDirection="column">
						<Text color={theme.success}>✓ {formatToolName(name)} completed successfully</Text>
						{result.data && (
							<Box marginLeft={2}>
								<Text color={theme.textDim}>
									{JSON.stringify(result.data, null, 2).substring(0, 200)}
									{JSON.stringify(result.data).length > 200 && '...'}
								</Text>
							</Box>
						)}
					</Box>
				);
			}
	}
	
	// Fallback for unhandled cases
	return (
		<Box flexDirection="column">
			<Text color={theme.warning}>Tool completed: {formatToolName(name)}</Text>
			<Box marginLeft={2}>
				<Text color={theme.textDim}>
					{JSON.stringify(result.data || result, null, 2).substring(0, 200)}
					{JSON.stringify(result.data || result).length > 200 && '...'}
				</Text>
			</Box>
		</Box>
	);
};

// Helper to format tool names
const formatToolName = (name) => {
	return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Tool call display component
 */
const ToolCallDisplay = ({ toolCall }) => {
	const theme = getCurrentTheme();
	const statusColors = {
		pending: theme.warning,
		executing: theme.info,
		completed: theme.success,
		failed: theme.error
	};

	// Format the tool name for display
	const formatToolName = (name) => {
		return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	};

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box>
				<Text color={theme.accent}>🔧 </Text>
				<Text color={statusColors[toolCall.status] || theme.text}>
					{formatToolName(toolCall.name)}
				</Text>
				{toolCall.status === 'executing' && (
					<Text color={theme.info}>
						{' '}
						<Spinner type="dots" />
					</Text>
				)}
			</Box>
			{toolCall.result && toolCall.status === 'completed' && (
				<Box marginLeft={3}>
					{formatToolResponse(toolCall)}
				</Box>
			)}
			{toolCall.error && (
				<Box marginLeft={3}>
					<Text color={theme.error}>Error: {toolCall.error}</Text>
				</Box>
			)}
		</Box>
	);
};

/**
 * Main chat screen component
 */
export const ChatScreen = ({ mcpClient, projectRoot, onExit }) => {
	
	debugLog('Component rendering', { 
		hasMcpClient: !!mcpClient, 
		projectRoot,
		mcpClientType: mcpClient?.constructor?.name 
	});
	
	const theme = getCurrentTheme();
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [streamingContent, setStreamingContent] = useState('');
	const [toolCalls, setToolCalls] = useState([]);
	const [error, setError] = useState(null);

	// Initialize session and handler
	const sessionRef = useRef(null);
	const handlerRef = useRef(null);
	const accumulatedContentRef = useRef('');

	// Initialize chat session and AI handler
	const chatSession = useMemo(() => {
		debugLog('Creating ChatSession', { projectRoot });
		// Pass null for sessionId (it will generate one), mcpClient, and projectRoot
		return new ChatSession(null, mcpClient, projectRoot);
	}, [projectRoot, mcpClient]);

	const aiHandler = useMemo(() => {
		debugLog('Creating AIMessageHandler', {
			hasChatSession: !!chatSession,
			hasMcpClient: !!mcpClient,
			hasSession: !!mcpClient?.session,
			hasEnv: !!mcpClient?.session?.env,
			hasAnthropicKey: !!mcpClient?.session?.env?.ANTHROPIC_API_KEY
		});
		
		return new AIMessageHandler(chatSession, mcpClient);
	}, [chatSession, mcpClient]);

	// Initialize on mount
	useEffect(() => {
		sessionRef.current = chatSession;
		handlerRef.current = aiHandler;

		// Add initial system message
		const welcomeMsg = {
			id: Date.now(),
			role: 'assistant',
			content: 'Welcome to Task Master AI Chat! I can help you manage tasks, analyze complexity, and answer questions about your project.',
			timestamp: new Date()
		};
		setMessages([welcomeMsg]);
	}, [chatSession, aiHandler]);

	// Handle message submission
	const handleSubmit = useCallback(async () => {
		if (!input.trim() || isProcessing) return;

		const userInput = input.trim();
		setInput('');
		setError(null);

		// Handle commands
		if (userInput.startsWith('/')) {
			const command = userInput.slice(1).toLowerCase();
			
			if (command === 'clear') {
				// Clear all state
				setMessages([{
					id: Date.now(),
					role: 'assistant',
					content: 'Welcome to Task Master AI Chat! I can help you manage tasks, analyze complexity, and answer questions about your project.',
					timestamp: new Date()
				}]);
				setToolCalls([]);
				setError(null);
				setStreamingContent('');
				accumulatedContentRef.current = '';
				sessionRef.current?.clearMessages();
				return;
			}
			
			if (command === 'exit' || command === 'quit') {
				onExit();
				return;
			}
			
			if (command === 'help') {
				const helpMsg = {
					id: Date.now(),
					role: 'assistant',
					content: `Available commands:
• /clear - Clear the chat history
• /exit or /quit - Exit the chat
• /help - Show this help message

You can ask me about:
• Task management and organization
• Code analysis and suggestions
• Project structure and dependencies
• General programming questions`,
					timestamp: new Date()
				};
				setMessages(prev => [...prev, helpMsg]);
				return;
			}
			
			// Unknown command
			setError(`Unknown command: /${command}`);
			return;
		}

		// Add user message to display
		const userMsg = {
			id: Date.now(),
			role: 'user',
			content: userInput,
			timestamp: new Date()
		};
		setMessages(prev => [...prev, userMsg]);

		// Start processing
		setIsProcessing(true);
		setStreamingContent('');
		setToolCalls([]);
		accumulatedContentRef.current = ''; // Reset accumulated content

		// Create assistant message placeholder
		const assistantMsgId = Date.now() + 1;
		const assistantMsg = {
			id: assistantMsgId,
			role: 'assistant',
			content: '',
			timestamp: new Date()
		};
		setMessages(prev => [...prev, assistantMsg]);

		try {
			// Call AI handler
			await handlerRef.current.handleUserMessage(userInput, {
				onChunk: (chunk) => {
					accumulatedContentRef.current += chunk;
					setStreamingContent(accumulatedContentRef.current);
				},
				onToolCall: (toolCall) => {
					setToolCalls(prev => [...prev, toolCall]);
				},
				onComplete: () => {
					// Update the assistant message with final content
					const finalContent = accumulatedContentRef.current;
					setMessages(prev => prev.map(msg => 
						msg.id === assistantMsgId 
							? { ...msg, content: finalContent }
							: msg
					));
					setStreamingContent('');
					setIsProcessing(false);
				},
				onError: (error) => {
					setError(error.message);
					setIsProcessing(false);
					// Remove the empty assistant message
					setMessages(prev => prev.filter(msg => msg.id !== assistantMsgId));
				}
			});
		} catch (error) {
			setError(error.message);
			setIsProcessing(false);
			// Remove the empty assistant message
			setMessages(prev => prev.filter(msg => msg.id !== assistantMsgId));
		}
	}, [input, isProcessing, onExit, streamingContent]);

	// Handle Ctrl+C to cancel
	useEffect(() => {
		const handleInterrupt = () => {
			if (isProcessing && handlerRef.current) {
				handlerRef.current.cancelStream();
				setIsProcessing(false);
				setStreamingContent('');
			}
		};

		process.on('SIGINT', handleInterrupt);
		return () => process.off('SIGINT', handleInterrupt);
	}, [isProcessing]);

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="round"
				borderColor={theme.accent}
				paddingX={1}
				marginBottom={1}
			>
				<Text color={theme.accent} bold>
					💬 Task Master AI Chat
				</Text>
				<Text color={theme.textDim}> - Type /help for commands</Text>
			</Box>

			{/* Messages area */}
			<Box
				flexDirection="column"
				flexGrow={1}
				paddingX={1}
				overflow="hidden"
			>
				{messages.map((msg) => (
					<Message key={msg.id} message={msg} />
				))}
				
				{/* Streaming message */}
				{streamingContent && (
					<Message
						message={{
							role: 'assistant',
							content: streamingContent,
							metadata: { toolCalls }
						}}
						isStreaming={true}
					/>
				)}

				{/* Current tool calls */}
				{!streamingContent && toolCalls.length > 0 && (
					<Box flexDirection="column" marginLeft={3}>
						{toolCalls.map((toolCall, idx) => (
							<ToolCallDisplay key={idx} toolCall={toolCall} />
						))}
					</Box>
				)}

				{/* Error display */}
				{error && (
					<Box marginTop={1}>
						<Text color={theme.error}>❌ Error: {error}</Text>
					</Box>
				)}
			</Box>

			{/* Input area */}
			<Box
				borderStyle="single"
				borderColor={isProcessing ? theme.warning : theme.border}
				paddingX={1}
				marginTop={1}
			>
				<Text color={theme.text}>
					{isProcessing ? '🤖 ' : '💬 '}
				</Text>
				<TextInput
					value={input}
					onChange={setInput}
					onSubmit={handleSubmit}
					placeholder={
						isProcessing
							? 'AI is thinking...'
							: 'Chat with AI or type / for commands'
					}
					focus={!isProcessing}
				/>
			</Box>

			{/* Status bar */}
			<Box justifyContent="space-between" paddingX={1} marginTop={1}>
				<Text color={theme.textDim}>
					{isProcessing && 'AI is processing...'}
					{!isProcessing && messages.length > 0 && `${messages.length} messages`}
				</Text>
				<Text color={theme.textDim}>
					/clear: Clear chat | /exit: Exit
				</Text>
			</Box>
		</Box>
	);
}; 