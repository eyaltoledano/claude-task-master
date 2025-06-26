import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { Toast } from './Toast.jsx';

function ClaudeCodeTaskModal({ task, subtask, backend, onClose }) {
	const [prompt, setPrompt] = useState('');
	const [messages, setMessages] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(null);
	const [mode, setMode] = useState('prompt'); // prompt, processing, results
	const [abortController, setAbortController] = useState(null);

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

	useInput((input, key) => {
		if (key.escape) {
			if (isProcessing && abortController) {
				handleAbort();
			} else {
				onClose();
			}
			return;
		}

		if (mode === 'prompt' && key.return) {
			handleSubmit();
		} else if (mode === 'results') {
			if (input === 'q' || key.escape) {
				onClose();
			}
		}
	});

	const renderMessages = () => {
		return messages.map((msg, idx) => {
			if (msg.type === 'assistant') {
				const content = msg.message.content?.[0]?.text || '';
				return (
					<Box key={idx} marginBottom={1} flexDirection="column">
						<Text color="green">Claude: </Text>
						<Box marginLeft={2} width={80}>
							<Text wrap="wrap">{content}</Text>
						</Box>
					</Box>
				);
			} else if (msg.type === 'result') {
				return (
					<Box key={idx} marginTop={1}>
						<Text color="yellow">
							Completed: {msg.num_turns} turns | Cost: $
							{msg.total_cost_usd?.toFixed(4) || '0.0000'}
						</Text>
					</Box>
				);
			}
			return null;
		});
	};

	const taskInfo = subtask || task;

	return (
		<Box
			flexDirection="column"
			padding={1}
			borderStyle="round"
			borderColor="cyan"
		>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					Claude Code: Implement Task {taskInfo.id}
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text color="gray">{taskInfo.title}</Text>
			</Box>

			{mode === 'prompt' && (
				<Box flexDirection="column">
					<Text>Customize the prompt for Claude Code:</Text>
					<Box marginTop={1} flexDirection="column">
						<TextInput
							value={prompt}
							onChange={setPrompt}
							placeholder="Describe what you want Claude to help with..."
							showCursor={!isProcessing}
						/>
					</Box>
					<Box marginTop={1}>
						<Text color="gray">Press Enter to start, Escape to cancel</Text>
					</Box>
				</Box>
			)}

			{mode === 'processing' && (
				<Box flexDirection="column">
					<Box marginBottom={1}>
						<Text color="yellow">
							<Spinner type="dots" /> Claude Code is working on your task...
						</Text>
					</Box>
					<Box flexDirection="column" height={15}>
						{renderMessages()}
					</Box>
					<Box marginTop={1}>
						<Text color="gray">Press Escape to abort</Text>
					</Box>
				</Box>
			)}

			{mode === 'results' && (
				<Box flexDirection="column">
					<Text color="green" marginBottom={1}>
						✓ Implementation Complete
					</Text>
					<Box flexDirection="column" height={20}>
						{renderMessages()}
					</Box>
					<Box marginTop={1}>
						<Text color="gray">Press q or Escape to close</Text>
					</Box>
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

export default ClaudeCodeTaskModal;
