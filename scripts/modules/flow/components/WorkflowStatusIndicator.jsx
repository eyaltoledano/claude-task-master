import React from 'react';
import { Box, Text } from 'ink';
import { useComponentTheme } from '../hooks/useTheme.js';

export function WorkflowStatusIndicator({
	task,
	worktree,
	gitStatus,
	repoInfo,
	currentStep,
	compact = false
}) {
	const theme = useComponentTheme('status');

	const getWorkflowStep = () => {
		if (currentStep) return currentStep;

		// Determine workflow step based on task status and git status
		if (!task) return 'no-task';

		if (task.status === 'pending') return 'ready-to-start';
		if (task.status === 'in-progress') {
			if (gitStatus?.uncommitted > 0) return 'uncommitted-changes';
			if (gitStatus?.total > 0) return 'ready-to-commit';
			return 'in-development';
		}
		if (task.status === 'done') return 'completed';

		return 'unknown';
	};

	const getStepInfo = (step) => {
		const stepConfig = {
			'no-task': {
				icon: '❓',
				label: 'No Task',
				color: theme.muted,
				description: 'No task associated'
			},
			'ready-to-start': {
				icon: '🚀',
				label: 'Ready to Start',
				color: theme.info,
				description: 'Task ready for implementation'
			},
			'in-development': {
				icon: '⚡',
				label: 'In Development',
				color: theme.statusInProgress,
				description: 'Actively developing'
			},
			'uncommitted-changes': {
				icon: '📝',
				label: 'Uncommitted Changes',
				color: theme.warning,
				description: 'Changes need to be committed'
			},
			'ready-to-commit': {
				icon: '✅',
				label: 'Ready to Commit',
				color: theme.success,
				description: 'Changes staged and ready'
			},
			'ready-for-pr': {
				icon: '🔀',
				label: 'Ready for PR',
				color: theme.accent,
				description: 'Ready to create pull request'
			},
			'ready-for-merge': {
				icon: '🔗',
				label: 'Ready to Merge',
				color: theme.accent,
				description: 'Ready for local merge'
			},
			completed: {
				icon: '🎉',
				label: 'Completed',
				color: theme.success,
				description: 'Task implementation complete'
			},
			unknown: {
				icon: '❓',
				label: 'Unknown',
				color: theme.muted,
				description: 'Status unclear'
			}
		};

		return stepConfig[step] || stepConfig.unknown;
	};

	const getNextAction = (step) => {
		const actionConfig = {
			'ready-to-start': 'Start implementation',
			'in-development': 'Continue coding',
			'uncommitted-changes': 'Commit changes',
			'ready-to-commit': 'Create workflow',
			'ready-for-pr': 'Create pull request',
			'ready-for-merge': 'Merge locally',
			completed: 'Task complete',
			'no-task': 'Link a task',
			unknown: 'Check status'
		};

		return actionConfig[step] || 'Check status';
	};

	const getGitStatusSummary = () => {
		if (!gitStatus) return null;

		const parts = [];
		if (gitStatus.modified > 0) parts.push(`${gitStatus.modified}M`);
		if (gitStatus.added > 0) parts.push(`${gitStatus.added}A`);
		if (gitStatus.deleted > 0) parts.push(`${gitStatus.deleted}D`);
		if (gitStatus.untracked > 0) parts.push(`${gitStatus.untracked}U`);
		if (gitStatus.uncommitted > 0) parts.push(`${gitStatus.uncommitted}!`);

		return parts.length > 0 ? parts.join(' ') : 'Clean';
	};

	const step = getWorkflowStep();
	const stepInfo = getStepInfo(step);
	const nextAction = getNextAction(step);
	const gitSummary = getGitStatusSummary();

	if (compact) {
		return (
			<Box flexDirection="row" alignItems="center">
				<Text color={stepInfo.color}>{stepInfo.icon}</Text>
				<Text color={theme.text} marginLeft={1}>
					{stepInfo.label}
				</Text>
				{gitSummary && (
					<Text color={theme.muted} marginLeft={2}>
						({gitSummary})
					</Text>
				)}
			</Box>
		);
	}

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={stepInfo.color}
			padding={1}
		>
			{/* Header */}
			<Box flexDirection="row" alignItems="center" marginBottom={1}>
				<Text color={stepInfo.color} bold>
					{stepInfo.icon} Workflow Status
				</Text>
			</Box>

			{/* Current step */}
			<Box flexDirection="row" alignItems="center" marginBottom={1}>
				<Text color={theme.text}>Current Step:</Text>
				<Text color={stepInfo.color} marginLeft={2} bold>
					{stepInfo.label}
				</Text>
			</Box>

			{/* Step description */}
			<Box marginBottom={1}>
				<Text color={theme.muted}>{stepInfo.description}</Text>
			</Box>

			{/* Git status */}
			{gitStatus && (
				<Box flexDirection="row" alignItems="center" marginBottom={1}>
					<Text color={theme.text}>Git Status:</Text>
					<Text color={theme.muted} marginLeft={2}>
						{gitSummary}
					</Text>
				</Box>
			)}

			{/* Repository info */}
			{repoInfo && (
				<Box flexDirection="row" alignItems="center" marginBottom={1}>
					<Text color={theme.text}>Repository:</Text>
					<Text color={theme.muted} marginLeft={2}>
						{repoInfo.provider || 'Local'}
						{repoInfo.isGitHub && ' (GitHub)'}
					</Text>
				</Box>
			)}

			{/* Next action */}
			<Box flexDirection="row" alignItems="center">
				<Text color={theme.text}>Next Action:</Text>
				<Text color={theme.accent} marginLeft={2} bold>
					{nextAction}
				</Text>
			</Box>
		</Box>
	);
}

