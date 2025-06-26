import React from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '../theme.js';

export default function WorktreeDetailsModal({
	worktree,
	linkedTasks = [],
	onClose,
	onRemove,
	onToggleLock,
	onLinkTasks
}) {
	const theme = getTheme();

	useInput((input, key) => {
		if (key.escape || input === 'q') {
			onClose();
		} else if (input === 'd' && !worktree.isCurrent) {
			onRemove();
		} else if (input === 'l') {
			onToggleLock();
		} else if (input === 't' && onLinkTasks) {
			onLinkTasks();
		}
	});

	const formatDate = (dateStr) => {
		if (!dateStr) return 'N/A';
		const date = new Date(dateStr);
		return date.toLocaleString();
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
					<Text color={worktree.isDetached ? theme.warning : theme.text}>
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
							<Text color={theme.success}>[CURRENT] </Text>
						)}
						{worktree.isLocked && <Text color={theme.warning}>[LOCKED] </Text>}
						{worktree.isBare && <Text>[BARE] </Text>}
					</Text>
				</Box>
				<Box>
					<Text bold>Disk Usage: </Text>
					<Text>{worktree.diskUsage || 'Unknown'}</Text>
				</Box>
			</Box>

			{/* Linked Tasks */}
			<Box flexDirection="column" marginBottom={1}>
				<Text bold color={theme.primary}>
					Linked Tasks ({linkedTasks.length}):
				</Text>
				{linkedTasks.length === 0 ? (
					<Box paddingLeft={2}>
						<Text color={theme.muted}>No tasks linked to this worktree</Text>
					</Box>
				) : (
					<Box paddingLeft={2} flexDirection="column">
						{linkedTasks.slice(0, 5).map((task, index) => (
							<Box key={task.id}>
								<Text color={theme.accent}>{task.parentId ? '└─ ' : '• '}</Text>
								<Text>
									{task.parentId ? `Subtask ${task.id}` : `Task ${task.id}`}:{' '}
									{task.title}
								</Text>
								{task.status === 'done' && (
									<Text color={theme.success}> ✓</Text>
								)}
							</Box>
						))}
						{linkedTasks.length > 5 && (
							<Text color={theme.muted}>
								... and {linkedTasks.length - 5} more
							</Text>
						)}
					</Box>
				)}
			</Box>

			{/* Latest Commit */}
			{worktree.latestCommit && (
				<Box flexDirection="column" marginBottom={1}>
					<Text bold color={theme.primary}>
						Latest Commit:
					</Text>
					<Box paddingLeft={2} flexDirection="column">
						<Box>
							<Text bold>Hash: </Text>
							<Text>{worktree.latestCommit.hash}</Text>
						</Box>
						<Box>
							<Text bold>Author: </Text>
							<Text>
								{worktree.latestCommit.author} ({worktree.latestCommit.email})
							</Text>
						</Box>
						<Box>
							<Text bold>Date: </Text>
							<Text>{formatDate(worktree.latestCommit.date)}</Text>
						</Box>
						<Box>
							<Text bold>Message: </Text>
							<Text>{worktree.latestCommit.subject}</Text>
						</Box>
					</Box>
				</Box>
			)}

			{/* Working Tree Status */}
			{worktree.status && (
				<Box flexDirection="column" marginBottom={1}>
					<Text bold color={theme.primary}>
						Working Tree Status:
					</Text>
					<Box paddingLeft={2} gap={2}>
						{worktree.status.modified > 0 && (
							<Text color={theme.warning}>
								Modified: {worktree.status.modified}
							</Text>
						)}
						{worktree.status.added > 0 && (
							<Text color={theme.success}>Added: {worktree.status.added}</Text>
						)}
						{worktree.status.deleted > 0 && (
							<Text color={theme.error}>
								Deleted: {worktree.status.deleted}
							</Text>
						)}
						{worktree.status.untracked > 0 && (
							<Text color={theme.muted}>
								Untracked: {worktree.status.untracked}
							</Text>
						)}
						{worktree.status.total === 0 && (
							<Text color={theme.success}>Clean (no changes)</Text>
						)}
					</Box>
				</Box>
			)}

			{/* Tracking Info */}
			{worktree.trackingBranch && (
				<Box flexDirection="column" marginBottom={1}>
					<Text bold color={theme.primary}>
						Tracking:
					</Text>
					<Box paddingLeft={2} flexDirection="column">
						<Box>
							<Text bold>Remote Branch: </Text>
							<Text>{worktree.trackingBranch}</Text>
						</Box>
						{(worktree.ahead > 0 || worktree.behind > 0) && (
							<Box gap={2}>
								{worktree.ahead > 0 && (
									<Text color={theme.success}>↑ {worktree.ahead} ahead</Text>
								)}
								{worktree.behind > 0 && (
									<Text color={theme.warning}>↓ {worktree.behind} behind</Text>
								)}
							</Box>
						)}
					</Box>
				</Box>
			)}

			{/* Actions */}
			<Box marginTop={1} gap={2}>
				<Text color={theme.muted}>[t] Link Tasks</Text>
				{!worktree.isCurrent && <Text color={theme.muted}>[d] Delete</Text>}
				<Text color={theme.muted}>
					[l] {worktree.isLocked ? 'Unlock' : 'Lock'}
				</Text>
				<Text color={theme.muted}>[q/Esc] Close</Text>
			</Box>
		</Box>
	);
}
