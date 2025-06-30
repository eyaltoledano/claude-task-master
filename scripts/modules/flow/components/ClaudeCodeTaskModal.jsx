import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../hooks/useKeypress.js';
import { useComponentTheme } from '../hooks/useTheme.js';
import { Toast } from './Toast.jsx';

function ClaudeCodeTaskModal({ task, subtask, backend, onClose }) {
	const [prompt, setPrompt] = useState('');
	const [messages, setMessages] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(null);
	const [mode, setMode] = useState('prompt'); // prompt, processing, results
	const [abortController, setAbortController] = useState(null);
	const { theme } = useComponentTheme('modal');

	useEffect(() => {
		// Pre-populate prompt with task context
		const taskInfo = subtask || task;
		const contextPrompt = `Help me implement ${taskInfo.title}:\n\n${taskInfo.description}\n\nDetails: ${taskInfo.details || 'None provided'}`;
		setPrompt(contextPrompt);
	}, [task, subtask]);

	const handleSubmit = async () => {
		if (!prompt.trim()) return;

		setMode('processing');
		setIsProcessing(true);
		setMessages([]);

		const controller = new AbortController();
		setAbortController(controller);

		try {
			// Get Claude Code config
			const configResult = await backend.getClaudeCodeConfig();
			const config = configResult.config || {};

			// Build system prompt with task context
			const taskInfo = subtask || task;
			const systemPrompt = `You are helping implement a specific task from Task Master. 
Task ID: ${taskInfo.id}
Task Title: ${taskInfo.title}
Task Description: ${taskInfo.description}
${taskInfo.details ? `Implementation Details: ${taskInfo.details}` : ''}
${taskInfo.testStrategy ? `Test Strategy: ${taskInfo.testStrategy}` : ''}

Focus on implementing this specific task. Be thorough but stay within scope.`;

			const result = await backend.claudeCodeQuery(prompt, {
				maxTurns: config.defaultMaxTurns || 5,
				permissionMode: config.permissionMode || 'acceptEdits',
				allowedTools: config.allowedTools || ['Read', 'Write', 'Bash'],
				systemPrompt,
				abortController: controller,
				onMessage: (message) => {
					setMessages((prev) => [...prev, message]);
				}
			});

			if (result.success) {
				setMode('results');
				setSuccess('Claude Code completed the task implementation');

				// Save session with task context
				if (result.sessionId) {
					await backend.saveClaudeCodeSession({
						sessionId: result.sessionId,
						prompt,
						taskId: taskInfo.id,
						taskTitle: taskInfo.title,
						lastUpdated: new Date().toISOString()
					});
				}
			} else if (result.error) {
				setError(result.error);
				setMode('prompt');
			}
		} catch (err) {
			setError(err.message);
			setMode('prompt');
		} finally {
			setIsProcessing(false);
			setAbortController(null);
		}
	};

	const handleAbort = () => {
		if (abortController) {
			abortController.abort();
			setSuccess('Operation aborted');
			setIsProcessing(false);
			setMode('prompt');
		}
	};

	const handleClose = () => {
		if (isProcessing && abortController) {
			handleAbort();
		} else {
			onClose();
		}
	};

	const handlers = {
		escape: handleClose,
		return: () => {
			if (mode === 'prompt') {
				handleSubmit();
			}
		},
		q: () => {
			if (mode === 'results') {
				onClose();
			}
		}
	};

	useKeypress(handlers);

	const renderMessages = () => {
		return messages.map((msg, idx) => {
			if (msg.type === 'assistant') {
				const content = msg.message.content?.[0]?.text || '';
				return (
					<Box key={`assistant-${idx}-${content.slice(0, 20)}`} marginBottom={1} flexDirection="column">
						<Text color={theme.success}>Claude: </Text>
						<Box marginLeft={2} width={80}>
							<Text wrap="wrap">{content}</Text>
						</Box>
					</Box>
				);
			} else if (msg.type === 'result') {
				return (
					<Box key={`result-${idx}-${msg.num_turns || 0}`} marginTop={1}>
						<Text color={theme.warning}>
							Completed: {msg.num_turns} turns | Cost: $
							{msg.total_cost_usd?.toFixed(4) || '0.0000'}
						</Text>
					</Box>
				);
			}
			return null;
		});
	};

	// Get modal properties based on current mode
	const getModalProps = () => {
		const taskInfo = subtask || task;
		
		switch (mode) {
			case 'processing':
				return {
					title: `Claude Code: Processing Task ${taskInfo.id}`,
					preset: 'info'
				};
			case 'results':
				return {
					title: `Claude Code: Task ${taskInfo.id} Complete`,
					preset: 'success'
				};
			default:
				return {
					title: `Claude Code: Implement Task ${taskInfo.id}`,
					preset: 'default'
				};
		}
	};

	const modalProps = getModalProps();
	const taskInfo = subtask || task;

	// Render mode-specific content
	const renderContent = () => {
		if (mode === 'prompt') {
			return (
				<Box flexDirection="column">
					<Box marginBottom={2}>
						<Text color={theme.textDim}>{taskInfo.title}</Text>
					</Box>
					
					<Box marginBottom={2}>
						<Text color={theme.text}>Customize the prompt for Claude Code:</Text>
					</Box>
					
					<Box marginBottom={2} flexDirection="column">
						<TextInput
							value={prompt}
							onChange={setPrompt}
							placeholder="Describe what you want Claude to help with..."
							showCursor={!isProcessing}
						/>
					</Box>
					
					<Box justifyContent="center">
						<Text color={theme.textDim}>Press Enter to start, Escape to cancel</Text>
					</Box>
				</Box>
			);
		}

		if (mode === 'processing') {
			return (
				<Box flexDirection="column">
					<Box marginBottom={2}>
						<Text color={theme.warning}>
							<Spinner type="dots" /> Claude Code is working on your task...
						</Text>
					</Box>
					
					<Box flexDirection="column" height={15} marginBottom={2}>
						{renderMessages()}
					</Box>
					
					<Box justifyContent="center">
						<Text color={theme.textDim}>Press Escape to abort</Text>
					</Box>
				</Box>
			);
		}

		if (mode === 'results') {
			return (
				<Box flexDirection="column">
					<Box marginBottom={2}>
						<Text color={theme.success}>
							✓ Implementation Complete
						</Text>
					</Box>
					
					<Box flexDirection="column" height={20} marginBottom={2}>
						{renderMessages()}
					</Box>
					
					<Box justifyContent="center">
						<Text color={theme.textDim}>Press q or Escape to close</Text>
					</Box>
				</Box>
			);
		}

		return null;
	};

	return (
		<>
			<BaseModal
				title={modalProps.title}
				onClose={handleClose}
				width="90%"
				height="auto"
				preset={modalProps.preset}
				showCloseHint={false} // We show custom hints
			>
				{renderContent()}
			</BaseModal>

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

export default ClaudeCodeTaskModal;
