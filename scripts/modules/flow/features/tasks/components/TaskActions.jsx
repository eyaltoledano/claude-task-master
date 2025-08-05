import React from 'react';
import { Box, Text } from 'ink';
import {
	useComponentTheme,
	useTerminalSize,
	useKeypress,
	usePhraseCycler,
	PhraseCollections
} from '../../../shared/hooks/index.js';

export function TaskActions({
	selectedTask,
	selectedSubtask,
	viewMode,
	isExpanding,
	onExpandTask,
	onCycleStatus,
	onLaunchClaude,
	onWorkOnSubtask,
	onViewClaudeSessions,
	onGoToWorktree,
	taskWorktrees = [],
	subtaskWorktrees = new Map()
}) {
	const { theme } = useComponentTheme('taskActions');
	const { isNarrow } = useTerminalSize();

	// Loading phrases during expansion
	const { currentPhrase } = usePhraseCycler(PhraseCollections.ai, {
		interval: 2000,
		paused: !isExpanding
	});

	// Action keyboard shortcuts
	useKeypress(
		{
			e: () => {
				if (selectedTask && onExpandTask) {
					onExpandTask();
				}
			},
			t: () => {
				if (viewMode === 'subtasks' && selectedSubtask && onCycleStatus) {
					const subtaskId = `${selectedTask.id}.${selectedSubtask.id}`;
					onCycleStatus({ ...selectedSubtask, id: subtaskId });
				} else if (selectedTask && onCycleStatus) {
					onCycleStatus(selectedTask);
				}
			},
			w: () => {
				if (
					viewMode === 'subtask-detail' &&
					selectedSubtask &&
					onWorkOnSubtask
				) {
					onWorkOnSubtask();
				}
			},
			c: () => {
				if (selectedSubtask && onLaunchClaude) {
					onLaunchClaude();
				}
			},
			v: () => {
				if (selectedSubtask && onViewClaudeSessions) {
					onViewClaudeSessions();
				}
			},
			g: () => {
				if (selectedSubtask && onGoToWorktree) {
					onGoToWorktree();
				}
			}
		},
		{
			isActive: !isExpanding && viewMode !== 'list' && !isNarrow
		}
	);

	const renderTaskActions = () => {
		if (!selectedTask) return null;

		const actions = [];

		// Expand action
		if (selectedTask) {
			actions.push({
				key: 'e',
				label: 'Expand',
				description: 'Generate subtasks',
				available: true
			});
		}

		// Status toggle action
		actions.push({
			key: 't',
			label: 'Toggle Status',
			description: `Change from ${selectedTask.status}`,
			available: true
		});

		return (
			<Box flexDirection="column" marginTop={1}>
				<Text color={theme.text.primary} bold>
					Actions:
				</Text>
				{actions.map((action) => (
					<Box key={action.key}>
						<Text color={action.available ? theme.accent : theme.text.disabled}>
							[{action.key}] {action.label}
						</Text>
						{!isNarrow && (
							<Text color={theme.text.secondary}> - {action.description}</Text>
						)}
					</Box>
				))}
			</Box>
		);
	};

	const renderSubtaskActions = () => {
		if (!selectedSubtask || viewMode !== 'subtask-detail') return null;

		const subtaskId = `${selectedTask.id}.${selectedSubtask.id}`;
		const worktrees = subtaskWorktrees.get(subtaskId) || [];
		const hasClaudeSessions =
			extractClaudeSessionIds(selectedSubtask.details).length > 0;

		const actions = [
			{
				key: 'w',
				label: 'Work On',
				description: 'Create worktree & launch Claude',
				available: true
			},
			{
				key: 'c',
				label: 'Claude Session',
				description: 'Launch Claude Code',
				available: true
			},
			{
				key: 'v',
				label: 'View Sessions',
				description: 'View Claude Code sessions',
				available: hasClaudeSessions
			},
			{
				key: 'g',
				label: 'Go to Worktree',
				description: 'Navigate to worktree',
				available: worktrees.length > 0
			},
			{
				key: 't',
				label: 'Toggle Status',
				description: `Change from ${selectedSubtask.status}`,
				available: true
			}
		];

		return (
			<Box flexDirection="column" marginTop={1}>
				<Text color={theme.text.primary} bold>
					Subtask Actions:
				</Text>
				{actions.map((action) => (
					<Box key={action.key}>
						<Text color={action.available ? theme.accent : theme.text.disabled}>
							[{action.key}] {action.label}
						</Text>
						{!isNarrow && (
							<Text color={theme.text.secondary}> - {action.description}</Text>
						)}
					</Box>
				))}
			</Box>
		);
	};

	const renderExpandingStatus = () => {
		if (!isExpanding) return null;

		return (
			<Box flexDirection="column" marginTop={1} paddingX={1}>
				<Box>
					<Text color={theme.accent}>⚡ </Text>
					<Text color={theme.text.primary}>{currentPhrase}</Text>
				</Box>
				<Text color={theme.text.secondary} dimColor>
					Press Ctrl+X to cancel
				</Text>
			</Box>
		);
	};

	const renderWorktreeInfo = () => {
		if (viewMode === 'detail' && taskWorktrees.length > 0) {
			return (
				<Box flexDirection="column" marginTop={1}>
					<Text color={theme.text.primary} bold>
						Linked Worktrees:
					</Text>
					{taskWorktrees.slice(0, 3).map((worktree) => (
						<Text key={worktree.id} color={theme.text.secondary}>
							• {worktree.name} ({worktree.branch})
						</Text>
					))}
					{taskWorktrees.length > 3 && (
						<Text color={theme.text.tertiary}>
							... and {taskWorktrees.length - 3} more
						</Text>
					)}
				</Box>
			);
		}

		if (viewMode === 'subtask-detail' && selectedSubtask) {
			const subtaskId = `${selectedTask.id}.${selectedSubtask.id}`;
			const worktrees = subtaskWorktrees.get(subtaskId) || [];

			if (worktrees.length > 0) {
				return (
					<Box flexDirection="column" marginTop={1}>
						<Text color={theme.text.primary} bold>
							Linked Worktrees:
						</Text>
						{worktrees.slice(0, 3).map((worktree) => (
							<Text key={worktree.id} color={theme.text.secondary}>
								• {worktree.name} ({worktree.branch})
							</Text>
						))}
						{worktrees.length > 3 && (
							<Text color={theme.text.tertiary}>
								... and {worktrees.length - 3} more
							</Text>
						)}
					</Box>
				);
			}
		}

		return null;
	};

	const renderNavigationHelp = () => {
		if (isNarrow) return null; // Skip in narrow terminals to save space

		const helpItems = [];

		if (viewMode === 'detail') {
			helpItems.push('[s] Subtasks', '[Esc] Back to list');
		} else if (viewMode === 'subtasks') {
			helpItems.push('[Enter] View subtask', '[Esc] Back to detail');
		} else if (viewMode === 'subtask-detail') {
			helpItems.push('[Esc] Back to subtasks');
		}

		if (helpItems.length === 0) return null;

		return (
			<Box marginTop={1}>
				<Text color={theme.text.tertiary}>{helpItems.join(' | ')}</Text>
			</Box>
		);
	};

	return (
		<Box flexDirection="column">
			{renderExpandingStatus()}
			{renderTaskActions()}
			{renderSubtaskActions()}
			{renderWorktreeInfo()}
			{renderNavigationHelp()}
		</Box>
	);
}

// Helper function to extract Claude session IDs from details
function extractClaudeSessionIds(details) {
	if (!details) return [];

	const sessionIds = [];
	const sessionRegex = /Session ID: ([a-f0-9-]+)/gi;
	let match = sessionRegex.exec(details);

	while (match !== null) {
		sessionIds.push(match[1]);
		match = sessionRegex.exec(details);
	}

	return sessionIds;
}
