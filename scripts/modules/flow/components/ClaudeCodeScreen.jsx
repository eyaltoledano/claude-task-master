import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { SimpleTable } from './SimpleTable.jsx';
import { Toast } from './Toast.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { getTheme } from '../theme.js';
import { useAppContext } from '../index.jsx';

function ClaudeCodeScreen({
	backend,
	onBack,
	mode: initialMode = 'list',
	initialContext = null,
	returnTo = 'welcome',
	returnData = null
}) {
	const { setCurrentScreen } = useAppContext();
	const [config, setConfig] = useState(null);
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(null);
	const [mode, setMode] = useState(
		initialMode === 'subtask-implementation' ? 'active-session' : 'list'
	);
	const [prompt, setPrompt] = useState('');
	const [activeSession, setActiveSession] = useState(null);
	const [messages, setMessages] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [showMenu, setShowMenu] = useState(false);
	const [keyInsights, setKeyInsights] = useState([]);
	const [waitingForConfig, setWaitingForConfig] = useState(false);
	const abortControllerRef = useRef(null);
	const theme = getTheme();

	// Constants
	const VISIBLE_ROWS = 15;

	useEffect(() => {
		loadData();

		// If we have initial context for subtask implementation, start the session
		if (initialMode === 'subtask-implementation' && initialContext) {
			console.log('[ClaudeCodeScreen] Starting subtask implementation mode', {
				subtaskId: initialContext?.currentSubtask?.id,
				hasResearch: !!initialContext?.researchContext
			});
			startSubtaskImplementationSession();
		}

		return () => {
			// Cleanup abort controller on unmount
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	const loadData = async () => {
		setLoading(true);
		try {
			const [configResult, sessionsResult] = await Promise.all([
				backend.getClaudeCodeConfig(),
				backend.getClaudeCodeSessions()
			]);

			if (configResult.success) {
				setConfig(configResult.config);
			}
			if (sessionsResult.success) {
				setSessions(sessionsResult.sessions);
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const buildSubtaskPrompt = () => {
		const {
			currentSubtask,
			parentTask,
			dependencies,
			researchContext,
			worktreePath
		} = initialContext;

		return `
I'm implementing a specific subtask within a larger system. Here's the context:

## Current Task: ${currentSubtask.id} - ${currentSubtask.title}
Status: ${currentSubtask.status}
${currentSubtask.description}

### Progress So Far:
${currentSubtask.details || 'No progress logged yet'}

## Parent Task Context: ${parentTask.title}
${parentTask.description}

### Sibling Subtasks:
${parentTask.subtasks
	.map(
		(st) =>
			`- [${st.status}] ${st.id}: ${st.title}${st.id == currentSubtask.id.split('.')[1] ? ' ← CURRENT' : ''}`
	)
	.join('\n')}

## Completed Dependencies:
${
	dependencies.length > 0
		? dependencies
				.map(
					(dep) =>
						`### ${dep.id}: ${dep.title}
${dep.keyDecisions || 'No key decisions recorded'}`
				)
				.join('\n\n')
		: 'No dependencies'
}

## Research Findings:
${researchContext || 'No research context available'}

Working directory: ${worktreePath}
Please help me implement subtask ${currentSubtask.id}, maintaining consistency with the existing architecture.
		`.trim();
	};

	const buildSystemPrompt = () => {
		const basePrompt =
			config?.systemPrompts?.implementation ||
			'You are helping implement a task. Focus on clean, maintainable code.';

		return `${basePrompt}

Additional context:
- You are implementing subtask ${initialContext.currentSubtask.id} of task ${initialContext.parentTask.id}
- Maintain consistency with completed sibling subtasks
- The working directory is ${initialContext.worktreePath}
- Focus on practical implementation that aligns with the project structure
		`.trim();
	};

	const startSubtaskImplementationSession = async () => {
		if (!config) {
			// Wait for config to load
			setWaitingForConfig(true);
			setTimeout(startSubtaskImplementationSession, 100);
			return;
		}

		setWaitingForConfig(false);
		setLoading(false);
		setIsProcessing(true);
		setMessages([]);

		const subtaskPrompt = buildSubtaskPrompt();
		const systemPrompt = buildSystemPrompt();

		console.log('[ClaudeCodeScreen] Starting Claude Code query', {
			promptLength: subtaskPrompt.length,
			hasResearchContext: !!initialContext?.researchContext,
			worktreePath: initialContext?.worktreePath
		});

		abortControllerRef.current = new AbortController();

		try {
			const result = await backend.claudeCodeQuery(subtaskPrompt, {
				maxTurns: 10, // Allow more turns for implementation
				permissionMode: config?.permissionMode || 'acceptEdits',
				allowedTools: config?.allowedTools || ['Read', 'Write', 'Bash'],
				systemPrompt,
				cwd: initialContext.worktreePath,
				abortController: abortControllerRef.current,
				onMessage: (message) => {
					setMessages((prev) => [...prev, message]);

					// Extract key insights from Claude's responses
					if (message.type === 'assistant') {
						const insights = extractKeyInsights(
							message.message.content?.[0]?.text || ''
						);
						if (insights.length > 0) {
							setKeyInsights((prev) => [...prev, ...insights]);
						}
					}
				}
			});

			if (result.success && result.sessionId) {
				setActiveSession({
					sessionId: result.sessionId,
					prompt: subtaskPrompt,
					timestamp: new Date().toISOString(),
					subtaskId: initialContext.currentSubtask.id
				});

				// Save session with subtask reference
				await backend.saveClaudeCodeSession({
					sessionId: result.sessionId,
					prompt: subtaskPrompt,
					lastUpdated: new Date().toISOString(),
					metadata: {
						type: 'subtask-implementation',
						subtaskId: initialContext.currentSubtask.id,
						parentTaskId: initialContext.parentTask.id
					}
				});

				setSuccess('Claude Code session started for subtask implementation');
			} else if (result.error) {
				setError(result.error);
				setTimeout(() => handleBack(), 3000);
			}
		} catch (err) {
			setError(err.message);
			setTimeout(() => handleBack(), 3000);
		} finally {
			setIsProcessing(false);
			abortControllerRef.current = null;
		}
	};

	const extractKeyInsights = (text) => {
		const insights = [];
		const patterns = [
			{ pattern: /I've implemented/i, category: 'implementation' },
			{ pattern: /The approach I've taken/i, category: 'approach' },
			{ pattern: /Important to note/i, category: 'important' },
			{ pattern: /This ensures/i, category: 'reasoning' },
			{ pattern: /I've added error handling/i, category: 'error-handling' },
			{ pattern: /For security/i, category: 'security' },
			{ pattern: /Performance consideration/i, category: 'performance' }
		];

		const lines = text.split('\n');
		lines.forEach((line, idx) => {
			patterns.forEach(({ pattern, category }) => {
				if (pattern.test(line)) {
					const insight = lines
						.slice(idx, idx + 3)
						.join('\n')
						.trim();
					insights.push({ category, text: insight });
				}
			});
		});

		return insights;
	};

	const handleBack = async () => {
		// If we're in subtask implementation mode and have insights, save them
		if (initialMode === 'subtask-implementation' && keyInsights.length > 0) {
			try {
				const insightSummary = summarizeInsights(keyInsights);
				await backend.updateSubtask({
					id: initialContext.currentSubtask.id,
					prompt: `Claude Code session insights:\n${insightSummary}`,
					research: false
				});
				setSuccess('Subtask updated with session insights');
			} catch (err) {
				console.error('Failed to update subtask:', err);
			}
		}

		// Navigate back with return data
		if (returnTo === 'tasks' && returnData) {
			setCurrentScreen('tasks', returnData);
		} else {
			onBack();
		}
	};

	const summarizeInsights = (insights) => {
		const grouped = insights.reduce((acc, { category, text }) => {
			if (!acc[category]) acc[category] = [];
			acc[category].push(text);
			return acc;
		}, {});

		return Object.entries(grouped)
			.map(
				([category, texts]) =>
					`### ${category.charAt(0).toUpperCase() + category.slice(1)}:\n${texts.join('\n\n')}`
			)
			.join('\n\n');
	};

	const handleNewQuery = async () => {
		if (!prompt.trim()) return;

		setIsProcessing(true);
		setMessages([]);
		setMode('active-session');

		abortControllerRef.current = new AbortController();

		try {
			const result = await backend.claudeCodeQuery(prompt, {
				maxTurns: config?.defaultMaxTurns || 3,
				permissionMode: config?.permissionMode || 'acceptEdits',
				allowedTools: config?.allowedTools || ['Read', 'Write', 'Bash'],
				abortController: abortControllerRef.current,
				onMessage: (message) => {
					setMessages((prev) => [...prev, message]);
				}
			});

			if (result.success && result.sessionId) {
				setActiveSession({
					sessionId: result.sessionId,
					prompt,
					timestamp: new Date().toISOString()
				});

				// Save session
				await backend.saveClaudeCodeSession({
					sessionId: result.sessionId,
					prompt,
					lastUpdated: new Date().toISOString()
				});

				setSuccess('Query completed successfully');
				// Reload sessions to include the new one
				loadData();
			} else if (result.error) {
				setError(result.error);
				setMode('list');
			}
		} catch (err) {
			setError(err.message);
			setMode('list');
		} finally {
			setIsProcessing(false);
			abortControllerRef.current = null;
		}
	};

	const handleContinue = async () => {
		if (!prompt.trim()) return;

		setIsProcessing(true);
		abortControllerRef.current = new AbortController();

		try {
			const result = await backend.claudeCodeContinue(prompt, {
				abortController: abortControllerRef.current,
				onMessage: (message) => {
					setMessages((prev) => [...prev, message]);
				}
			});

			if (result.success) {
				setSuccess('Continued conversation successfully');
				setPrompt('');
			} else if (result.error) {
				setError(result.error);
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setIsProcessing(false);
			abortControllerRef.current = null;
		}
	};

	const handleResume = async (sessionId) => {
		setMode('active-session');
		setIsProcessing(true);
		setMessages([]);
		setActiveSession({ sessionId });

		abortControllerRef.current = new AbortController();

		try {
			const result = await backend.claudeCodeResume(sessionId, '', {
				abortController: abortControllerRef.current,
				onMessage: (message) => {
					setMessages((prev) => [...prev, message]);
				}
			});

			if (!result.success && result.error) {
				setError(result.error);
				setMode('list');
			}
		} catch (err) {
			setError(err.message);
			setMode('list');
		} finally {
			setIsProcessing(false);
			abortControllerRef.current = null;
		}
	};

	const handleAbort = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			setSuccess('Operation aborted');
			setIsProcessing(false);
		}
	};

	useInput((input, key) => {
		if (key.escape) {
			if (isProcessing && abortControllerRef.current) {
				handleAbort();
			} else if (mode === 'active-session') {
				setMode('list');
			} else if (mode === 'new-query') {
				setMode('list');
			} else if (showMenu) {
				setShowMenu(false);
			} else {
				handleBack();
			}
			return;
		}

		// Handle menu mode
		if (showMenu) {
			if (input === '1') {
				if (!config?.enabled) {
					setError(
						'Claude Code is not enabled. Configure it in settings first.'
					);
					return;
				}
				setShowMenu(false);
				setMode('new-query');
				setPrompt('');
			} else if (input === '2') {
				// Continue last session
				if (sessions.length > 0) {
					setShowMenu(false);
					handleResume(sessions[0].sessionId); // Most recent session
				} else {
					setError('No previous sessions found');
				}
			} else if (input === 'q') {
				setShowMenu(false);
			}
			return;
		}

		// Handle list mode navigation
		if (mode === 'list') {
			if (key.downArrow) {
				const newIndex = Math.min(selectedIndex + 1, sessions.length - 1);
				setSelectedIndex(newIndex);

				// Adjust scroll if needed
				if (newIndex >= scrollOffset + VISIBLE_ROWS) {
					setScrollOffset(newIndex - VISIBLE_ROWS + 1);
				}
			} else if (key.upArrow) {
				const newIndex = Math.max(selectedIndex - 1, 0);
				setSelectedIndex(newIndex);

				// Adjust scroll if needed
				if (newIndex < scrollOffset) {
					setScrollOffset(newIndex);
				}
			} else if (key.return && sessions.length > 0) {
				// Resume selected session
				const session = sessions[selectedIndex];
				handleResume(session.sessionId);
			} else if (input === 'n') {
				// New session
				if (!config?.enabled) {
					setError(
						'Claude Code is not enabled. Configure it in settings first.'
					);
					return;
				}
				setMode('new-query');
				setPrompt('');
			} else if (input === 'm') {
				// Show menu
				setShowMenu(true);
			} else if (input === 'r') {
				// Refresh sessions
				loadData();
			}
		} else if (mode === 'active-session' && !isProcessing) {
			if (key.return && prompt.trim()) {
				handleContinue();
			}
		}
	});

	const renderMessages = () => {
		return messages.map((msg, idx) => {
			if (msg.type === 'system' && msg.subtype === 'init') {
				return (
					<Box key={idx} marginBottom={1}>
						<Text color="gray">
							Session: {msg.session_id} | Model: {msg.model} | CWD: {msg.cwd}
						</Text>
					</Box>
				);
			} else if (msg.type === 'user') {
				return (
					<Box key={idx} marginBottom={1}>
						<Text color="cyan">User: </Text>
						<Text>{msg.message.content?.[0]?.text || ''}</Text>
					</Box>
				);
			} else if (msg.type === 'assistant') {
				const content = msg.message.content?.[0]?.text || '';
				return (
					<Box key={idx} marginBottom={1} flexDirection="column">
						<Text color="green">Claude: </Text>
						<Box marginLeft={2}>
							<Text>{content}</Text>
						</Box>
					</Box>
				);
			} else if (msg.type === 'result') {
				return (
					<Box key={idx} marginTop={1}>
						<Text color="yellow">
							Result: {msg.subtype} | Turns: {msg.num_turns} | Cost: $
							{msg.total_cost_usd?.toFixed(4) || '0.0000'}
						</Text>
					</Box>
				);
			}
			return null;
		});
	};

	// Show menu overlay
	if (showMenu) {
		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color="white">Claude Code</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>Menu</Text>
					</Box>
				</Box>

				{/* Menu Options */}
				<Box
					flexGrow={1}
					flexDirection="column"
					alignItems="center"
					justifyContent="center"
				>
					<Box
						borderStyle="round"
						borderColor={theme.border}
						padding={2}
						flexDirection="column"
					>
						<Text bold color={theme.accent} marginBottom={1}>
							Claude Code Options
						</Text>
						<Box flexDirection="column" gap={1}>
							<Text>1. Start new Claude Code session</Text>
							<Text>2. Continue last session</Text>
							<Text>q. Close menu</Text>
						</Box>
					</Box>
				</Box>

				{/* Footer */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					<Text color={theme.text}>
						Select an option or press ESC to go back
					</Text>
				</Box>
			</Box>
		);
	}

	// Loading state
	if (loading) {
		return (
			<Box flexDirection="column" height="100%">
				<Box justifyContent="center" alignItems="center" height="100%">
					<LoadingSpinner message="Loading Claude Code..." />
				</Box>
			</Box>
		);
	}

	// Waiting for config in subtask implementation mode
	if (waitingForConfig && initialMode === 'subtask-implementation') {
		return (
			<Box flexDirection="column" height="100%">
				<Box justifyContent="center" alignItems="center" height="100%">
					<LoadingSpinner message="Preparing Claude Code environment..." />
				</Box>
			</Box>
		);
	}

	// Processing subtask implementation startup
	if (
		isProcessing &&
		initialMode === 'subtask-implementation' &&
		messages.length === 0
	) {
		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color="white">Claude Code</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>Subtask Implementation</Text>
					</Box>
				</Box>

				<Box justifyContent="center" alignItems="center" flexGrow={1}>
					<Box flexDirection="column" alignItems="center">
						<LoadingSpinner message="Starting Claude Code session..." />
						<Box marginTop={1}>
							<Text color={theme.textDim}>
								Subtask: {initialContext?.currentSubtask?.title || 'Loading...'}
							</Text>
						</Box>
						<Box marginTop={1}>
							<Text color={theme.textDim}>
								This includes research findings and full context
							</Text>
						</Box>
					</Box>
				</Box>

				{/* Footer */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					<Text color={theme.text}>ESC to cancel</Text>
				</Box>
			</Box>
		);
	}

	// New query mode
	if (mode === 'new-query') {
		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color="white">Claude Code</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>New Session</Text>
					</Box>
				</Box>

				{/* Input Area */}
				<Box flexGrow={1} flexDirection="column" padding={2}>
					<Text bold marginBottom={1}>
						Enter your prompt for Claude Code:
					</Text>
					<Box>
						<Text color="cyan">❯ </Text>
						<TextInput
							value={prompt}
							onChange={setPrompt}
							onSubmit={handleNewQuery}
							placeholder="Describe what you want Claude to help with..."
						/>
					</Box>
					<Box marginTop={2}>
						<Text color={theme.textDim}>
							Press Enter to submit, ESC to cancel
						</Text>
					</Box>
				</Box>
			</Box>
		);
	}

	// Active session mode
	if (mode === 'active-session') {
		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color="white">Claude Code</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>Active Session</Text>
					</Box>
					{activeSession && (
						<Text color={theme.textDim}>[{activeSession.sessionId}]</Text>
					)}
				</Box>

				{/* Messages Area */}
				<Box flexGrow={1} flexDirection="column" padding={1} height={20}>
					{renderMessages()}
				</Box>

				{/* Input Area */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					{isProcessing ? (
						<Text color="yellow">
							<Spinner type="dots" /> Processing... (Press ESC to abort)
						</Text>
					) : (
						<Box flexDirection="column">
							<Text marginBottom={1}>Continue the conversation:</Text>
							<Box>
								<Text color="cyan">❯ </Text>
								<TextInput
									value={prompt}
									onChange={setPrompt}
									placeholder="Enter your follow-up..."
								/>
							</Box>
						</Box>
					)}
				</Box>
			</Box>
		);
	}

	// Sessions list view (default)
	const visibleSessions = sessions.slice(
		scrollOffset,
		scrollOffset + VISIBLE_ROWS
	);

	// Prepare table data
	const tableData = visibleSessions.map((session, displayIndex) => {
		const actualIndex = displayIndex + scrollOffset;
		const isSelected = actualIndex === selectedIndex;
		const date = new Date(session.lastUpdated || session.createdAt);

		return {
			' ': isSelected ? '→' : ' ',
			'Session ID': session.sessionId.substring(0, 8) + '...',
			Prompt: session.prompt?.substring(0, 50) + '...' || 'No prompt',
			Date: date.toLocaleDateString(),
			Time: date.toLocaleTimeString(),
			_renderCell: (col, value) => {
				const color = isSelected ? theme.selectionText : theme.text;
				return (
					<Text color={color} bold={isSelected}>
						{value}
					</Text>
				);
			}
		};
	});

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Box flexGrow={1}>
					<Text color={theme.accent}>Task Master</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color="white">Claude Code Sessions</Text>
				</Box>
				{config?.enabled ? (
					<Text color={theme.success}>[Enabled]</Text>
				) : (
					<Text color={theme.error}>[Disabled]</Text>
				)}
			</Box>

			{/* Sessions Table */}
			<Box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{sessions.length === 0 ? (
					<Box
						flexDirection="column"
						alignItems="center"
						justifyContent="center"
						flexGrow={1}
					>
						<Text color={theme.textDim}>No Claude Code sessions found</Text>
						<Text color={theme.textDim} marginTop={1}>
							Press 'n' to start a new session
						</Text>
					</Box>
				) : (
					<>
						<SimpleTable
							data={tableData}
							columns={[' ', 'Session ID', 'Prompt', 'Date', 'Time']}
							selectedIndex={selectedIndex - scrollOffset}
							borders={true}
						/>

						{/* Scroll indicator */}
						{sessions.length > VISIBLE_ROWS && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>
									{scrollOffset + 1}-
									{Math.min(scrollOffset + VISIBLE_ROWS, sessions.length)} of{' '}
									{sessions.length} sessions
								</Text>
							</Box>
						)}
					</>
				)}
			</Box>

			{/* Footer */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				paddingTop={1}
				paddingLeft={1}
				paddingRight={1}
				flexShrink={0}
			>
				<Text color={theme.text}>
					{sessions.length > 0 ? '↑↓ navigate • Enter resume • ' : ''}n new
					session • m menu • r refresh • ESC back
				</Text>
			</Box>

			{/* Toast notifications */}
			{error && (
				<Toast type="error" message={error} onDismiss={() => setError(null)} />
			)}
			{success && (
				<Toast
					type="success"
					message={success}
					onDismiss={() => setSuccess(null)}
				/>
			)}
		</Box>
	);
}

export default ClaudeCodeScreen;
