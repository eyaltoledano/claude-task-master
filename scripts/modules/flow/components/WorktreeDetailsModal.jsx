import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import LinkTasksModal from './LinkTasksModal.jsx';
import { ClaudeWorktreeLauncherModal } from './ClaudeWorktreeLauncherModal.jsx';
import { getTheme } from '../theme.js';

export default function WorktreeDetailsModal({
	worktree,
	backend,
	onClose,
	onDelete,
	onNavigateToTask
}) {
	const [loading, setLoading] = useState(true);
	const [details, setDetails] = useState(null);
	const [linkedTasks, setLinkedTasks] = useState([]);
	const [error, setError] = useState(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [showLinkTasksModal, setShowLinkTasksModal] = useState(false);
	const [showClaudeModal, setShowClaudeModal] = useState(false);
	const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
	const [viewMode, setViewMode] = useState('details'); // 'details', 'tasks', or 'jump'
	const [scrollOffset, setScrollOffset] = useState(0);
	const theme = getTheme();

	// Constants for scrolling
	const VISIBLE_ROWS = 20;

	useEffect(() => {
		loadDetails();
	}, []);

	const loadDetails = async () => {
		setLoading(true);
		try {
			// Get worktree details
			const detailsResult = await backend.getWorktreeDetails(worktree.path);
			setDetails(detailsResult);

			// Get linked tasks
			const tasksResult = await backend.getWorktreeTasks(worktree.name);
			setLinkedTasks(tasksResult);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async () => {
		if (worktree.isCurrent) {
			setError('Cannot delete the current worktree');
			setConfirmDelete(false);
			return;
		}

		setLoading(true);
		try {
			await backend.removeWorktree(worktree.path);
			await backend.cleanupWorktreeLinks(worktree.name);
			onClose();
			if (onDelete) onDelete();
		} catch (err) {
			setError(err.message);
			setConfirmDelete(false);
		} finally {
			setLoading(false);
		}
	};

	useInput((input, key) => {
		if (key.escape) {
			if (viewMode === 'tasks' || viewMode === 'jump') {
				setViewMode('details');
			} else {
				onClose();
			}
		} else if (viewMode === 'jump') {
			// Jump mode navigation
			if (key.upArrow) {
				setSelectedTaskIndex(Math.max(0, selectedTaskIndex - 1));
			} else if (key.downArrow) {
				setSelectedTaskIndex(
					Math.min(linkedTasks.length - 1, selectedTaskIndex + 1)
				);
			} else if (key.return && linkedTasks.length > 0 && onNavigateToTask) {
				const selectedTask = linkedTasks[selectedTaskIndex];
				onNavigateToTask(selectedTask);
			}
		} else if (viewMode === 'tasks') {
			// Task list navigation
			if (key.upArrow) {
				setSelectedTaskIndex(Math.max(0, selectedTaskIndex - 1));
			} else if (key.downArrow) {
				setSelectedTaskIndex(
					Math.min(linkedTasks.length - 1, selectedTaskIndex + 1)
				);
			} else if (key.return && linkedTasks.length > 0 && onNavigateToTask) {
				const selectedTask = linkedTasks[selectedTaskIndex];
				onNavigateToTask(selectedTask);
			}
		} else if (viewMode === 'details') {
			// Details view actions with scrolling
			if (key.downArrow) {
				setScrollOffset((prev) => prev + 1);
			} else if (key.upArrow) {
				setScrollOffset((prev) => Math.max(0, prev - 1));
			} else if (key.pageDown) {
				setScrollOffset((prev) => prev + 10);
			} else if (key.pageUp) {
				setScrollOffset((prev) => Math.max(0, prev - 10));
			} else if (input === 'd' && !confirmDelete && !worktree.isCurrent) {
				setConfirmDelete(true);
			} else if (confirmDelete) {
				if (input === 'y') {
					handleDelete();
				} else if (input === 'n' || key.escape) {
					setConfirmDelete(false);
				}
			} else if (input === 't') {
				// 't' for link/manage tasks
				setShowLinkTasksModal(true);
			} else if (input === 'v' && linkedTasks.length > 0) {
				// 'v' to view linked tasks
				setViewMode('tasks');
				setSelectedTaskIndex(0);
			} else if (input === 'j' && linkedTasks.length > 0 && onNavigateToTask) {
				// 'j' to jump to a task
				setViewMode('jump');
				setSelectedTaskIndex(0);
			} else if (input === 'c' && linkedTasks.length > 0) {
				// 'c' to launch Claude
				setShowClaudeModal(true);
			}
		}
	});

	// Show link tasks modal
	if (showLinkTasksModal) {
		return (
			<LinkTasksModal
				worktree={worktree}
				backend={backend}
				onClose={() => {
					setShowLinkTasksModal(false);
					loadDetails(); // Refresh details after linking
				}}
			/>
		);
	}

	// Show Claude launcher modal
	if (showClaudeModal) {
		return (
			<Box
				flexDirection="column"
				height="100%"
				alignItems="center"
				justifyContent="center"
			>
				<ClaudeWorktreeLauncherModal
					backend={backend}
					worktree={worktree}
					tasks={linkedTasks}
					onClose={() => setShowClaudeModal(false)}
					onSuccess={(message) => {
						setShowClaudeModal(false);
						// Optionally show success message
					}}
				/>
			</Box>
		);
	}

	// Show loading state
	if (loading) {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.border}
				padding={1}
				width={80}
			>
				<LoadingSpinner message="Loading worktree details..." />
			</Box>
		);
	}

	// Show confirmation dialog
	if (confirmDelete) {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.warning}
				padding={1}
				width={60}
			>
				<Text bold color={theme.warning}>
					Delete Confirmation
				</Text>
				<Box marginTop={1}>
					<Text>
						Are you sure you want to delete worktree '{worktree.name}'?
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text dimColor>{worktree.path}</Text>
				</Box>
				<Box marginTop={2}>
					<Text>Press Y to confirm, N to cancel</Text>
				</Box>
			</Box>
		);
	}

	// Task list view
	if (viewMode === 'tasks') {
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
						Linked Tasks: {worktree.name}
					</Text>
				</Box>

				{/* Task List */}
				{linkedTasks.length === 0 ? (
					<Box paddingLeft={2}>
						<Text color={theme.muted}>No tasks linked to this worktree</Text>
					</Box>
				) : (
					<Box flexDirection="column">
						{linkedTasks.map((task, index) => (
							<Box
								key={task.id}
								backgroundColor={
									index === selectedTaskIndex
										? theme.backgroundHighlight
										: undefined
								}
								paddingLeft={1}
								paddingRight={1}
							>
								<Text
									color={
										index === selectedTaskIndex ? theme.accent : theme.text
									}
								>
									{task.parentId ? '└─ ' : '• '}
								</Text>
								<Text
									color={
										index === selectedTaskIndex ? theme.accent : theme.text
									}
								>
									{task.parentId ? `${task.id}` : `${task.id}`}
								</Text>
								<Text color={theme.muted}> │ </Text>
								<Text
									color={
										index === selectedTaskIndex ? theme.accent : theme.text
									}
								>
									{task.title.length > 50
										? task.title.substring(0, 50) + '...'
										: task.title}
								</Text>
								{task.status === 'done' && (
									<Text color={theme.success}> ✓</Text>
								)}
								{task.status === 'in-progress' && (
									<Text color={theme.warning}> ⚡</Text>
								)}
							</Box>
						))}
					</Box>
				)}

				{/* Actions */}
				<Box marginTop={2} gap={2}>
					{linkedTasks.length > 0 && onNavigateToTask && (
						<Text color={theme.muted}>[Enter] Open Task</Text>
					)}
					<Text color={theme.muted}>[↑↓] Navigate</Text>
					<Text color={theme.muted}>[Esc] Back to Details</Text>
				</Box>
			</Box>
		);
	}

	// Jump to task view
	if (viewMode === 'jump') {
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
						Jump to Task: {worktree.name}
					</Text>
				</Box>

				{/* Task List for jumping */}
				{linkedTasks.length === 0 ? (
					<Box paddingLeft={2}>
						<Text color={theme.muted}>No tasks linked to this worktree</Text>
					</Box>
				) : (
					<Box flexDirection="column">
						{linkedTasks.map((task, index) => (
							<Box
								key={task.id}
								backgroundColor={
									index === selectedTaskIndex
										? theme.backgroundHighlight
										: undefined
								}
								paddingLeft={1}
								paddingRight={1}
							>
								<Text
									color={
										index === selectedTaskIndex ? theme.accent : theme.text
									}
								>
									{index === selectedTaskIndex ? '▸ ' : '  '}
								</Text>
								<Text
									color={
										index === selectedTaskIndex ? theme.accent : theme.text
									}
								>
									{task.parentId ? `Subtask ${task.id}` : `Task ${task.id}`}
								</Text>
								<Text color={theme.muted}> - </Text>
								<Text
									color={
										index === selectedTaskIndex ? theme.accent : theme.text
									}
								>
									{task.title}
								</Text>
							</Box>
						))}
					</Box>
				)}

				{/* Actions */}
				<Box marginTop={2} gap={2}>
					{linkedTasks.length > 0 && (
						<Text color={theme.muted}>[Enter] Jump to Task</Text>
					)}
					<Text color={theme.muted}>[↑↓] Navigate</Text>
					<Text color={theme.muted}>[Esc] Cancel</Text>
				</Box>
			</Box>
		);
	}

	// Build content for scrollable details view
	const detailContent = [];

	// Basic Info
	detailContent.push({ type: 'text', content: `Path: ${worktree.path}` });
	detailContent.push({
		type: 'text',
		content: `Branch: ${worktree.isDetached ? '(detached HEAD)' : worktree.branch || 'N/A'}`,
		color: worktree.isDetached ? theme.warning : theme.text
	});
	detailContent.push({
		type: 'text',
		content: `HEAD: ${worktree.head || 'N/A'}`
	});

	// Status line
	const statusText =
		'Status: ' +
		(worktree.isCurrent ? '[CURRENT] ' : '') +
		(worktree.isLocked ? '[LOCKED] ' : '') +
		(worktree.isBare ? '[BARE] ' : '');
	detailContent.push({ type: 'text', content: statusText });

	detailContent.push({
		type: 'text',
		content: `Disk Usage: ${worktree.diskUsage || 'Unknown'}`
	});
	detailContent.push({ type: 'blank' });

	// Additional details
	if (details) {
		if (details.latestCommit) {
			detailContent.push({ type: 'header', content: 'Latest Commit:' });
			detailContent.push({
				type: 'text',
				content: `  ${details.latestCommit.hash} - ${details.latestCommit.subject}`,
				indent: 2
			});
			detailContent.push({
				type: 'text',
				content: `  by ${details.latestCommit.author} (${details.latestCommit.date})`,
				dimColor: true,
				indent: 2
			});
			detailContent.push({ type: 'blank' });
		}

		if (details.status) {
			detailContent.push({ type: 'header', content: 'Working Tree Status:' });
			if (details.status.modified > 0) {
				detailContent.push({
					type: 'text',
					content: `  Modified: ${details.status.modified}`,
					color: theme.warning,
					indent: 2
				});
			}
			if (details.status.added > 0) {
				detailContent.push({
					type: 'text',
					content: `  Added: ${details.status.added}`,
					color: theme.success,
					indent: 2
				});
			}
			if (details.status.deleted > 0) {
				detailContent.push({
					type: 'text',
					content: `  Deleted: ${details.status.deleted}`,
					color: theme.error,
					indent: 2
				});
			}
			if (details.status.untracked > 0) {
				detailContent.push({
					type: 'text',
					content: `  Untracked: ${details.status.untracked}`,
					color: theme.muted,
					indent: 2
				});
			}
			if (details.status.total === 0) {
				detailContent.push({
					type: 'text',
					content: '  Clean (no changes)',
					color: theme.success,
					indent: 2
				});
			}
			detailContent.push({ type: 'blank' });
		}

		if (details.trackingBranch) {
			detailContent.push({ type: 'header', content: 'Tracking:' });
			detailContent.push({
				type: 'text',
				content: `  ${details.trackingBranch}`,
				indent: 2
			});
			if (details.ahead > 0 || details.behind > 0) {
				let trackingStatus = '  ';
				if (details.ahead > 0) trackingStatus += `↑ ${details.ahead} ahead `;
				if (details.behind > 0) trackingStatus += `↓ ${details.behind} behind`;
				detailContent.push({
					type: 'text',
					content: trackingStatus,
					color: details.ahead > 0 ? theme.success : theme.warning,
					indent: 2
				});
			}
			detailContent.push({ type: 'blank' });
		}
	}

	// Linked Tasks - show all of them
	detailContent.push({
		type: 'header',
		content: `Linked Tasks (${linkedTasks.length}):`
	});
	if (linkedTasks.length === 0) {
		detailContent.push({
			type: 'text',
			content: '  No tasks linked to this worktree',
			color: theme.muted,
			indent: 2
		});
	} else {
		linkedTasks.forEach((task) => {
			const prefix = task.parentId ? '  └─ ' : '  • ';
			const taskType = task.parentId ? `Subtask ${task.id}` : `Task ${task.id}`;
			let line = `${prefix}${taskType}: ${task.title}`;
			if (task.status === 'done') line += ' ✓';
			if (task.status === 'in-progress') line += ' ⚡';

			detailContent.push({
				type: 'task',
				content: line,
				status: task.status,
				indent: 2
			});
		});
	}

	// Calculate visible content based on scroll offset
	const visibleContent = detailContent.slice(
		scrollOffset,
		scrollOffset + VISIBLE_ROWS
	);
	const totalLines = detailContent.length;
	const maxScroll = Math.max(0, totalLines - VISIBLE_ROWS);

	// Main render (details view)
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={theme.border}
			padding={1}
			width={80}
			height={VISIBLE_ROWS + 6} // Fixed height for scrolling
		>
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color={theme.primary}>
					Worktree Details: {worktree.name}
				</Text>
			</Box>

			{/* Scrollable content */}
			<Box flexDirection="column" height={VISIBLE_ROWS}>
				{visibleContent.map((line, index) => {
					const lineKey = `${line.type}-${scrollOffset + index}-${line.content?.substring(0, 20) || index}`;

					if (line.type === 'blank') {
						return <Box key={lineKey} height={1} />;
					} else if (line.type === 'header') {
						return (
							<Text key={lineKey} bold color={theme.primary}>
								{line.content}
							</Text>
						);
					} else if (line.type === 'task') {
						return (
							<Text
								key={lineKey}
								color={line.status === 'done' ? theme.success : theme.text}
							>
								{line.content}
							</Text>
						);
					} else {
						return (
							<Text
								key={lineKey}
								color={line.color || theme.text}
								dimColor={line.dimColor}
							>
								{line.content}
							</Text>
						);
					}
				})}
			</Box>

			{/* Scroll indicator */}
			{totalLines > VISIBLE_ROWS && (
				<Box marginTop={1}>
					<Text color={theme.muted}>
						Lines {scrollOffset + 1}-
						{Math.min(scrollOffset + VISIBLE_ROWS, totalLines)} of {totalLines}
					</Text>
				</Box>
			)}

			{/* Actions */}
			<Box marginTop={1} gap={2}>
				{totalLines > VISIBLE_ROWS && (
					<Text color={theme.muted}>[↑↓] Scroll</Text>
				)}
				{linkedTasks.length > 0 && onNavigateToTask && (
					<>
						<Text color={theme.muted}>[v] View Tasks</Text>
						<Text color={theme.muted}>[j] Jump to Task</Text>
					</>
				)}
				<Text color={theme.muted}>[t] Link/Manage Tasks</Text>
				{linkedTasks.length > 0 && (
					<Text color={theme.muted}>[c] Launch Claude</Text>
				)}
				{!worktree.isCurrent && <Text color={theme.muted}>[d] Delete</Text>}
				<Text color={theme.muted}>[Esc] Close</Text>
			</Box>

			{/* Error Message */}
			{error && (
				<Box marginTop={1}>
					<Text color="red">✗ {error}</Text>
				</Box>
			)}
		</Box>
	);
}
