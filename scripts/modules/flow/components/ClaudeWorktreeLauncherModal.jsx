import React, { useState, useEffect } from 'react';
import { Box, Text, TextInput, Spinner, useInput } from 'ink';
import { getTheme } from '../theme.js';

export function ClaudeWorktreeLauncherModal({
	backend,
	worktree,
	tasks,
	onClose,
	onSuccess
}) {
	const [selectedTasks, setSelectedTasks] = useState([]);
	const [launchMode, setLaunchMode] = useState('interactive'); // interactive, headless, batch
	const [headlessPrompt, setHeadlessPrompt] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState(null);
	const [streamingOutput, setStreamingOutput] = useState('');
	const theme = getTheme();

	useEffect(() => {
		// Pre-select the first task if only one is linked
		if (tasks.length === 1) {
			setSelectedTasks([tasks[0].id]);
		}
	}, [tasks]);

	// Keyboard handling
	useInput((input, key) => {
		if (isProcessing) return;

		if (key.escape) {
			onClose();
			return;
		}

		if (input === 'i') {
			setLaunchMode('interactive');
		} else if (input === 'h') {
			setLaunchMode('headless');
		} else if (input === 'b' && tasks.length > 1) {
			setLaunchMode('batch');
		} else if (input === 'l') {
			handleLaunch();
		} else if (input >= '1' && input <= '9') {
			const idx = parseInt(input) - 1;
			if (idx < tasks.length) {
				toggleTaskSelection(tasks[idx].id);
			}
		} else if (input === ' ') {
			// Space to toggle current selection
			if (tasks.length > 0) {
				toggleTaskSelection(tasks[0].id);
			}
		}
	});

	const handleLaunch = async () => {
		if (selectedTasks.length === 0) {
			setError('Please select at least one task');
			return;
		}

		if (
			(launchMode === 'headless' || launchMode === 'batch') &&
			!headlessPrompt.trim()
		) {
			setError('Please enter a prompt for headless mode');
			return;
		}

		setIsProcessing(true);
		setError(null);
		setStreamingOutput('');

		try {
			const selectedTaskObjects = tasks.filter((t) =>
				selectedTasks.includes(t.id)
			);

			if (launchMode === 'batch') {
				// Launch multiple sessions
				const result = await backend.launchMultipleClaudeSessions(
					selectedTaskObjects,
					{
						mode: headlessPrompt ? 'headless' : 'interactive',
						prompt: headlessPrompt
					}
				);

				if (result.success) {
					onSuccess(`Launched ${result.totalLaunched} Claude sessions`);
					onClose();
				} else {
					setError(result.error);
				}
			} else {
				// Launch single session
				const task = selectedTaskObjects[0];
				const result = await backend.launchClaudeCLI(worktree.path, {
					mode: launchMode,
					task: task,
					prompt: headlessPrompt,
					streaming: launchMode === 'headless',
					contextData: {
						worktree: worktree,
						research: task.researchFindings || '',
						projectContext: await backend.research({
							query: `Project structure and context for ${worktree.name}`,
							includeProjectTree: true,
							detailLevel: 'low'
						})
					}
				});

				if (result.success) {
					if (result.mode === 'interactive') {
						onSuccess(
							`Launched Claude in interactive mode for ${worktree.name}`
						);
						onClose();
					} else if (result.mode === 'headless-streaming' && result.process) {
						// Handle streaming
						handleStreamingProcess(result.process);
					} else if (result.mode === 'headless-blocking') {
						setStreamingOutput(result.output);
						setTimeout(() => {
							onSuccess('Claude session completed');
							onClose();
						}, 3000);
					}
				} else {
					setError(result.error);
				}
			}
		} catch (err) {
			setError(err.message);
		} finally {
			if (launchMode !== 'headless') {
				setIsProcessing(false);
			}
		}
	};

	const handleStreamingProcess = (claudeProcess) => {
		claudeProcess.stdout.on('data', (data) => {
			setStreamingOutput((prev) => prev + data.toString());
		});

		claudeProcess.stderr.on('data', (data) => {
			setError((prev) => (prev || '') + data.toString());
		});

		claudeProcess.on('close', (code) => {
			setIsProcessing(false);
			if (code === 0) {
				onSuccess('Claude session completed successfully');
				setTimeout(() => onClose(), 2000);
			} else {
				setError(`Claude exited with code ${code}`);
			}
		});

		claudeProcess.on('error', (error) => {
			setIsProcessing(false);
			setError(error.message);
		});
	};

	const toggleTaskSelection = (taskId) => {
		setSelectedTasks((prev) => {
			if (prev.includes(taskId)) {
				return prev.filter((id) => id !== taskId);
			}
			return [...prev, taskId];
		});
	};

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={theme.border}
			padding={1}
			width={80}
		>
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color={theme.primary}>
					Launch Claude in {worktree.name}
				</Text>
			</Box>

			{/* Launch Mode Selection */}
			<Box marginBottom={1} flexDirection="column">
				<Text color={theme.secondary}>Select Launch Mode:</Text>
				<Box flexDirection="row" gap={2}>
					<Box>
						<Text
							color={launchMode === 'interactive' ? theme.success : theme.dim}
							bold={launchMode === 'interactive'}
						>
							[I] Interactive
						</Text>
					</Box>
					<Box>
						<Text
							color={launchMode === 'headless' ? theme.success : theme.dim}
							bold={launchMode === 'headless'}
						>
							[H] Headless
						</Text>
					</Box>
					{tasks.length > 1 && (
						<Box>
							<Text
								color={launchMode === 'batch' ? theme.success : theme.dim}
								bold={launchMode === 'batch'}
							>
								[B] Batch
							</Text>
						</Box>
					)}
				</Box>
			</Box>

			{/* Task Selection */}
			<Box marginBottom={1} flexDirection="column">
				<Text color={theme.secondary}>Select Task(s):</Text>
				<Box flexDirection="column" maxHeight={10}>
					{tasks.map((task, idx) => (
						<Box key={task.id}>
							<Text
								color={
									selectedTasks.includes(task.id) ? theme.success : theme.text
								}
							>
								{selectedTasks.includes(task.id) ? '☑ ' : '☐ '}[{idx + 1}]{' '}
								{task.id}: {task.title}
							</Text>
						</Box>
					))}
				</Box>
			</Box>

			{/* Headless Prompt */}
			{(launchMode === 'headless' || launchMode === 'batch') && (
				<Box marginBottom={1} flexDirection="column">
					<Text color={theme.secondary}>Prompt:</Text>
					<Box borderStyle="single" borderColor={theme.border} padding={1}>
						<TextInput
							value={headlessPrompt}
							onChange={setHeadlessPrompt}
							placeholder="Enter prompt for Claude..."
						/>
					</Box>
				</Box>
			)}

			{/* Streaming Output */}
			{streamingOutput && (
				<Box
					marginBottom={1}
					flexDirection="column"
					borderStyle="single"
					borderColor={theme.border}
					padding={1}
					maxHeight={15}
				>
					<Text>{streamingOutput}</Text>
				</Box>
			)}

			{/* Error Display */}
			{error && (
				<Box marginBottom={1}>
					<Text color={theme.error}>{error}</Text>
				</Box>
			)}

			{/* Action Buttons */}
			<Box flexDirection="row" gap={2}>
				{!isProcessing ? (
					<>
						<Box borderStyle="single" borderColor={theme.primary} paddingX={2}>
							<Text color={theme.primary}>[L] Launch</Text>
						</Box>
						<Box borderStyle="single" borderColor={theme.dim} paddingX={2}>
							<Text color={theme.dim}>[ESC] Cancel</Text>
						</Box>
					</>
				) : (
					<Box>
						<Text color={theme.warning}>
							<Spinner type="dots" /> Processing...
						</Text>
					</Box>
				)}
			</Box>

			{/* Help Text */}
			{!isProcessing && (
				<Box marginTop={1}>
					<Text dimColor>
						[I/H/B] Change mode | [1-9] Toggle task | [L] Launch | [ESC] Cancel
					</Text>
				</Box>
			)}
		</Box>
	);
}
