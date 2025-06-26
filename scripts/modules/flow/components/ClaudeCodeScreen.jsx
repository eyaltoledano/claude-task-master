import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { SimpleTable } from './SimpleTable.jsx';
import { Toast } from './Toast.jsx';

function ClaudeCodeScreen({ backend, onBack }) {
	const [config, setConfig] = useState(null);
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(null);
	const [mode, setMode] = useState('menu'); // menu, new-query, active-session, sessions-list
	const [prompt, setPrompt] = useState('');
	const [activeSession, setActiveSession] = useState(null);
	const [messages, setMessages] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const abortControllerRef = useRef(null);

	useEffect(() => {
		loadData();
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
			} else if (result.error) {
				setError(result.error);
				setMode('menu');
			}
		} catch (err) {
			setError(err.message);
			setMode('menu');
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
				setMode('sessions-list');
			}
		} catch (err) {
			setError(err.message);
			setMode('sessions-list');
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
				setMode('menu');
			} else if (mode !== 'menu') {
				setMode('menu');
			} else {
				onBack();
			}
			return;
		}

		if (mode === 'menu') {
			if (input === '1') {
				if (!config?.enabled) {
					setError(
						'Claude Code is not enabled. Configure it in settings first.'
					);
					return;
				}
				setMode('new-query');
				setPrompt('');
			} else if (input === '2') {
				setMode('sessions-list');
			} else if (input === '3') {
				// Continue last session
				if (sessions.length > 0) {
					handleResume(sessions[sessions.length - 1].sessionId);
				} else {
					setError('No previous sessions found');
				}
			} else if (input === 'q') {
				onBack();
			}
		} else if (mode === 'sessions-list') {
			const num = parseInt(input);
			if (!isNaN(num) && num > 0 && num <= sessions.length) {
				const session = sessions[sessions.length - num];
				handleResume(session.sessionId);
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

	if (loading) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="green">
					<Spinner type="dots" /> Loading Claude Code configuration...
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					Claude Code Assistant
				</Text>
				{config?.enabled ? (
					<Text color="green"> (Enabled)</Text>
				) : (
					<Text color="red"> (Disabled)</Text>
				)}
			</Box>

			{mode === 'menu' && (
				<Box flexDirection="column">
					<Text>Select an option:</Text>
					<Box marginTop={1} flexDirection="column">
						<Text>1. Start new Claude Code session</Text>
						<Text>2. View previous sessions</Text>
						<Text>3. Continue last session</Text>
						<Text>q. Back to main menu</Text>
					</Box>
				</Box>
			)}

			{mode === 'new-query' && (
				<Box flexDirection="column">
					<Text>Enter your prompt for Claude Code:</Text>
					<Box marginTop={1}>
						<Text color="cyan">❯ </Text>
						<TextInput
							value={prompt}
							onChange={setPrompt}
							onSubmit={handleNewQuery}
							placeholder="Describe what you want Claude to help with..."
						/>
					</Box>
					<Box marginTop={1}>
						<Text color="gray">Press Enter to submit, Escape to cancel</Text>
					</Box>
				</Box>
			)}

			{mode === 'active-session' && (
				<Box flexDirection="column">
					{activeSession && (
						<Box marginBottom={1}>
							<Text color="gray">Session: {activeSession.sessionId}</Text>
						</Box>
					)}

					<Box flexDirection="column" height={20}>
						{renderMessages()}
					</Box>

					{isProcessing ? (
						<Box marginTop={1}>
							<Text color="yellow">
								<Spinner type="dots" /> Processing... (Press Escape to abort)
							</Text>
						</Box>
					) : (
						<Box marginTop={1} flexDirection="column">
							<Text>Continue the conversation:</Text>
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
			)}

			{mode === 'sessions-list' && (
				<Box flexDirection="column">
					<Text bold marginBottom={1}>
						Previous Sessions
					</Text>
					{sessions.length === 0 ? (
						<Text color="gray">No sessions found</Text>
					) : (
						<Box flexDirection="column">
							{sessions
								.slice()
								.reverse()
								.slice(0, 10)
								.map((session, idx) => (
									<Box key={session.sessionId}>
										<Text>{idx + 1}. </Text>
										<Text color="cyan">
											{session.prompt?.substring(0, 50)}...
										</Text>
										<Text color="gray">
											{' '}
											(
											{new Date(
												session.lastUpdated || session.createdAt
											).toLocaleString()}
											)
										</Text>
									</Box>
								))}
							<Box marginTop={1}>
								<Text color="gray">
									Enter number to resume session, Escape to go back
								</Text>
							</Box>
						</Box>
					)}
				</Box>
			)}

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