export function GitStatusIndicator({ gitStatus, compact = true }) {
	const theme = useComponentTheme('status');

	if (!gitStatus) {
		return compact ? (
			<Text color={theme.muted}>Git: Unknown</Text>
		) : (
			<Box borderStyle="round" borderColor={theme.muted} padding={1}>
				<Text color={theme.muted}>Git status unavailable</Text>
			</Box>
		);
	}

	const getStatusColor = () => {
		if (gitStatus.uncommitted > 0) return theme.warning;
		if (gitStatus.total > 0) return theme.info;
		return theme.success;
	};

	const getStatusIcon = () => {
		if (gitStatus.uncommitted > 0) return '⚠️';
		if (gitStatus.total > 0) return '📝';
		return '✅';
	};

	const statusColor = getStatusColor();
	const statusIcon = getStatusIcon();

	if (compact) {
		const summary = [];
		if (gitStatus.modified > 0) summary.push(`${gitStatus.modified}M`);
		if (gitStatus.added > 0) summary.push(`${gitStatus.added}A`);
		if (gitStatus.deleted > 0) summary.push(`${gitStatus.deleted}D`);
		if (gitStatus.untracked > 0) summary.push(`${gitStatus.untracked}U`);
		if (gitStatus.uncommitted > 0) summary.push(`${gitStatus.uncommitted}!`);

		return (
			<Box flexDirection="row" alignItems="center">
				<Text color={statusColor}>{statusIcon}</Text>
				<Text color={theme.text} marginLeft={1}>
					Git: {summary.length > 0 ? summary.join(' ') : 'Clean'}
				</Text>
			</Box>
		);
	}

	return (
		<Box borderStyle="round" borderColor={statusColor} padding={1}>
			<Box flexDirection="row" alignItems="center" marginBottom={1}>
				<Text color={statusColor} bold>
					{statusIcon} Git Status
				</Text>
			</Box>

			<Box flexDirection="column">
				{gitStatus.modified > 0 && (
					<Text color={theme.text}>Modified: {gitStatus.modified}</Text>
				)}
				{gitStatus.added > 0 && (
					<Text color={theme.text}>Added: {gitStatus.added}</Text>
				)}
				{gitStatus.deleted > 0 && (
					<Text color={theme.text}>Deleted: {gitStatus.deleted}</Text>
				)}
				{gitStatus.untracked > 0 && (
					<Text color={theme.text}>Untracked: {gitStatus.untracked}</Text>
				)}
				{gitStatus.uncommitted > 0 && (
					<Text color={theme.warning}>
						Uncommitted: {gitStatus.uncommitted}
					</Text>
				)}
				{gitStatus.total === 0 && (
					<Text color={theme.success}>Working directory clean</Text>
				)}
			</Box>
		</Box>
	);
}
