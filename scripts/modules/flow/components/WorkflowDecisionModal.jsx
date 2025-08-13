import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { LoadingSpinner } from '../shared/components/ui/LoadingSpinner.jsx';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../shared/hooks/useKeypress.js';
import { useComponentTheme } from '../shared/hooks/useTheme.js';

export function WorkflowDecisionModal({
	worktree,
	taskInfo,
	backend,
	onDecision,
	onClose
}) {
	const [loading, setLoading] = useState(true);
	const [gitStatus, setGitStatus] = useState(null);
	const [repoInfo, setRepoInfo] = useState(null);
	const [workflowOptions, setWorkflowOptions] = useState([]);
	const [selectedOption, setSelectedOption] = useState(0);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState(null);
	const theme = useComponentTheme('modal');

	useEffect(() => {
		loadWorkflowData();
	}, []);

	const loadWorkflowData = async () => {
		setLoading(true);
		try {
			// Load git status and repository information
			const [status, repo] = await Promise.all([
				backend.getWorktreeGitStatus(worktree.path),
				backend.detectRemoteRepository
					? backend.detectRemoteRepository()
					: Promise.resolve(null)
			]);

			setGitStatus(status);
			setRepoInfo(repo);

			// Generate workflow options based on current state
			const options = generateWorkflowOptions(status, repo);
			setWorkflowOptions(options);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const generateWorkflowOptions = (status, repo) => {
		const options = [];
		const hasChanges =
			status &&
			(status.total > 0 ||
				status.modified > 0 ||
				status.added > 0 ||
				status.deleted > 0 ||
				status.untracked > 0);

		// Commit changes option (if uncommitted changes)
		if (hasChanges && status.uncommitted > 0) {
			options.push({
				value: 'commit-changes',
				label: 'Commit Changes',
				description: `Stage and commit ${status.uncommitted} uncommitted changes`,
				icon: '📝',
				recommended: true
			});
		}

		// Create PR option (if GitHub repository)
		if (hasChanges && repo?.isGitHub) {
			options.push({
				value: 'create-pr',
				label: 'Create Pull Request',
				description: 'Push changes and create a GitHub PR',
				icon: '🔀',
				recommended: repo.hasGitHubCLI
			});
		}

		// Local merge option
		if (hasChanges) {
			options.push({
				value: 'merge-local',
				label: 'Merge Locally',
				description: 'Merge changes to main branch locally',
				icon: '🔗',
				recommended: !repo?.isGitHub
			});
		}

		// Continue working option
		options.push({
			value: 'continue-working',
			label: 'Continue Working',
			description: 'Keep worktree open for more development',
			icon: '⚡',
			recommended: false
		});

		// Close worktree option (with warnings)
		options.push({
			value: 'close-worktree',
			label: 'Close Worktree',
			description: hasChanges
				? '⚠️  This will lose uncommitted changes!'
				: 'Clean up and close the worktree',
			icon: '🗑️',
			recommended: false,
			warning: hasChanges
		});

		return options;
	};

	const handleSelection = async () => {
		if (isProcessing || workflowOptions.length === 0) return;

		const selectedWorkflow = workflowOptions[selectedOption];

		// Show warning for destructive actions
		if (selectedWorkflow.warning) {
			// For now, proceed anyway - could add confirmation modal later
		}

		setIsProcessing(true);
		try {
			await onDecision(selectedWorkflow.value, {
				taskInfo,
				gitStatus,
				repoInfo,
				workflowOption: selectedWorkflow
			});
		} catch (err) {
			setError(err.message);
		} finally {
			setIsProcessing(false);
		}
	};

	const keyHandlers = {
		escape: onClose,
		up: () => setSelectedOption(Math.max(0, selectedOption - 1)),
		down: () =>
			setSelectedOption(
				Math.min(workflowOptions.length - 1, selectedOption + 1)
			),
		j: () =>
			setSelectedOption(
				Math.min(workflowOptions.length - 1, selectedOption + 1)
			),
		k: () => setSelectedOption(Math.max(0, selectedOption - 1)),
		return: handleSelection
	};

	useKeypress(keyHandlers);

	const modalProps = {
		title: `Workflow Options: ${worktree.name}`,
		preset: error ? 'error' : 'info',
		width: '80%',
		height: '70%',
		keyboardHints: ['↑↓ navigate', 'j/k vim nav', 'ENTER select', 'ESC cancel'],
		onClose
	};

	if (loading) {
		return (
			<BaseModal {...modalProps}>
				<LoadingSpinner message="Analyzing workflow options..." />
			</BaseModal>
		);
	}

	return (
		<BaseModal {...modalProps}>
			<Box flexDirection="column">
				{/* Header with current state */}
				<Box
					marginBottom={2}
					borderStyle="round"
					borderColor={theme.accent}
					padding={1}
				>
					<Box flexDirection="column">
						<Text bold color={theme.accent}>
							Current State
						</Text>
						{gitStatus && (
							<Box marginTop={1}>
								<Text color={theme.text}>
									📊 Git Status: {gitStatus.modified || 0} modified,{' '}
									{gitStatus.added || 0} added, {gitStatus.deleted || 0} deleted
								</Text>
								{gitStatus.uncommitted > 0 && (
									<Text color={theme.warning}>
										⚠️ {gitStatus.uncommitted} uncommitted changes
									</Text>
								)}
							</Box>
						)}
						{repoInfo && (
							<Box marginTop={1}>
								<Text color={theme.text}>
									🌐 Repository: {repoInfo.provider || 'Local'}
									{repoInfo.isGitHub &&
										repoInfo.hasGitHubCLI &&
										' (GitHub CLI available)'}
								</Text>
							</Box>
						)}
						{taskInfo && (
							<Box marginTop={1}>
								<Text color={theme.text}>
									📋 Task:{' '}
									{taskInfo.parentId
										? `${taskInfo.parentId}.${taskInfo.id}`
										: taskInfo.id}{' '}
									- {taskInfo.title}
								</Text>
							</Box>
						)}
					</Box>
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

				{/* Processing indicator */}
				{isProcessing && (
					<Box marginBottom={2}>
						<LoadingSpinner message="Processing workflow decision..." />
					</Box>
				)}

				{/* Workflow options */}
				<Box flexDirection="column">
					<Text bold color={theme.accent} marginBottom={1}>
						Available Workflows:
					</Text>

					{workflowOptions.map((option, index) => (
						<Box
							key={option.value}
							marginBottom={1}
							backgroundColor={
								index === selectedOption ? theme.backgroundHighlight : undefined
							}
							borderStyle={index === selectedOption ? 'round' : undefined}
							borderColor={index === selectedOption ? theme.accent : undefined}
							paddingX={1}
							paddingY={0}
						>
							<Box flexDirection="column" width="100%">
								<Box flexDirection="row" alignItems="center">
									<Text
										color={index === selectedOption ? theme.accent : theme.text}
									>
										{index === selectedOption ? '▸ ' : '  '}
										{option.icon} {option.label}
									</Text>
									{option.recommended && (
										<Text color={theme.success} marginLeft={2}>
											✨ Recommended
										</Text>
									)}
									{option.warning && (
										<Text color={theme.warning} marginLeft={2}>
											⚠️ Warning
										</Text>
									)}
								</Box>

								{index === selectedOption && option.description && (
									<Box marginLeft={4} marginTop={0}>
										<Text color={theme.muted}>{option.description}</Text>
									</Box>
								)}
							</Box>
						</Box>
					))}
				</Box>

				{/* Workflow guidance */}
				<Box
					marginTop={2}
					borderStyle="round"
					borderColor={theme.muted}
					padding={1}
				>
					<Text bold color={theme.accent}>
						💡 Workflow Guide
					</Text>
					<Box marginTop={1}>
						<Text color={theme.muted}>
							• Create PR: Best for collaborative development and code review
						</Text>
						<Text color={theme.muted}>
							• Merge Locally: Quick integration for solo development
						</Text>
						<Text color={theme.muted}>
							• Continue Working: Keep developing in the same worktree
						</Text>
					</Box>
				</Box>
			</Box>
		</BaseModal>
	);
}
