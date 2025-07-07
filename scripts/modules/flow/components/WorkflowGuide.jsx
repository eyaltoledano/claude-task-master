import React from 'react';
import { Box, Text } from 'ink';
import { useComponentTheme } from '../hooks/useTheme.js';

export function WorkflowGuide({
	currentStep,
	taskInfo,
	gitStatus,
	repoInfo,
	compact = false
}) {
	const theme = useComponentTheme('guide');

	const workflowSteps = [
		{
			id: 'start',
			label: 'Start Implementation',
			description: 'Begin working on the task',
			icon: '🚀',
			actions: ['Set task status to in-progress', 'Create worktree if needed']
		},
		{
			id: 'develop',
			label: 'Development',
			description: 'Write code and implement features',
			icon: '⚡',
			actions: ['Write code', 'Run tests', 'Log progress regularly']
		},
		{
			id: 'commit',
			label: 'Commit Changes',
			description: 'Stage and commit your work',
			icon: '📝',
			actions: ['Stage changes', 'Write commit message', 'Commit to branch']
		},
		{
			id: 'workflow',
			label: 'Choose Workflow',
			description: 'Decide how to integrate changes',
			icon: '🔀',
			actions: ['Create PR for review', 'Merge locally', 'Continue development']
		},
		{
			id: 'complete',
			label: 'Complete',
			description: 'Task implementation finished',
			icon: '🎉',
			actions: ['Update task status', 'Clean up worktree', 'Move to next task']
		}
	];

	const getCurrentStepIndex = () => {
		if (!currentStep) {
			// Determine step based on task and git status
			if (!taskInfo) return 0;
			if (taskInfo.status === 'pending') return 0;
			if (taskInfo.status === 'in-progress') {
				if (gitStatus?.uncommitted > 0) return 2; // Need to commit
				if (gitStatus?.total > 0) return 3; // Ready for workflow
				return 1; // Still developing
			}
			if (taskInfo.status === 'done') return 4;
			return 0;
		}

		const stepMap = {
			'ready-to-start': 0,
			'in-development': 1,
			'uncommitted-changes': 2,
			'ready-to-commit': 2,
			'ready-for-workflow': 3,
			completed: 4
		};

		return stepMap[currentStep] || 0;
	};

	const getNextActions = (stepIndex) => {
		const step = workflowSteps[stepIndex];
		if (!step) return [];

		// Customize actions based on current state
		const actions = [...step.actions];

		// Add context-specific actions
		if (stepIndex === 3) {
			// Workflow step
			actions.length = 0; // Clear default actions
			if (repoInfo?.isGitHub) {
				actions.push('Create Pull Request (recommended for GitHub)');
			}
			actions.push('Merge Locally (quick integration)');
			actions.push('Continue Working (more changes needed)');
		}

		return actions;
	};

	const currentStepIndex = getCurrentStepIndex();
	const currentStepInfo = workflowSteps[currentStepIndex];
	const nextActions = getNextActions(currentStepIndex);

	if (compact) {
		return (
			<Box flexDirection="row" alignItems="center">
				<Text color={theme.accent}>{currentStepInfo.icon}</Text>
				<Text color={theme.text} marginLeft={1}>
					{currentStepInfo.label}
				</Text>
				<Text color={theme.muted} marginLeft={2}>
					({currentStepIndex + 1}/{workflowSteps.length})
				</Text>
			</Box>
		);
	}

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={theme.accent}
			padding={1}
		>
			{/* Header */}
			<Box flexDirection="row" alignItems="center" marginBottom={2}>
				<Text color={theme.accent} bold>
					🧭 Workflow Guide
				</Text>
				<Text color={theme.muted} marginLeft={2}>
					Step {currentStepIndex + 1} of {workflowSteps.length}
				</Text>
			</Box>

			{/* Progress indicator */}
			<Box flexDirection="row" marginBottom={2}>
				{workflowSteps.map((step, index) => (
					<Box key={step.id} flexDirection="row" alignItems="center">
						<Text
							color={
								index < currentStepIndex
									? theme.success
									: index === currentStepIndex
										? theme.accent
										: theme.muted
							}
						>
							{index < currentStepIndex
								? '✅'
								: index === currentStepIndex
									? step.icon
									: '⭕'}
						</Text>
						{index < workflowSteps.length - 1 && (
							<Text color={theme.muted} marginX={1}>
								→
							</Text>
						)}
					</Box>
				))}
			</Box>

			{/* Current step details */}
			<Box
				marginBottom={2}
				borderStyle="round"
				borderColor={theme.accent}
				padding={1}
			>
				<Box flexDirection="row" alignItems="center" marginBottom={1}>
					<Text color={theme.accent} bold>
						{currentStepInfo.icon} {currentStepInfo.label}
					</Text>
				</Box>
				<Text color={theme.text} marginBottom={1}>
					{currentStepInfo.description}
				</Text>
			</Box>

			{/* Next actions */}
			<Box marginBottom={2}>
				<Text bold color={theme.accent} marginBottom={1}>
					🎯 Recommended Actions:
				</Text>
				<Box flexDirection="column">
					{nextActions.map((action) => (
						<Box
							key={action}
							flexDirection="row"
							alignItems="center"
							marginBottom={0}
						>
							<Text color={theme.muted}>•</Text>
							<Text color={theme.text} marginLeft={1}>
								{action}
							</Text>
						</Box>
					))}
				</Box>
			</Box>

			{/* Context information */}
			{(taskInfo || gitStatus || repoInfo) && (
				<Box borderStyle="round" borderColor={theme.muted} padding={1}>
					<Text bold color={theme.accent} marginBottom={1}>
						📋 Current Context:
					</Text>
					{taskInfo && (
						<Text color={theme.text}>
							Task:{' '}
							{taskInfo.parentId
								? `${taskInfo.parentId}.${taskInfo.id}`
								: taskInfo.id}{' '}
							- {taskInfo.title} ({taskInfo.status})
						</Text>
					)}
					{gitStatus && (
						<Text color={theme.text}>
							Git: {gitStatus.modified || 0}M {gitStatus.added || 0}A{' '}
							{gitStatus.deleted || 0}D
							{gitStatus.uncommitted > 0 &&
								` (${gitStatus.uncommitted} uncommitted)`}
						</Text>
					)}
					{repoInfo && (
						<Text color={theme.text}>
							Repo: {repoInfo.provider || 'Local'}
							{repoInfo.isGitHub && ' (GitHub)'}
							{repoInfo.hasGitHubCLI && ' ✅ CLI'}
						</Text>
					)}
				</Box>
			)}
		</Box>
	);
}
