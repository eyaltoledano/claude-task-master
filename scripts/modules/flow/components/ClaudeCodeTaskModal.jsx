import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { BaseModal, Toast } from '../features/ui';
import { useKeypress } from '../shared/hooks/useKeypress.js';
import { useComponentTheme } from '../shared/hooks/useTheme.js';
import { BackgroundClaudeCode } from '../services/BackgroundClaudeCode.js';
import { backgroundOperations } from '../services/BackgroundOperationsManager.js';

function ClaudeCodeTaskModal({ task, subtask, backend, onClose }) {
	const [prompt, setPrompt] = useState('');
	const [messages, setMessages] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(null);
	const [mode, setMode] = useState('prompt'); // prompt, processing, results, background-confirm
	const [abortController, setAbortController] = useState(null);
	const [operationId, setOperationId] = useState(null);
	const [backgroundChoice, setBackgroundChoice] = useState(null); // null, 'background', 'modal'
	const { theme } = useComponentTheme('modal');

	// Initialize background service
	const backgroundClaudeCode = new BackgroundClaudeCode(backend);

	useEffect(() => {
		// Pre-populate prompt with task context
		const taskInfo = subtask || task;
		const contextPrompt = `Help me implement ${taskInfo.title}:\n\n${taskInfo.description}\n\nDetails: ${taskInfo.details || 'None provided'}`;
		setPrompt(contextPrompt);
	}, [task, subtask]);

	// Listen for operation completion
	useEffect(() => {
		if (operationId) {
			const handleComplete = (completedOpId, result) => {
				if (completedOpId === operationId && mode === 'background-confirm') {
					setSuccess('Claude Code completed the task in the background!');
					setTimeout(() => onClose(), 2000);
				}
			};

			const handleFailed = (failedOpId, error) => {
				if (failedOpId === operationId && mode === 'background-confirm') {
					setError(`Background operation failed: ${error}`);
					setMode('prompt');
				}
			};

			backgroundOperations.on('operation-completed', handleComplete);
			backgroundOperations.on('operation-failed', handleFailed);

			return () => {
				backgroundOperations.off('operation-completed', handleComplete);
				backgroundOperations.off('operation-failed', handleFailed);
			};
		}
	}, [operationId, mode, onClose]);

	const handleSubmit = async () => {
		if (!prompt.trim()) return;

		// Ask user if they want to run in background or keep modal open
		setMode('background-confirm');
	};

	const runInBackground = async () => {
		setMode('processing');
		setIsProcessing(true);
		setMessages([]);

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

			// Start background operation
			const operation = await backgroundClaudeCode.startQuery(prompt, {
				maxTurns: config.defaultMaxTurns || 5,
				permissionMode: config.permissionMode || 'acceptEdits',
				allowedTools: config.allowedTools || ['Read', 'Write', 'Bash'],
				systemPrompt,
				metadata: {
					taskId: taskInfo.id,
					taskTitle: taskInfo.title,
					runInBackground: true
				},
				onMessage: (message) => {
					// Still update messages if modal is open
					if (mode === 'processing') {
						setMessages((prev) => [...prev, message]);
					}
				}
			});

			setOperationId(operation.operationId);
			setAbortController(operation.abortController);

			// Show background notification
			setMode('background-confirm');
			setSuccess(
				`Claude Code is running in the background (Operation ID: ${operation.operationId.slice(0, 8)}...)`
			);
			setIsProcessing(false);

			// Close modal after 3 seconds
			setTimeout(() => onClose(), 3000);
		} catch (err) {
			setError(err.message);
			setMode('prompt');
			setIsProcessing(false);
		}
	};

	const runInModal = async () => {
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
		if (operationId && mode === 'processing') {
			// Abort background operation
			backgroundClaudeCode.abortOperation(operationId);
			setSuccess('Background operation aborted');
			setIsProcessing(false);
			setMode('prompt');
		} else if (abortController) {
			// Abort regular operation
			abortController.abort();
			setSuccess('Operation aborted');
			setIsProcessing(false);
			setMode('prompt');
		}
	};

	const handleClose = () => {
		// Don't abort if running in background
		if (isProcessing && !operationId) {
			// Only abort if not a background operation
			if (abortController) {
				abortController.abort();
			}
		}
		onClose();
	};

	const handlers = {
		escape: () => {
			if (mode === 'background-confirm') {
				setMode('prompt');
			} else {
				handleClose();
			}
		},
		return: () => {
			if (mode === 'prompt') {
				handleSubmit();
			} else if (mode === 'background-confirm') {
				// Default to background
				runInBackground();
			}
		},
		b: () => {
			if (mode === 'background-confirm') {
				runInBackground();
			}
		},
		m: () => {
			if (mode === 'background-confirm') {
				runInModal();
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
					<Box
						key={`assistant-${idx}-${content.slice(0, 20)}`}
						marginBottom={1}
						flexDirection="column"
					>
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
			case 'background-confirm':
				return {
					title: `Claude Code: Choose Execution Mode`,
					preset: 'info'
				};
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
						<Text color={theme.text}>
							Customize the prompt for Claude Code:
						</Text>
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
						<Text color={theme.textDim}>
							Press Enter to continue, Escape to cancel
						</Text>
					</Box>
				</Box>
			);
		}

		if (mode === 'background-confirm') {
			return (
				<Box flexDirection="column">
					<Box marginBottom={2}>
						<Text color={theme.text}>
							How would you like to run Claude Code?
						</Text>
					</Box>

					<Box flexDirection="column" marginBottom={2}>
						<Box marginBottom={1}>
							<Text color={theme.success}>
								[B] Run in Background (Recommended)
							</Text>
							<Box marginLeft={4}>
								<Text color={theme.textDim}>
									Close this modal and continue working while Claude processes
								</Text>
							</Box>
						</Box>

						<Box>
							<Text color={theme.warning}>[M] Keep Modal Open</Text>
							<Box marginLeft={4}>
								<Text color={theme.textDim}>
									Watch the progress in real-time (blocks other work)
								</Text>
							</Box>
						</Box>
					</Box>

					<Box justifyContent="center">
						<Text color={theme.textDim}>
							Press B for background, M for modal, or Escape to go back
						</Text>
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
						<Text color={theme.success}>✓ Implementation Complete</Text>
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
