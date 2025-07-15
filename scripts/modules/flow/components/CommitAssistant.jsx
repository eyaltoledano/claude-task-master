import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../shared/hooks/useKeypress.js';
import { useComponentTheme } from '../shared/hooks/useTheme.js';

export function CommitAssistant({
	worktree,
	subtaskInfo,
	gitStatus,
	backend,
	onCommit,
	onClose
}) {
	const [commitMessage, setCommitMessage] = useState('');
	const [messageType, setMessageType] = useState('feat'); // feat, fix, test, docs, refactor, chore
	const [customMessage, setCustomMessage] = useState('');
	const [selectedTemplate, setSelectedTemplate] = useState(0);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState(null);
	const theme = useComponentTheme('modal');

	const messageTypes = [
		{
			value: 'feat',
			label: 'Feature',
			description: 'New feature implementation'
		},
		{ value: 'fix', label: 'Bug Fix', description: 'Bug fix or correction' },
		{ value: 'test', label: 'Tests', description: 'Adding or updating tests' },
		{
			value: 'docs',
			label: 'Documentation',
			description: 'Documentation changes'
		},
		{ value: 'refactor', label: 'Refactor', description: 'Code refactoring' },
		{ value: 'chore', label: 'Chore', description: 'Maintenance or tooling' }
	];

	useEffect(() => {
		generateSuggestedMessage();
	}, []); // Generate once on mount

	const generateSuggestedMessage = () => {
		if (!subtaskInfo) return;

		const taskId = subtaskInfo.parentId || subtaskInfo.id;
		const subtaskId = subtaskInfo.parentId
			? `${subtaskInfo.parentId}.${subtaskInfo.id}`
			: subtaskInfo.id;
		const title = subtaskInfo.title || 'Implementation';

		// Generate commit message following dev_workflow.mdc patterns
		const message = `${messageType}(task-${taskId}): Complete subtask ${subtaskId} - ${title}

- ${getImplementationDetails()}
- Key changes made during implementation
- Any important notes or decisions

Subtask ${subtaskId}: ${getSubtaskDescription()}
Relates to Task ${taskId}: ${subtaskInfo.parentTitle || title}`;

		setCommitMessage(message);
	};

	const getImplementationDetails = () => {
		if (!gitStatus) return 'Implementation details';

		const details = [];
		if (gitStatus.modified > 0)
			details.push(`Modified ${gitStatus.modified} files`);
		if (gitStatus.added > 0) details.push(`Added ${gitStatus.added} new files`);
		if (gitStatus.deleted > 0)
			details.push(`Removed ${gitStatus.deleted} files`);

		return details.length > 0 ? details.join(', ') : 'Implementation details';
	};

	const getSubtaskDescription = () => {
		if (subtaskInfo?.details) {
			// Extract first meaningful line from details
			const lines = subtaskInfo.details
				.split('\n')
				.filter((line) => line.trim());
			const firstLine = lines.find(
				(line) =>
					!line.includes('<info added on') &&
					!line.includes('Progress:') &&
					line.trim().length > 10
			);
			return firstLine
				? firstLine.trim().substring(0, 80) + '...'
				: 'Implementation completed';
		}
		return 'Implementation completed';
	};

	const validateCommitMessage = (message) => {
		const errors = [];

		// Check basic format
		if (!message.trim()) {
			errors.push('Commit message cannot be empty');
			return errors;
		}

		const lines = message.split('\n');
		const firstLine = lines[0];

		// Check first line format
		if (
			!firstLine.match(
				/^(feat|fix|docs|style|refactor|test|chore)\([^)]+\):\s*.+/
			)
		) {
			errors.push('First line must follow format: type(scope): description');
		}

		// Check first line length
		if (firstLine.length > 72) {
			errors.push('First line should be 72 characters or less');
		}

		// Check for blank line after first line
		if (lines.length > 1 && lines[1].trim() !== '') {
			errors.push('Second line should be blank');
		}

		// Check for task reference
		if (!message.includes('Subtask') && !message.includes('Task')) {
			errors.push('Commit should reference task/subtask ID');
		}

		return errors;
	};

	const handleCommit = async () => {
		const validationErrors = validateCommitMessage(commitMessage);
		if (validationErrors.length > 0) {
			setError(`Validation errors: ${validationErrors.join(', ')}`);
			return;
		}

		try {
			await onCommit(commitMessage, {
				type: messageType,
				subtaskInfo,
				gitStatus
			});
		} catch (err) {
			setError(err.message);
		}
	};

	const generateSmartMessage = async () => {
		if (!backend.generateCommitMessage) {
			setError('Smart message generation not available');
			return;
		}

		setIsGenerating(true);
		try {
			const result = await backend.generateCommitMessage(worktree.path, {
				subtaskInfo,
				gitStatus,
				messageType
			});

			if (result.success) {
				setCommitMessage(result.message);
			} else {
				setError(result.error || 'Failed to generate message');
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setIsGenerating(false);
		}
	};

	const keyHandlers = {
		escape: onClose,
		return: () => {
			if (!isGenerating) {
				handleCommit();
			}
		},
		tab: () => {
			// Cycle through message types
			const currentIndex = messageTypes.findIndex(
				(type) => type.value === messageType
			);
			const nextIndex = (currentIndex + 1) % messageTypes.length;
			setMessageType(messageTypes[nextIndex].value);
		},
		g: () => {
			if (!isGenerating) {
				generateSmartMessage();
			}
		}
	};

	useKeypress(keyHandlers);

	const modalProps = {
		title: `Commit Assistant: ${worktree.name}`,
		preset: error ? 'error' : 'default',
		width: '85%',
		height: '80%',
		keyboardHints: [
			'TAB cycle type',
			'g generate smart',
			'ENTER commit',
			'ESC cancel'
		],
		onClose
	};

	return (
		<BaseModal {...modalProps}>
			<Box flexDirection="column">
				{/* Header with task info */}
				<Box
					marginBottom={2}
					borderStyle="round"
					borderColor={theme.accent}
					padding={1}
				>
					<Box flexDirection="column">
						<Text bold color={theme.accent}>
							Commit Information
						</Text>
						{subtaskInfo && (
							<Box marginTop={1}>
								<Text color={theme.text}>
									📋 Task:{' '}
									{subtaskInfo.parentId
										? `${subtaskInfo.parentId}.${subtaskInfo.id}`
										: subtaskInfo.id}{' '}
									- {subtaskInfo.title}
								</Text>
							</Box>
						)}
						{gitStatus && (
							<Box marginTop={1}>
								<Text color={theme.text}>
									📊 Changes: {gitStatus.modified || 0}M {gitStatus.added || 0}A{' '}
									{gitStatus.deleted || 0}D
								</Text>
							</Box>
						)}
					</Box>
				</Box>

				{/* Message type selector */}
				<Box marginBottom={2}>
					<Text bold color={theme.accent}>
						Message Type:
					</Text>
					<Box flexDirection="row" flexWrap="wrap" marginTop={1}>
						{messageTypes.map((type, index) => (
							<Box
								key={type.value}
								marginRight={2}
								marginBottom={1}
								backgroundColor={
									type.value === messageType
										? theme.backgroundHighlight
										: undefined
								}
								borderStyle={type.value === messageType ? 'round' : undefined}
								borderColor={
									type.value === messageType ? theme.accent : undefined
								}
								paddingX={1}
							>
								<Text
									color={type.value === messageType ? theme.accent : theme.text}
								>
									{type.label}
								</Text>
							</Box>
						))}
					</Box>
					<Text color={theme.muted} marginTop={1}>
						{messageTypes.find((t) => t.value === messageType)?.description}
					</Text>
				</Box>

				{/* Error display */}
				{error && (
					<Box
						marginBottom={2}
						borderStyle="round"
						borderColor={theme.error}
						padding={1}
					>
						<Text color={theme.error}>❌ {error}</Text>
					</Box>
				)}

				{/* Loading indicator */}
				{isGenerating && (
					<Box marginBottom={2}>
						<Text color={theme.info}>
							🤖 Generating smart commit message...
						</Text>
					</Box>
				)}

				{/* Commit message preview */}
				<Box marginBottom={2}>
					<Text bold color={theme.accent}>
						Generated Commit Message:
					</Text>
					<Box
						marginTop={1}
						borderStyle="round"
						borderColor={theme.muted}
						padding={1}
						height={12}
					>
						<Text color={theme.text}>{commitMessage}</Text>
					</Box>
				</Box>

				{/* Validation status */}
				<Box marginBottom={2}>
					<Text bold color={theme.accent}>
						Validation:
					</Text>
					<Box marginTop={1}>
						{(() => {
							const errors = validateCommitMessage(commitMessage);
							if (errors.length === 0) {
								return (
									<Text color={theme.success}>✅ Message format is valid</Text>
								);
							} else {
								return (
									<Box flexDirection="column">
										{errors.map((error) => (
											<Text key={error} color={theme.error}>
												❌ {error}
											</Text>
										))}
									</Box>
								);
							}
						})()}
					</Box>
				</Box>

				{/* Action guidance */}
				<Box borderStyle="round" borderColor={theme.muted} padding={1}>
					<Text bold color={theme.accent}>
						💡 Commit Guidelines
					</Text>
					<Box marginTop={1}>
						<Text color={theme.muted}>
							• Use TAB to cycle through message types (feat, fix, test, etc.)
						</Text>
						<Text color={theme.muted}>
							• Press 'g' to generate a smart commit message using AI
						</Text>
						<Text color={theme.muted}>
							• First line: type(scope): brief description (≤72 chars)
						</Text>
						<Text color={theme.muted}>
							• Include implementation details and task references
						</Text>
					</Box>
				</Box>
			</Box>
		</BaseModal>
	);
}
