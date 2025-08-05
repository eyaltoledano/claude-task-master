import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { BaseModal } from '../features/ui';
import { useKeypress } from '../shared/hooks/useKeypress.js';
import { useComponentTheme } from '../shared/hooks/useTheme.js';
import { useServices } from '../shared/contexts/ServiceContext.jsx';

export function ClaudeWorktreeLauncherModal({
	worktree,
	tasks,
	onClose,
	onSuccess
}) {
	// Get services from dependency injection
	const { backend, logger } = useServices();
	const { theme } = useComponentTheme('modal');

	// Always select the task automatically for single task scenarios
	const [selectedTasks] = useState(() => {
		return tasks.map((t) => t.id);
	});

	const [customPrompt, setCustomPrompt] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState(null);
	const [view, setView] = useState('options'); // options, prompt, processing, summary
	const [processingLog, setProcessingLog] = useState('');
	const [sessionResult, setSessionResult] = useState(null);
	const [maxTurns, setMaxTurns] = useState(15);
	const [shouldCreatePR, setShouldCreatePR] = useState(true);

	// Dynamic modal props based on current view
	const getModalProps = () => {
		const baseProps = {
			width: 100,
			height: 'auto',
			onClose
		};

		switch (view) {
			case 'options':
				return {
					...baseProps,
					title: `🚀 Claude Code: Configure Session`,
					preset: 'default',
					keyboardHints: [
						'+/- adjust turns',
						'c customize prompt',
						'p toggle PR',
						'ENTER launch',
						'ESC cancel'
					]
				};
			case 'prompt':
				return {
					...baseProps,
					title: '🚀 Claude Code: Enter Instructions',
					preset: 'default',
					keyboardHints: ['ENTER launch', 'BACKSPACE back', 'ESC cancel']
				};
			case 'processing':
				return {
					...baseProps,
					title: `🚀 Claude Code: Processing`,
					preset: 'default',
					keyboardHints: ['ESC cancel']
				};
			case 'summary':
				return {
					...baseProps,
					title: '🚀 Claude Code: Task Complete',
					preset: 'success',
					keyboardHints: ['ENTER done', 'ESC cancel']
				};
			default:
				return {
					...baseProps,
					title: '🚀 Claude Code',
					preset: 'default',
					keyboardHints: ['ESC cancel']
				};
		}
	};

	const keyHandlers = {
		escape: onClose,

		return: () => {
			if (view === 'options') {
				const defaultPrompt =
					'Implement the assigned tasks according to the specifications. Follow best practices and ensure comprehensive testing.';
				setCustomPrompt(defaultPrompt);
				handleLaunch();
			} else if (view === 'prompt') {
				handleLaunch();
			} else if (view === 'summary') {
				handleComplete();
			}
		},

		backspace: () => {
			if (view === 'prompt' && customPrompt === '') {
				setView('options');
			}
		},

		c: () => {
			if (view === 'options') {
				setView('prompt');
			}
		},

		p: () => {
			if (view === 'options') {
				setShouldCreatePR(!shouldCreatePR);
			}
		},

		'+': () => {
			if (view === 'options') {
				setMaxTurns((prev) => Math.min(30, prev + 5));
			}
		},

		'-': () => {
			if (view === 'options') {
				setMaxTurns((prev) => Math.max(5, prev - 5));
			}
		}
	};

	useKeypress(keyHandlers);

	const handleLaunch = async () => {
		setView('processing');
		setIsProcessing(true);
		setProcessingLog('Initializing Claude Code session...');

		try {
			// Handle worktree creation if needed
			let actualWorktree = worktree;

			if (!actualWorktree && tasks.length > 0) {
				setProcessingLog('Creating worktree for task...');
				const task = tasks[0];
				const worktreeResult = await backend.getOrCreateWorktreeForTask(
					task.id
				);

				if (worktreeResult.created) {
					actualWorktree = worktreeResult.worktree;
				} else if (worktreeResult.exists) {
					actualWorktree = worktreeResult.worktree;
				} else {
					throw new Error('Failed to create or access worktree');
				}
			}

			// Launch Claude in headless mode
			setProcessingLog('Starting Claude Code session...');
			const session = await backend.launchClaudeHeadless(
				actualWorktree,
				tasks,
				customPrompt,
				{
					maxTurns,
					captureOutput: true,
					onProgress: (message) => {
						if (message.type === 'assistant' && message.content) {
							setProcessingLog('Claude is working...');
						}
					}
				}
			);

			if (session.success) {
				setSessionResult(session);
				setProcessingLog('Session completed successfully');
				setView('summary');
			} else {
				throw new Error(session.error || 'Claude session failed');
			}
		} catch (error) {
			console.error('Launch failed:', error);
			setError(`Launch failed: ${error.message}`);
			setIsProcessing(false);
			setView('options');
		}
	};

	const handleComplete = async () => {
		if (shouldCreatePR && sessionResult?.sessionId) {
			try {
				setProcessingLog('Creating pull request...');
				await backend.createPRFromClaudeSession(sessionResult.sessionId);
			} catch (error) {
				console.error('Failed to create PR:', error);
			}
		}

		if (onSuccess) {
			onSuccess(sessionResult);
		}
		onClose();
	};

	const renderOptions = () => (
		<Box flexDirection="column" gap={1}>
			<Text color={theme.colors.info}>
				📋 Task: {tasks[0]?.title || 'Unknown Task'}
			</Text>

			<Text color={theme.colors.muted}>
				🏗️ Worktree: {worktree?.name || 'Will create new worktree'}
			</Text>

			<Box marginTop={1}>
				<Text color={theme.colors.secondary}>Session Configuration:</Text>
			</Box>

			<Box flexDirection="column" marginLeft={2}>
				<Text>
					Max Turns: <Text color={theme.colors.accent}>{maxTurns}</Text>
					<Text color={theme.colors.muted}> (use +/- to adjust)</Text>
				</Text>

				<Text>
					Create PR:{' '}
					<Text
						color={shouldCreatePR ? theme.colors.success : theme.colors.error}
					>
						{shouldCreatePR ? 'Yes' : 'No'}
					</Text>
					<Text color={theme.colors.muted}> (press 'p' to toggle)</Text>
				</Text>
			</Box>

			<Box marginTop={1}>
				<Text color={theme.colors.muted}>
					Press 'c' to customize instructions, or ENTER to launch with defaults
				</Text>
			</Box>
		</Box>
	);

	const renderPromptInput = () => (
		<Box flexDirection="column" gap={1}>
			<Text color={theme.colors.secondary}>
				Enter custom instructions for Claude:
			</Text>

			<TextInput
				value={customPrompt}
				onChange={setCustomPrompt}
				placeholder="Describe what you want Claude to do..."
			/>

			<Text color={theme.colors.muted} marginTop={1}>
				Press ENTER to launch, or BACKSPACE to go back
			</Text>
		</Box>
	);

	const renderProcessing = () => (
		<Box flexDirection="column" gap={1}>
			<Text color={theme.colors.info}>⚙️ {processingLog}</Text>

			{isProcessing && (
				<Text color={theme.colors.muted}>This may take a few minutes...</Text>
			)}
		</Box>
	);

	const renderSummary = () => (
		<Box flexDirection="column" gap={1}>
			<Text color={theme.colors.success}>
				✅ Claude Code session completed successfully!
			</Text>

			{sessionResult?.output && (
				<Box marginTop={1} flexDirection="column">
					<Text color={theme.colors.secondary}>Session Summary:</Text>
					<Text color={theme.colors.muted}>
						{sessionResult.output.slice(0, 200)}...
					</Text>
				</Box>
			)}

			<Text color={theme.colors.muted} marginTop={1}>
				Press ENTER to finish
			</Text>
		</Box>
	);

	const renderContent = () => {
		if (error) {
			return (
				<Box flexDirection="column" gap={1}>
					<Text color={theme.colors.error}>❌ Error: {error}</Text>
					<Text color={theme.colors.muted}>Press ESC to close</Text>
				</Box>
			);
		}

		switch (view) {
			case 'options':
				return renderOptions();
			case 'prompt':
				return renderPromptInput();
			case 'processing':
				return renderProcessing();
			case 'summary':
				return renderSummary();
			default:
				return <Text>Unknown view</Text>;
		}
	};

	return <BaseModal {...getModalProps()}>{renderContent()}</BaseModal>;
}
