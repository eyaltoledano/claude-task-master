import React, { useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import {
	useComponentTheme,
	useTerminalSize,
	useStateAndRef,
	useKeypress,
	usePhraseCycler
} from '../shared/hooks/index.js';
import { LoadingSpinner } from '../shared/components/ui/LoadingSpinner.jsx';

export function ClaudeActiveSession({
	activeSession,
	messages = [],
	isProcessing = false,
	prompt = '',
	onPromptChange,
	onSendPrompt,
	onContinue,
	onAbort,
	onBack,
	keyInsights = [],
	config = null
}) {
	const { theme } = useComponentTheme('claudeActiveSession');
	const { maxContentWidth, isNarrow, terminalHeight } = useTerminalSize();
	const [focusedInput, setFocusedInput, focusedInputRef] =
		useStateAndRef(false);
	const abortControllerRef = useRef(null);

	// Cycling phrases for processing state
	const { currentPhrase } = usePhraseCycler('claudeProcessing', isProcessing);

	// Keyboard handling for active session
	useKeypress(
		{
			'ctrl+c': () => {
				if (isProcessing && onAbort) {
					onAbort();
				}
			},
			esc: () => {
				if (!isProcessing && onBack) {
					onBack();
				}
			},
			tab: () => {
				setFocusedInput(!focusedInputRef.current);
			}
		},
		{ isActive: true }
	);

	// Auto-scroll to bottom when new messages arrive
	const messagesEndRef = useRef(null);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView?.({ behavior: 'smooth' });
		}
	}, [messages.length]);

	const renderSessionHeader = () => {
		if (!activeSession) return null;

		return (
			<Box flexDirection="column" marginBottom={1} paddingX={1}>
				<Box>
					<Text color={theme.accent} bold>
						Active Session: {activeSession.sessionId?.slice(0, 12)}...
					</Text>
					{activeSession.timestamp && (
						<Text color={theme.text.secondary}>
							{' '}
							({new Date(activeSession.timestamp).toLocaleString()})
						</Text>
					)}
				</Box>

				{activeSession.subtaskId && (
					<Text color={theme.text.secondary}>
						Subtask: {activeSession.subtaskId}
					</Text>
				)}
			</Box>
		);
	};

	const renderMessage = (message, index) => {
		const isUser = message.type === 'user';
		const isSystem = message.type === 'system';
		const isAssistant = message.type === 'assistant';
		const isError = message.type === 'error';

		let content = '';
		if (typeof message.content === 'string') {
			content = message.content;
		} else if (message.content?.[0]?.text) {
			content = message.content[0].text;
		} else if (message.message?.content?.[0]?.text) {
			content = message.message.content[0].text;
		}

		const getMessageColor = () => {
			if (isError) return 'red';
			if (isUser) return theme.text.primary;
			if (isSystem) return theme.text.tertiary;
			if (isAssistant) return 'cyan';
			return theme.text.secondary;
		};

		const getMessagePrefix = () => {
			if (isError) return '❌ Error: ';
			if (isUser) return '👤 You: ';
			if (isSystem) return '⚙️  System: ';
			if (isAssistant) return '🤖 Claude: ';
			return '';
		};

		return (
			<Box
				key={`message-${index}-${message.type}-${content.slice(0, 50)}`}
				flexDirection="column"
				marginBottom={1}
				paddingX={1}
				width={maxContentWidth}
			>
				<Text color={getMessageColor()}>{getMessagePrefix()}</Text>
				<Box paddingLeft={2}>
					<Text color={getMessageColor()}>
						{content.length > 2000
							? `${content.substring(0, 2000)}...\n[Content truncated - ${content.length} total characters]`
							: content}
					</Text>
				</Box>
			</Box>
		);
	};

	const renderMessages = () => {
		const maxVisibleMessages = Math.floor((terminalHeight - 10) / 4); // Rough calculation
		const displayMessages = messages.slice(-maxVisibleMessages);

		if (displayMessages.length === 0 && !isProcessing) {
			return (
				<Box justifyContent="center" paddingY={2}>
					<Text color={theme.text.secondary}>
						No messages yet. Start a conversation below.
					</Text>
				</Box>
			);
		}

		return (
			<Box flexDirection="column" overflowY="auto">
				{displayMessages.map((message, index) => renderMessage(message, index))}
				{messages.length > displayMessages.length && (
					<Box paddingX={1} marginBottom={1}>
						<Text color={theme.text.tertiary}>
							... {messages.length - displayMessages.length} earlier messages
						</Text>
					</Box>
				)}
				<div ref={messagesEndRef} />
			</Box>
		);
	};

	const renderKeyInsights = () => {
		if (keyInsights.length === 0) return null;

		return (
			<Box flexDirection="column" marginY={1} paddingX={1}>
				<Text color={theme.accent} bold>
					💡 Key Insights ({keyInsights.length}):
				</Text>
				{keyInsights.slice(-3).map((insight, index) => (
					<Box
						key={`insight-${index}-${insight.category}`}
						paddingLeft={2}
						marginTop={1}
					>
						<Text color="yellow">•</Text>
						<Text color={theme.text.secondary}>
							{' '}
							{insight.category}: {insight.text.substring(0, 100)}
							{insight.text.length > 100 ? '...' : ''}
						</Text>
					</Box>
				))}
				{keyInsights.length > 3 && (
					<Box paddingLeft={2}>
						<Text color={theme.text.tertiary}>
							... and {keyInsights.length - 3} more insights
						</Text>
					</Box>
				)}
			</Box>
		);
	};

	const renderProcessingStatus = () => {
		if (!isProcessing) return null;

		return (
			<Box paddingX={1} marginY={1}>
				<LoadingSpinner />
				<Text color={theme.accent}> {currentPhrase}</Text>
				{onAbort && (
					<Text color={theme.text.secondary}> (Press Ctrl+C to abort)</Text>
				)}
			</Box>
		);
	};

	const renderInputArea = () => {
		const hasActiveSession = !!activeSession?.sessionId;
		const placeholder = hasActiveSession
			? 'Continue the conversation...'
			: 'Enter your query for Claude Code...';

		const buttonText = hasActiveSession ? 'Continue' : 'Start Query';
		const action = hasActiveSession ? onContinue : onSendPrompt;

		return (
			<Box flexDirection="column" marginTop={1}>
				{/* Input field */}
				<Box paddingX={1} marginBottom={1}>
					<Text color={theme.text.secondary}>
						{hasActiveSession ? '🔄 Continue: ' : '🚀 Query: '}
					</Text>
					<Box flexGrow={1} marginLeft={1}>
						<TextInput
							value={prompt}
							onChange={onPromptChange}
							placeholder={placeholder}
							focus={focusedInputRef.current}
							showCursor={true}
						/>
					</Box>
				</Box>

				{/* Action buttons */}
				<Box paddingX={1}>
					<Text color={theme.text.secondary}>
						[Enter] {buttonText} • [Tab] Focus • [Esc] Back
						{isProcessing && ' • [Ctrl+C] Abort'}
					</Text>
				</Box>
			</Box>
		);
	};

	const renderConfigStatus = () => {
		if (!config) return null;

		return (
			<Box paddingX={1} marginBottom={1}>
				<Text color={theme.text.tertiary}>
					Config: {config.permissionMode || 'default'} mode
					{config.allowedTools && ` • Tools: ${config.allowedTools.join(', ')}`}
				</Text>
			</Box>
		);
	};

	// Handle Enter key in input
	const handleInputSubmit = () => {
		if (!prompt.trim() || isProcessing) return;

		if (activeSession?.sessionId && onContinue) {
			onContinue();
		} else if (onSendPrompt) {
			onSendPrompt();
		}
	};

	return (
		<Box flexDirection="column" width={maxContentWidth}>
			{/* Session header */}
			{renderSessionHeader()}

			{/* Config status */}
			{renderConfigStatus()}

			{/* Messages display */}
			{renderMessages()}

			{/* Processing status */}
			{renderProcessingStatus()}

			{/* Key insights */}
			{renderKeyInsights()}

			{/* Input area - always at bottom */}
			{!isProcessing && renderInputArea()}

			{/* Handle Enter key submission */}
			<TextInput
				value=""
				onChange={() => {}}
				onSubmit={handleInputSubmit}
				showCursor={false}
				focus={false}
				style={{ display: 'none' }}
			/>
		</Box>
	);
}
