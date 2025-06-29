import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { Toast } from './Toast.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { ClaudeSessionList } from './ClaudeSessionList.jsx';
import { ClaudeActiveSession } from './ClaudeActiveSession.jsx';
import { ClaudeSessionActions } from './ClaudeSessionActions.jsx';
import {
	useTerminalSize,
	useStateAndRef,
	useKeypress,
	usePhraseCycler,
	useConsoleMessages,
	useComponentTheme,
} from '../hooks/index.js';
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
	const { theme } = useComponentTheme('claudeCodeScreen');
	const { maxContentWidth, isNarrow } = useTerminalSize();
	
	// Core state management with performance optimization
	const [config, setConfig, configRef] = useStateAndRef(null);
	const [sessions, setSessions, sessionsRef] = useStateAndRef([]);
	const [loading, setLoading, loadingRef] = useStateAndRef(
		initialMode !== 'subtask-implementation'
	);
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(null);
	const [mode, setMode, modeRef] = useStateAndRef(
		initialMode === 'subtask-implementation' ? 'active-session' : 'list'
	);
	
	// Session management state
	const [prompt, setPrompt] = useState('');
	const [activeSession, setActiveSession, activeSessionRef] = useStateAndRef(null);
	const [messages, setMessages, messagesRef] = useStateAndRef([]);
	const [isProcessing, setIsProcessing, isProcessingRef] = useStateAndRef(false);
	const [keyInsights, setKeyInsights, keyInsightsRef] = useStateAndRef([]);
	
	// UI state
	const [selectedIndex, setSelectedIndex, selectedIndexRef] = useStateAndRef(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [sessionFilter, setSessionFilter] = useState('all');
	const [showMenu, setShowMenu] = useState(false);
	const [waitingForConfig, setWaitingForConfig] = useState(
		initialMode === 'subtask-implementation'
	);

	// Console debugging
	const { messages: consoleMessages, addMessage: addConsoleMessage } = useConsoleMessages({
		maxMessages: 50,
		categories: ['claude', 'session', 'processing']
	});

	// Loading phrases
	const { currentPhrase: loadingPhrase } = usePhraseCycler('loading', { paused: !loading });

	// Processing phrases
	const { currentPhrase: processingPhrase } = usePhraseCycler('claudeProcessing', { 
		paused: !isProcessing 
	});

	const abortControllerRef = useRef(null);
	const VISIBLE_ROWS = 15;

	// Global keyboard handling
	useKeypress({
		'q': () => {
			if (!isProcessingRef.current && onBack) {
				handleBack();
			}
		},
		'esc': () => {
			if (modeRef.current === 'active-session' && !isProcessingRef.current) {
				setMode('list');
			} else if (!isProcessingRef.current && onBack) {
				handleBack();
			}
		},
	}, { isActive: true });

	// Initialize and load data
	useEffect(() => {
		loadData();

		if (initialMode === 'subtask-implementation' && initialContext) {
			addConsoleMessage('Starting subtask implementation mode', 'claude', {
				subtaskId: initialContext?.currentSubtask?.id,
				hasResearch: !!initialContext?.researchContext
			});
			startSubtaskImplementationSession();
		}

		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, [initialMode, initialContext, addConsoleMessage]);

	// Auto-select highlighted session
	useEffect(() => {
		if (highlightSessionId && sessionsRef.current.length > 0) {
			const filtered = getFilteredSessions();
			if (filtered.length > 0) {
				const index = filtered.findIndex(s => s.sessionId === highlightSessionId);
				if (index >= 0) {
					setSelectedIndex(index);
					if (index >= VISIBLE_ROWS) {
						setScrollOffset(Math.max(0, index - Math.floor(VISIBLE_ROWS / 2)));
					}
				}
			}
		}
	}, [highlightSessionId, setSelectedIndex]);

	const getFilteredSessions = () => {
		return sessionsRef.current.filter((session) => {
			if (filterSubtaskId && session.metadata?.subtaskId !== filterSubtaskId) {
				return false;
			}

			if (sessionFilter === 'all') return true;
			if (sessionFilter === 'active') {
				return (
					!session.metadata?.finished ||
					(session.lastUpdated &&
						new Date(session.lastUpdated) > new Date(Date.now() - 3600000))
				);
			}
			if (sessionFilter === 'finished') {
				return session.metadata?.finished === true;
			}
			return true;
		});
	};

	const loadData = async () => {
		if (modeRef.current !== 'active-session') {
			setLoading(true);
		}

		try {
			addConsoleMessage('Loading Claude Code data', 'claude');
			
			const configResult = await backend.getClaudeCodeConfig();
			if (configResult.success) {
				setConfig(configResult.config || configResult.data);
				addConsoleMessage('Config loaded successfully', 'claude');
			}

			const sessionsResult = await backend.getClaudeCodeSessions();
			if (sessionsResult.success) {
				setSessions(sessionsResult.sessions || sessionsResult.data || []);
				addConsoleMessage(`Loaded ${(sessionsResult.sessions || []).length} sessions`, 'session');
			}
		} catch (err) {
			setError(`Failed to load data: ${err.message}`);
			addConsoleMessage(`Error loading data: ${err.message}`, 'claude');
		} finally {
			if (modeRef.current !== 'active-session') {
				setLoading(false);
			}
		}
	};

	const buildSubtaskPrompt = () => {
		const { currentSubtask, parentTask, dependencies, researchContext, worktreePath } = initialContext;

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
		const basePrompt = configRef.current?.systemPrompts?.implementation ||
			'You are helping implement a task. Focus on clean, maintainable code.';

		return `${basePrompt}

Additional context:
- You are implementing subtask ${initialContext.currentSubtask.id} of task ${initialContext.parentTask.id}
- Maintain consistency with completed sibling subtasks
- The working directory is ${initialContext.worktreePath}
- Focus on practical implementation that aligns with the project structure
		`.trim();
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
					const insight = lines.slice(idx, idx + 3).join('\n').trim();
					insights.push({ category, text: insight });
				}
			});
		});

		return insights;
	};

	const startSubtaskImplementationSession = async () => {
		if (!configRef.current) {
			setWaitingForConfig(true);
			setTimeout(startSubtaskImplementationSession, 100);
			return;
		}

		setWaitingForConfig(false);
		setLoading(false);
		setIsProcessing(true);
		setMessages([]);
		setMode('active-session');

		const subtaskPrompt = buildSubtaskPrompt();
		const systemPrompt = buildSystemPrompt();

		addConsoleMessage('Starting Claude Code query', 'processing', {
			promptLength: subtaskPrompt.length,
			hasResearch: !!initialContext?.researchContext,
			worktreePath: initialContext?.worktreePath
		});

		abortControllerRef.current = new AbortController();

		try {
			const result = await backend.claudeCodeQuery(subtaskPrompt, {
				maxTurns: 10,
				permissionMode: configRef.current?.permissionMode || 'acceptEdits',
				allowedTools: configRef.current?.allowedTools || ['Read', 'Write', 'Bash'],
				systemPrompt,
				cwd: initialContext.worktreePath,
				abortController: abortControllerRef.current,
				onMessage: (message) => {
					setMessages(prev => [...prev, message]);

					if (message.type === 'assistant') {
						const insights = extractKeyInsights(message.message.content?.[0]?.text || '');
						if (insights.length > 0) {
							setKeyInsights(prev => [...prev, ...insights]);
						}
					}
				}
			});

			if (result.success && result.sessionId) {
				const session = {
					sessionId: result.sessionId,
					prompt: subtaskPrompt,
					timestamp: new Date().toISOString(),
					subtaskId: initialContext.currentSubtask.id
				};
				setActiveSession(session);

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

	const handleNewQuery = async () => {
		if (!prompt.trim()) return;

		setIsProcessing(true);
		setMessages([]);
		setMode('active-session');
		addConsoleMessage('Starting new Claude query', 'processing');

		abortControllerRef.current = new AbortController();

		try {
			const result = await backend.claudeCodeQuery(prompt, {
				maxTurns: configRef.current?.defaultMaxTurns || 3,
				permissionMode: configRef.current?.permissionMode || 'acceptEdits',
				allowedTools: configRef.current?.allowedTools || ['Read', 'Write', 'Bash'],
				abortController: abortControllerRef.current,
				onMessage: (message) => {
					setMessages(prev => [...prev, message]);
				}
			});

			if (result.success && result.sessionId) {
				setActiveSession({
					sessionId: result.sessionId,
					prompt,
					timestamp: new Date().toISOString()
				});

				await backend.saveClaudeCodeSession({
					sessionId: result.sessionId,
					prompt,
					lastUpdated: new Date().toISOString()
				});

				setSuccess('Query completed successfully');
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
		addConsoleMessage('Continuing Claude conversation', 'processing');
		abortControllerRef.current = new AbortController();

		try {
			const result = await backend.claudeCodeContinue(prompt, {
				abortController: abortControllerRef.current,
				onMessage: (message) => {
					setMessages(prev => [...prev, message]);
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

	const handleResumeSession = async (sessionId) => {
		setMode('active-session');
		setIsProcessing(true);
		setMessages([]);
		setActiveSession({ sessionId });
		addConsoleMessage(`Resuming session ${sessionId}`, 'session');

		abortControllerRef.current = new AbortController();

		try {
			const result = await backend.claudeCodeResume(sessionId, '', {
				abortController: abortControllerRef.current,
				onMessage: (message) => {
					setMessages(prev => [...prev, message]);
				}
			});

			if (result.success) {
				setSuccess('Session resumed successfully');
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

	const handleAbort = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			addConsoleMessage('Query aborted by user', 'processing');
		}
		setIsProcessing(false);
	};

	const handleBack = async () => {
		if (initialMode === 'subtask-implementation' && keyInsightsRef.current.length > 0) {
			try {
				const insightSummary = summarizeInsights(keyInsightsRef.current);
				const claudeSessionContent = `## Claude Code Session - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}

**Subtask:** ${initialContext.currentSubtask.title}
**Working Directory:** ${initialContext.worktreePath}
${activeSessionRef.current ? `**Session ID:** ${activeSessionRef.current.sessionId}` : ''}

### Key Insights from Implementation

${insightSummary}

---
`;
				await backend.updateSubtask({
					id: initialContext.currentSubtask.id,
					prompt: claudeSessionContent,
					research: false
				});

				if (activeSessionRef.current?.sessionId) {
					await backend.saveClaudeCodeSession({
						sessionId: activeSessionRef.current.sessionId,
						lastUpdated: new Date().toISOString(),
						metadata: {
							...activeSessionRef.current.metadata,
							finished: true
						}
					});
				}

				setSuccess('Subtask updated with session insights');
			} catch (err) {
				addConsoleMessage(`Failed to update subtask: ${err.message}`, 'claude');
			}
		}

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

	const handleSelectSession = (index) => {
		setSelectedIndex(index);
		if (index >= VISIBLE_ROWS) {
			setScrollOffset(Math.max(0, index - Math.floor(VISIBLE_ROWS / 2)));
		} else if (index < scrollOffset) {
			setScrollOffset(index);
		}
	};

	const filteredSessions = getFilteredSessions();
	const selectedSession = filteredSessions[selectedIndexRef.current];

	if (loading) {
		return (
			<Box justifyContent="center" alignItems="center" height={10}>
				<LoadingSpinner />
				<Text color={theme.accent}>
					{' '}{loadingPhrase}
				</Text>
			</Box>
		);
	}

	if (waitingForConfig) {
		return (
			<Box justifyContent="center" alignItems="center" height={10}>
				<LoadingSpinner />
				<Text color={theme.accent}>
					{' '}Waiting for Claude Code configuration...
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" width={maxContentWidth}>
			{/* Header */}
			<Box marginBottom={1} paddingX={1}>
				<Text color={theme.accent} bold>
					Claude Code {mode === 'active-session' ? 'Session' : 'Sessions'}
				</Text>
				{filterSubtaskId && (
					<Text color={theme.text.secondary}>
						{' '}(Filtered: Subtask {filterSubtaskId})
					</Text>
				)}
			</Box>

			{/* Error/Success messages */}
			{error && <Toast message={error} type="error" onDismiss={() => setError(null)} />}
			{success && <Toast message={success} type="success" onDismiss={() => setSuccess(null)} />}

			{/* Main content based on mode */}
			{mode === 'list' ? (
				<Box flexDirection={isNarrow ? 'column' : 'row'} gap={2}>
					{/* Sessions list */}
					<Box flexGrow={1}>
						<ClaudeSessionList
							sessions={sessions}
							selectedIndex={selectedIndex}
							onSelectSession={handleSelectSession}
							onResumeSession={handleResumeSession}
							onViewSession={() => {}} // TODO: Implement view session
							sessionFilter={sessionFilter}
							onFilterChange={setSessionFilter}
							filterSubtaskId={filterSubtaskId}
							highlightSessionId={highlightSessionId}
							scrollOffset={scrollOffset}
							visibleRows={VISIBLE_ROWS}
						/>
					</Box>

					{/* Actions panel */}
					{!isNarrow && (
						<Box width={30}>
							<ClaudeSessionActions
								mode={mode}
								config={config}
								selectedSession={selectedSession}
								isProcessing={isProcessing}
								canAbort={!!abortControllerRef.current}
								onNewQuery={() => setMode('new-query')}
								onResumeSession={handleResumeSession}
								onConfigUpdate={() => {}} // TODO: Implement config update
								onBack={handleBack}
								onShowMenu={setShowMenu}
								showMenu={showMenu}
							/>
						</Box>
					)}
				</Box>
			) : mode === 'active-session' ? (
				<ClaudeActiveSession
					activeSession={activeSession}
					messages={messages}
					isProcessing={isProcessing}
					prompt={prompt}
					onPromptChange={setPrompt}
					onSendPrompt={handleNewQuery}
					onContinue={handleContinue}
					onAbort={handleAbort}
					onBack={() => setMode('list')}
					keyInsights={keyInsights}
					config={config}
				/>
			) : null}

			{/* Actions for mobile/narrow screens */}
			{isNarrow && mode === 'list' && (
				<Box marginTop={1}>
					<ClaudeSessionActions
						mode={mode}
						config={config}
						selectedSession={selectedSession}
						isProcessing={isProcessing}
						canAbort={!!abortControllerRef.current}
						onNewQuery={() => setMode('new-query')}
						onResumeSession={handleResumeSession}
						onConfigUpdate={() => {}} // TODO: Implement config update
						onBack={handleBack}
						onShowMenu={setShowMenu}
						showMenu={showMenu}
					/>
				</Box>
			)}

			{/* Debug console messages (only in development) */}
			{process.env.NODE_ENV === 'development' && consoleMessages.length > 0 && (
				<Box marginTop={2} paddingX={1}>
					<Text color={theme.text.tertiary} bold>
						Debug Console ({consoleMessages.length}):
					</Text>
					{consoleMessages.slice(-3).map((msg) => (
						<Box key={`console-${msg.timestamp}-${msg.category}`}>
							<Text color={theme.text.tertiary}>
								[{msg.category}] {msg.message}
							</Text>
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
}
