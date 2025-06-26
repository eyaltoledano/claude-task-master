import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import LinkTasksModal from './LinkTasksModal.jsx';
import { getTheme } from '../theme.js';

export default function WorktreeDetailsModal({
	worktree,
	backend,
	onClose,
	onDelete
}) {
	const [loading, setLoading] = useState(true);
	const [details, setDetails] = useState(null);
	const [linkedTasks, setLinkedTasks] = useState([]);
	const [error, setError] = useState(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [showLinkTasksModal, setShowLinkTasksModal] = useState(false);

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
			onClose();
		} else if (input === 'd' && !confirmDelete && !worktree.isCurrent) {
			setConfirmDelete(true);
		} else if (confirmDelete) {
			if (input === 'y') {
				handleDelete();
			} else if (input === 'n' || key.escape) {
				setConfirmDelete(false);
			}
		} else if (input === 't' || input === 'm') {
			// 't' for link tasks, 'm' for manage tasks
			setShowLinkTasksModal(true);
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

	// Show loading state
	if (loading) {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={getTheme().border}
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
				borderColor={getTheme().warning}
				padding={1}
				width={60}
			>
				<Text bold color={getTheme().warning}>
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

	// Main render
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={getTheme().border}
			padding={1}
			width={80}
		>
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color={getTheme().primary}>
					Worktree Details: {worktree.name}
				</Text>
			</Box>

			{/* Basic Info */}
			<Box flexDirection="column" marginBottom={1}>
				<Box>
					<Text bold>Path: </Text>
					<Text>{worktree.path}</Text>
				</Box>
				<Box>
					<Text bold>Branch: </Text>
					<Text
						color={worktree.isDetached ? getTheme().warning : getTheme().text}
					>
						{worktree.isDetached ? '(detached HEAD)' : worktree.branch || 'N/A'}
					</Text>
				</Box>
				<Box>
					<Text bold>HEAD: </Text>
					<Text>{worktree.head || 'N/A'}</Text>
				</Box>
				<Box>
					<Text bold>Status: </Text>
					<Text>
						{worktree.isCurrent && (
							<Text color={getTheme().success}>[CURRENT] </Text>
						)}
						{worktree.isLocked && (
							<Text color={getTheme().warning}>[LOCKED] </Text>
						)}
						{worktree.isBare && <Text>[BARE] </Text>}
					</Text>
				</Box>
				<Box>
					<Text bold>Disk Usage: </Text>
					<Text>{worktree.diskUsage || 'Unknown'}</Text>
				</Box>
			</Box>

			{/* Additional details from backend call */}
			{details && (
				<>
					{details.latestCommit && (
						<Box flexDirection="column" marginBottom={1}>
							<Text bold color={getTheme().primary}>
								Latest Commit:
							</Text>
							<Box paddingLeft={2} flexDirection="column">
								<Text>
									{details.latestCommit.hash} - {details.latestCommit.subject}
								</Text>
								<Text dimColor>
									by {details.latestCommit.author} ({details.latestCommit.date})
								</Text>
							</Box>
						</Box>
					)}

					{details.status && (
						<Box flexDirection="column" marginBottom={1}>
							<Text bold color={getTheme().primary}>
								Working Tree Status:
							</Text>
							<Box paddingLeft={2} gap={2}>
								{details.status.modified > 0 && (
									<Text color={getTheme().warning}>
										Modified: {details.status.modified}
									</Text>
								)}
								{details.status.added > 0 && (
									<Text color={getTheme().success}>
										Added: {details.status.added}
									</Text>
								)}
								{details.status.deleted > 0 && (
									<Text color={getTheme().error}>
										Deleted: {details.status.deleted}
									</Text>
								)}
								{details.status.untracked > 0 && (
									<Text color={getTheme().muted}>
										Untracked: {details.status.untracked}
									</Text>
								)}
								{details.status.total === 0 && (
									<Text color={getTheme().success}>Clean (no changes)</Text>
								)}
							</Box>
						</Box>
					)}

					{details.trackingBranch && (
						<Box flexDirection="column" marginBottom={1}>
							<Text bold color={getTheme().primary}>
								Tracking:
							</Text>
							<Box paddingLeft={2}>
								<Text>{details.trackingBranch}</Text>
								{(details.ahead > 0 || details.behind > 0) && (
									<Box gap={2}>
										{details.ahead > 0 && (
											<Text color={getTheme().success}>
												↑ {details.ahead} ahead
											</Text>
										)}
										{details.behind > 0 && (
											<Text color={getTheme().warning}>
												↓ {details.behind} behind
											</Text>
										)}
									</Box>
								)}
							</Box>
						</Box>
					)}
				</>
			)}

			{/* Linked Tasks */}
			<Box flexDirection="column" marginBottom={1}>
				<Text bold color={getTheme().primary}>
					Linked Tasks ({linkedTasks.length}):
				</Text>
				{linkedTasks.length === 0 ? (
					<Box paddingLeft={2}>
						<Text color={getTheme().muted}>
							No tasks linked to this worktree
						</Text>
					</Box>
				) : (
					<Box paddingLeft={2} flexDirection="column">
						{linkedTasks.slice(0, 5).map((task) => (
							<Box key={task.id}>
								<Text color={getTheme().accent}>
									{task.parentId ? '└─ ' : '• '}
								</Text>
								<Text>
									{task.parentId ? `Subtask ${task.id}` : `Task ${task.id}`}:{' '}
									{task.title}
								</Text>
								{task.status === 'done' && (
									<Text color={getTheme().success}> ✓</Text>
								)}
							</Box>
						))}
						{linkedTasks.length > 5 && (
							<Text color={getTheme().muted}>
								... and {linkedTasks.length - 5} more
							</Text>
						)}
					</Box>
				)}
			</Box>

			{/* Actions */}
			<Box marginTop={1} gap={2}>
				<Text color={getTheme().muted}>[t/m] Manage Tasks</Text>
				{!worktree.isCurrent && (
					<Text color={getTheme().muted}>[d] Delete</Text>
				)}
				<Text color={getTheme().muted}>[Esc] Close</Text>
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
