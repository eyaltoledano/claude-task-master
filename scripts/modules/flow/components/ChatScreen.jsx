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

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box>
				<Text color={theme.accent}>🔧 </Text>
				<Text color={statusColors[toolCall.status] || theme.text}>
					{toolCall.name}
				</Text>
				{toolCall.status === 'executing' && (
					<Text color={theme.info}>
						{' '}
						<Spinner type="dots" />
					</Text>
				)}
			</Box>
			{toolCall.result && (
				<Box marginLeft={3}>
					<Text color={theme.textDim}>
						{JSON.stringify(toolCall.result, null, 2).substring(0, 200)}
						{JSON.stringify(toolCall.result).length > 200 && '...'}
					</Text>
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
	console.log('[ChatScreen] Component rendering with:', { 
		hasMcpClient: !!mcpClient, 
		projectRoot,
		mcpClientType: mcpClient?.constructor?.name 
	});
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
		console.log('[ChatScreen] Creating ChatSession with projectRoot:', projectRoot);
		debugLog('Creating ChatSession', { projectRoot });
		// Pass null for sessionId (it will generate one), mcpClient, and projectRoot
		return new ChatSession(null, mcpClient, projectRoot);
	}, [projectRoot, mcpClient]);

	const aiHandler = useMemo(() => {
		console.log('[ChatScreen] Creating AIMessageHandler with:', {
			hasChatSession: !!chatSession,
			hasMcpClient: !!mcpClient
		});
		// Debug log the session content
		console.log('[ChatScreen] mcpClient.session:', mcpClient?.session);
		console.log('[ChatScreen] mcpClient.session.env:', mcpClient?.session?.env);
		console.log('[ChatScreen] Has ANTHROPIC_API_KEY in session.env:', !!mcpClient?.session?.env?.ANTHROPIC_API_KEY);
		
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
		console.log('[ChatScreen] useEffect - setting up refs');
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
		console.log('[ChatScreen] handleSubmit called with input:', input);
		
		if (!input.trim() || isProcessing) return;

		const userInput = input.trim();
		setInput('');
		setError(null);

		// Handle commands
		if (userInput.startsWith('/')) {
			console.log('[ChatScreen] Processing command:', userInput);
			const command = userInput.slice(1).toLowerCase();
			
			if (command === 'clear') {
				setMessages([]);
				sessionRef.current?.clearMessages();
				return;
			}
			
			if (command === 'exit' || command === 'quit') {
				onExit();
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

		console.log('[ChatScreen] Calling AI handler...');

		try {
			// Call AI handler
			await handlerRef.current.handleUserMessage(userInput, {
				onChunk: (chunk) => {
					console.log('[ChatScreen] Received chunk:', chunk);
					accumulatedContentRef.current += chunk;
					setStreamingContent(accumulatedContentRef.current);
				},
				onToolCall: (toolCall) => {
					console.log('[ChatScreen] Tool call:', toolCall);
					setToolCalls(prev => [...prev, toolCall]);
				},
				onComplete: () => {
					console.log('[ChatScreen] AI response complete, content length:', accumulatedContentRef.current.length);
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
					console.error('[ChatScreen] AI error:', error);
					setError(error.message);
					setIsProcessing(false);
					// Remove the empty assistant message
					setMessages(prev => prev.filter(msg => msg.id !== assistantMsgId));
				}
			});
		} catch (error) {
			console.error('[ChatScreen] Unexpected error:', error);
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
					Ctrl+C: Cancel | /clear: Clear chat | /exit: Exit
				</Text>
			</Box>
		</Box>
	);
}; 