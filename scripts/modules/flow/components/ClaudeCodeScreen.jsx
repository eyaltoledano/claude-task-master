import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { SimpleTable } from './SimpleTable.jsx';
import { Toast } from './Toast.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { ClaudeSessionList } from './ClaudeSessionList.jsx';
import { useComponentTheme, useTerminalSize, useConsoleMessages, useStateAndRef, usePhraseCycler } from '../hooks/index.js';
import { useAppContext } from '../index.jsx';

export function ClaudeCodeScreen({
	backend,
	onBack,
	mode: initialMode = 'list',
	initialContext = null,
	returnTo = 'welcome',
	returnData = null,
	filterSubtaskId = null,
	highlightSessionId = null
}) {
	const { setCurrentScreen } = useAppContext();
	const [config, setConfig] = useState(null);
	const [sessions, setSessions, sessionsRef] = useStateAndRef([]);
	const [loading, setLoading] = useState(
		initialMode !== 'subtask-implementation' // Don't show loading for subtask mode
	);
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(null);
	const [mode, setMode] = useState(
		initialMode === 'subtask-implementation' ? 'active-session' : 'list'
	);
	const [prompt, setPrompt] = useState('');
	const [activeSession, setActiveSession] = useState(null);
	const [messages, setMessages, messagesRef] = useStateAndRef([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [showMenu, setShowMenu] = useState(false);
	const [keyInsights, setKeyInsights] = useState([]);
	const [viewingSession, setViewingSession] = useState(null);
	const [sessionMessages, setSessionMessages] = useState({});
	const [sessionScrollOffset, setSessionScrollOffset] = useState(0);
	const [waitingForConfig, setWaitingForConfig] = useState(
		initialMode === 'subtask-implementation' // Start waiting for config in subtask mode
	);
	const abortControllerRef = useRef(null);
	const { theme } = useComponentTheme('claudeCodeScreen');
	const { width, height, isNarrow, isWide } = useTerminalSize();
	


	// Safe color accessor with fallbacks and backwards compatibility
	const getColor = (colorPath, fallback = '#ffffff') => {
		if (typeof colorPath === 'string' && colorPath.length > 0) {
			return colorPath;
		}
		console.warn('[ClaudeCodeScreen] Invalid color path:', colorPath, 'using fallback:', fallback);
		return fallback;
	};

	// Create backwards-compatible theme object
	const resolvedTheme = theme; // Store reference to original
	const safeTheme = {
		// Direct access from resolved theme
		border: getColor(resolvedTheme.border, '#334155'),
		accent: getColor(resolvedTheme.accent, '#22d3ee'),
		background: getColor(resolvedTheme.background, '#1e293b'),
		success: getColor(resolvedTheme.success, '#34d399'),
		error: getColor(resolvedTheme.error, '#f87171'),
		warning: getColor(resolvedTheme.warning, '#fbbf24'),
		info: getColor(resolvedTheme.info, '#60a5fa'),
		
		// Text colors
		text: getColor(resolvedTheme.text?.primary, '#f1f5f9'),
		textDim: getColor(resolvedTheme.text?.secondary, '#cbd5e1'),
		textSecondary: getColor(resolvedTheme.text?.secondary, '#cbd5e1'),
		textTertiary: getColor(resolvedTheme.text?.tertiary, '#94a3b8'),

		// Common status colors (using fallback colors)
		statusDone: '#34d399',
		statusInProgress: '#60a5fa',
		statusPending: '#fbbf24',
		statusBlocked: '#f87171',
		selectionText: '#0f172a',
	};
	const { messages: consoleMessages, clearMessages: clearConsoleMessages } = useConsoleMessages();
	const { currentPhrase: loadingPhrase, isActive: isPhraseCycling } = usePhraseCycler('claudeProcessing', isProcessing);

	// Constants - now responsive to terminal size
	const VISIBLE_ROWS = Math.max(10, Math.min(25, height - 10)); // Dynamic rows based on terminal height



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
	}, [initialMode, initialContext]);

	// Auto-select highlighted session if provided - now handled by ClaudeSessionList component
	const initialSelectedIndex = React.useMemo(() => {
		if (highlightSessionId && sessions.length > 0) {
			console.log('[ClaudeCodeScreen] Setting initial highlighted session:', { highlightSessionId, sessionsCount: sessions.length });
			// Return the index to be used as initial state in ClaudeSessionList
			const index = sessions.findIndex(s => s.sessionId === highlightSessionId);
			return index >= 0 ? index : 0;
		}
		return 0;
	}, [highlightSessionId, sessions]);

	const loadData = async () => {
		// Only show loading screen if we're not in an active session
		if (mode !== 'active-session') {
			setLoading(true);
		}
		
		console.log('[ClaudeCodeScreen] Loading data, mode:', mode);

		try {
			// Load Claude Code configuration
			const configResult = await backend.getClaudeCodeConfig();
			if (configResult.success) {
				setConfig(configResult.config || configResult.data);
			}

			// Load existing sessions
			const sessionsResult = await backend.getClaudeCodeSessions();
			if (sessionsResult.success) {
				setSessions(sessionsResult.sessions || sessionsResult.data || []);
			}
		} catch (err) {
			setError(`Failed to load data: ${err.message}`);
		} finally {
			// Only set loading to false if we're not in an active session
			// to prevent view disruption
			if (mode !== 'active-session') {
				setLoading(false);
			}
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
			`- [${st.status}] ${st.id}: ${st.title}${st.id === currentSubtask.id.split('.')[1] ? ' ← CURRENT' : ''}`
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

	const loadSessionMessages = async (sessionId) => {
		try {
			// Reset scroll offset when loading a new session
			setSessionScrollOffset(0);
			
			setSessionMessages((prev) => ({
				...prev,
				[sessionId]: [] // Clear existing messages while loading
			}));

			const result = await backend.getClaudeSessionDetails(sessionId);
			
			if (result.success && result.session) {
				const session = result.session;
				
				// Extract messages from the conversation
				const messages = session.conversation?.messages || [];
				
				// Format messages for display
				const formattedMessages = messages.map((msg, index) => {
					if (msg.type === 'system') {
						return {
							type: 'system',
							content: `System: ${msg.subtype || 'init'} - ${msg.details?.model || 'Unknown model'}`,
							timestamp: msg.timestamp
						};
					} else if (msg.type === 'assistant') {
						// Handle assistant messages
						let content = '';
						
						if (typeof msg.content === 'string') {
							// Check if content is a JSON string (tool use)
							try {
								const parsed = JSON.parse(msg.content);
								if (parsed.type === 'tool_use') {
									content = `🔧 Used tool: ${parsed.name}\nInput: ${JSON.stringify(parsed.input, null, 2)}`;
								} else {
									content = msg.content;
								}
							} catch {
								// Not JSON, use as-is
								content = msg.content;
							}
						} else if (Array.isArray(msg.content)) {
							// Handle array of content parts
							for (const part of msg.content) {
								if (part.type === 'text' && part.text) {
									content += part.text;
								} else if (part.type === 'thinking' && part.thinking) {
									content += `[Thinking: ${part.thinking.substring(0, 200)}...]`;
								}
							}
						}
						
						return {
							type: 'assistant',
							content: content || '(No content)',
							timestamp: msg.timestamp
						};
					} else if (msg.type === 'user') {
						// Handle user messages (including tool results)
						let content = '';
						
						if (typeof msg.content === 'string') {
							// Check if content is a JSON string (tool result)
							try {
								const parsed = JSON.parse(msg.content);
								if (parsed.type === 'tool_result') {
									if (parsed.is_error) {
										content = `❌ Tool Error: ${parsed.content}`;
									} else {
										// Truncate long tool results
										const resultContent = typeof parsed.content === 'string' 
											? parsed.content 
											: JSON.stringify(parsed.content, null, 2);
										content = `✅ Tool Result: ${resultContent.substring(0, 500)}${resultContent.length > 500 ? '...' : ''}`;
									}
								} else {
									content = msg.content;
								}
							} catch {
								// Not JSON, use as-is
								content = msg.content;
							}
						} else {
							content = msg.content || '(No content)';
						}
						
						return {
							type: 'user',
							content: content,
							timestamp: msg.timestamp
						};
					}
					
					// Handle other message types
					return {
						type: msg.type,
						content: `[${msg.type}]: ${JSON.stringify(msg, null, 2).substring(0, 200)}...`,
						timestamp: msg.timestamp
					};
				});

				setSessionMessages((prev) => ({
					...prev,
					[sessionId]: formattedMessages
				}));
			} else {
				// Handle error case
				setSessionMessages((prev) => ({
					...prev,
					[sessionId]: [
						{ 
							type: 'error', 
							content: `Failed to load session: ${result.error || 'Unknown error'}` 
						}
					]
				}));
			}
		} catch (error) {
			console.error('Error loading session messages:', error);
			setSessionMessages((prev) => ({
				...prev,
				[sessionId]: [
					{ 
						type: 'error', 
						content: `Error loading session: ${error.message}` 
					}
				]
			}));
		}
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
		setMode('active-session'); // Ensure we're in active session mode

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

				// Update subtask with Claude session reference
				const sessionReference = `
<claude-session added="${new Date().toISOString()}" sessionId="${result.sessionId}">
Claude Code session started for implementation. Session ID: ${result.sessionId}
Working directory: ${initialContext.worktreePath}
</claude-session>
`;
				await backend.updateSubtask({
					id: initialContext.currentSubtask.id,
					prompt: sessionReference,
					research: false
				});

				setSuccess('Claude Code session started for subtask implementation');

				// Reload sessions to include this new session in the list
				await loadData();
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
				const claudeSessionContent = `## Claude Code Session - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}

**Subtask:** ${initialContext.currentSubtask.title}
**Working Directory:** ${initialContext.worktreePath}
${activeSession ? `**Session ID:** ${activeSession.sessionId}` : ''}

### Key Insights from Implementation

${insightSummary}

---
`;
				await backend.updateSubtask({
					id: initialContext.currentSubtask.id,
					prompt: claudeSessionContent,
					research: false
				});

				// Mark session as finished if we have one
				if (activeSession?.sessionId) {
					await backend.saveClaudeCodeSession({
						sessionId: activeSession.sessionId,
						lastUpdated: new Date().toISOString(),
						metadata: {
							...activeSession.metadata,
							finished: true
						}
					});
				}

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
			} else if (viewingSession) {
				setViewingSession(null);
			} else {
				handleBack();
			}
			return;
		}

		// Handle session detail view
		if (viewingSession) {
			const sessionMessagesData = sessionMessages[viewingSession] || [];
			const totalMessages = sessionMessagesData.length;
			const maxVisibleMessages = height - 8; // Account for header, info, footer
			const maxScrollOffset = Math.max(0, totalMessages - maxVisibleMessages);
			
			if (key.upArrow && sessionScrollOffset > 0) {
				setSessionScrollOffset(sessionScrollOffset - 1);
				return;
			} else if (key.downArrow && sessionScrollOffset < maxScrollOffset) {
				setSessionScrollOffset(sessionScrollOffset + 1);
				return;
			} else if (
				input === 'r' &&
				sessions.find(
					(s) => s.sessionId === viewingSession && !s.metadata?.finished
				)
			) {
				// Resume the session
				setViewingSession(null);
				handleResume(viewingSession);
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

		// List mode navigation is now handled by ClaudeSessionList component
		if (mode === 'active-session' && !isProcessing) {
			if (key.return && prompt.trim()) {
				handleContinue();
			}
		}
	});

	// Helper functions for rendering different message types
	const renderSystemMessage = (msg, idx) => (
		<Box key={`system-init-${msg.session_id}-${idx}`} marginBottom={1}>
			<Text color="gray">
				Session: {msg.session_id} | Model: {msg.model} | CWD: {msg.cwd}
			</Text>
		</Box>
	);

	const renderUserMessage = (msg, idx) => (
		<Box key={`user-${msg.timestamp || idx}-${idx}`} marginBottom={1}>
			<Text color="cyan">User: </Text>
			<Text>{msg.message.content?.[0]?.text || ''}</Text>
		</Box>
	);

	const renderAssistantMessage = (msg, idx) => {
		const content = msg.message.content?.[0]?.text || '';
		return (
			<Box
				key={`assistant-${msg.timestamp || idx}-${idx}`}
				marginBottom={1}
				flexDirection="column"
			>
				<Text color="green">Claude: </Text>
				<Box marginLeft={2}>
					<Text>{content}</Text>
				</Box>
			</Box>
		);
	};

	const renderResultMessage = (msg, idx) => (
		<Box
			key={`result-${msg.subtype}-${msg.num_turns}-${idx}`}
			marginTop={1}
		>
			<Text color="yellow">
				Result: {msg.subtype} | Turns: {msg.num_turns} | Cost: $
				{msg.total_cost_usd?.toFixed(4) || '0.0000'}
			</Text>
		</Box>
	);

	const renderMessages = () => {
		return messages.map((msg, idx) => {
			switch (msg.type) {
				case 'system':
					return msg.subtype === 'init' ? renderSystemMessage(msg, idx) : null;
				case 'user':
					return renderUserMessage(msg, idx);
				case 'assistant':
					return renderAssistantMessage(msg, idx);
				case 'result':
					return renderResultMessage(msg, idx);
				default:
					console.log('[ClaudeCodeScreen] Unknown message type:', msg.type);
					return null;
			}
		});
	};

	// Show menu overlay
	if (showMenu) {
		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={safeTheme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={safeTheme.accent}>Task Master</Text>
						<Text color={safeTheme.textDim}> › </Text>
						<Text color="white">Claude Code</Text>
						<Text color={safeTheme.textDim}> › </Text>
						<Text color={safeTheme.text}>Menu</Text>
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
						borderColor={safeTheme.border}
						padding={2}
						flexDirection="column"
					>
						<Text bold color={safeTheme.accent} marginBottom={1}>
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
					borderColor={safeTheme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					<Text color={safeTheme.text}>
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
					borderColor={safeTheme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={safeTheme.accent}>Task Master</Text>
						<Text color={safeTheme.textDim}> › </Text>
						<Text color="white">Claude Code</Text>
						<Text color={safeTheme.textDim}> › </Text>
						<Text color={safeTheme.text}>Subtask Implementation</Text>
					</Box>
				</Box>

				<Box justifyContent="center" alignItems="center" flexGrow={1}>
					<Box flexDirection="column" alignItems="center">
						<LoadingSpinner message={loadingPhrase} />
						<Box marginTop={1}>
							<Text color={safeTheme.textDim}>
								Subtask: {initialContext?.currentSubtask?.title || 'Loading...'}
							</Text>
						</Box>
						<Box marginTop={1}>
							<Text color={safeTheme.textDim}>
								This includes research findings and full context
							</Text>
						</Box>
					</Box>
				</Box>

				{/* Footer */}
				<Box
					borderStyle="single"
					borderColor={safeTheme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					<Text color={safeTheme.text}>ESC to cancel</Text>
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
					borderColor={safeTheme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={safeTheme.accent}>Task Master</Text>
						<Text color={safeTheme.textDim}> › </Text>
						<Text color="white">Claude Code</Text>
						<Text color={safeTheme.textDim}> › </Text>
						<Text color={safeTheme.text}>New Session</Text>
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
						<Text color={safeTheme.textDim}>
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
					borderColor={safeTheme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={safeTheme.accent}>Task Master</Text>
						<Text color={safeTheme.textDim}> › </Text>
						<Text color="white">Claude Code</Text>
						<Text color={safeTheme.textDim}> › </Text>
						<Text color={safeTheme.text}>Active Session</Text>
					</Box>
					{activeSession && (
						<Text color={safeTheme.textDim}>[{activeSession.sessionId}]</Text>
					)}
				</Box>

				{/* Messages Area */}
				<Box flexGrow={1} flexDirection="column" padding={1} height={20}>
					{renderMessages()}
				</Box>

				{/* Input Area */}
				<Box
					borderStyle="single"
					borderColor={safeTheme.border}
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
							<Spinner type="dots" /> {loadingPhrase} (Press ESC to abort)
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

	// Session detail view
	if (viewingSession) {
		const session = sessions.find((s) => s.sessionId === viewingSession);
		const sessionMessagesData = sessionMessages[viewingSession] || [];
		
		// Calculate scroll parameters for session messages
		const totalMessages = sessionMessagesData.length;
		const maxVisibleMessages = height - 8; // Account for header, info, footer
		const canScroll = totalMessages > maxVisibleMessages;
		const maxScrollOffset = Math.max(0, totalMessages - maxVisibleMessages);
		

		
		// Get visible messages for current scroll position
		const visibleMessages = canScroll 
			? sessionMessagesData.slice(sessionScrollOffset, sessionScrollOffset + maxVisibleMessages)
			: sessionMessagesData;

		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={safeTheme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={safeTheme.accent}>Task Master</Text>
						<Text color={safeTheme.textDim}> › </Text>
						<Text color="white">Claude Code</Text>
						<Text color={safeTheme.textDim}> › </Text>
						<Text color={safeTheme.text}>Session Details</Text>
					</Box>
					<Text color={safeTheme.textDim}>
						[{viewingSession.substring(0, 8)}...]
					</Text>
				</Box>

				{/* Session Info */}
				<Box paddingLeft={2} paddingRight={2} marginBottom={1}>
					<Box flexDirection="column">
						<Text color={safeTheme.textDim}>
							Type:{' '}
							{session?.metadata?.type === 'subtask-implementation'
								? 'Subtask Implementation'
								: 'General Query'}
						</Text>
						{session?.metadata?.subtaskId && (
							<Text color={safeTheme.textDim}>
								Subtask: {session.metadata.subtaskId}
							</Text>
						)}
						<Text color={safeTheme.textDim}>
							Started:{' '}
							{new Date(
								session?.createdAt || session?.lastUpdated
							).toLocaleString()}
						</Text>
						<Text color={safeTheme.textDim}>
							Status: {session?.metadata?.finished ? 'Finished' : 'Active'}
						</Text>
					</Box>
				</Box>

				{/* Messages */}
				<Box
					flexGrow={1}
					flexDirection="column"
					paddingLeft={2}
					paddingRight={2}
				>
					{sessionMessagesData.length === 0 ? (
						<Box justifyContent="center" alignItems="center" flexGrow={1}>
							<LoadingSpinner message="Loading session messages..." />
						</Box>
					) : (
						<Box flexDirection="column">
							{/* Scroll indicator - top */}
							{canScroll && sessionScrollOffset > 0 && (
								<Box justifyContent="center" marginBottom={1}>
									<Text color={safeTheme.textDim}>▲ {sessionScrollOffset} messages above</Text>
								</Box>
							)}
							
							{/* Visible messages */}
							{visibleMessages.map((msg, idx) => (
								<Box
									key={`session-msg-${viewingSession}-${msg.type}-${sessionScrollOffset + idx}`}
									marginBottom={1}
								>
									{msg.type === 'user' && (
										<>
											<Text color="cyan">User: </Text>
											<Box marginLeft={2}>
												<Text>{msg.content}</Text>
											</Box>
										</>
									)}
									{msg.type === 'assistant' && (
										<>
											<Text color="green">Claude: </Text>
											<Box marginLeft={2}>
												<Text>{msg.content}</Text>
											</Box>
										</>
									)}
									{msg.type === 'system' && (
										<>
											<Text color="gray">System: </Text>
											<Box marginLeft={2}>
												<Text color="gray">{msg.content}</Text>
											</Box>
										</>
									)}
									{msg.type === 'error' && (
										<>
											<Text color="red">Error: </Text>
											<Box marginLeft={2}>
												<Text color="red">{msg.content}</Text>
											</Box>
										</>
									)}
									{!['user', 'assistant', 'system', 'error'].includes(msg.type) && (
										<>
											<Text color="yellow">{msg.type}: </Text>
											<Box marginLeft={2}>
												<Text color="yellow">{msg.content}</Text>
											</Box>
										</>
									)}
								</Box>
							))}
							
							{/* Scroll indicator - bottom */}
							{canScroll && sessionScrollOffset < maxScrollOffset && (
								<Box justifyContent="center" marginTop={1}>
									<Text color={safeTheme.textDim}>▼ {maxScrollOffset - sessionScrollOffset} messages below</Text>
								</Box>
							)}
						</Box>
					)}
				</Box>

				{/* Footer */}
				<Box
					borderStyle="single"
					borderColor={safeTheme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					<Text color={safeTheme.text}>
						{canScroll ? '↑↓ scroll • ' : ''}
						{!session?.metadata?.finished ? 'r resume session • ' : ''}ESC back
						to list
					</Text>
				</Box>
			</Box>
		);
	}

	// Sessions list view (default) - use enhanced ClaudeSessionList component
	return (
		<>
			<ClaudeSessionList
				sessions={sessions}
				filterSubtaskId={filterSubtaskId}
				visibleRows={VISIBLE_ROWS}
				config={config}
				initialSelectedIndex={initialSelectedIndex}
				initialScrollOffset={0}
				initialSessionFilter="all"
				onSessionSelect={(session) => {
					setViewingSession(session.sessionId);
					loadSessionMessages(session.sessionId);
				}}
				onSessionResume={(sessionId) => {
					handleResume(sessionId);
				}}
				onSessionDetails={(sessionId) => {
					setViewingSession(sessionId);
					loadSessionMessages(sessionId);
				}}
				onNewSession={() => {
					if (!config?.enabled) {
						setError('Claude Code is not enabled. Configure it in settings first.');
						return;
					}
					setMode('new-query');
					setPrompt('');
				}}
				onRefresh={() => {
					loadData();
				}}
				onBack={() => {
					handleBack();
				}}
			/>
			
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
		</>
	);
}
