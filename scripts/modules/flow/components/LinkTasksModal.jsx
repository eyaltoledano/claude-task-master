import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getTheme } from '../theme.js';

export default function LinkTasksModal({
	worktreeName,
	availableTasks,
	onSubmit,
	onCancel
}) {
	const [taskIds, setTaskIds] = useState('');
	const [error, setError] = useState('');
	const theme = getTheme();

	useInput((input, key) => {
		if (key.escape) {
			onCancel();
		} else if (key.return && taskIds.trim()) {
			handleSubmit();
		}
	});

	const handleSubmit = () => {
		const ids = taskIds
			.trim()
			.split(/[,\s]+/)
			.filter((id) => id);

		// Validate task IDs
		const invalidIds = [];
		const validIds = [];

		for (const id of ids) {
			// Check if it's a valid task or subtask ID format
			if (!/^\d+(\.\d+)?$/.test(id)) {
				invalidIds.push(id);
			} else {
				// Check if task exists
				const taskExists = availableTasks.some((task) => {
					if (task.id.toString() === id) return true;
					if (task.subtasks) {
						return task.subtasks.some((st) => `${task.id}.${st.id}` === id);
					}
					return false;
				});

				if (taskExists) {
					validIds.push(id);
				} else {
					invalidIds.push(id);
				}
			}
		}

		if (invalidIds.length > 0) {
			setError(`Invalid or non-existent task IDs: ${invalidIds.join(', ')}`);
			return;
		}

		if (validIds.length === 0) {
			setError('Please enter at least one valid task ID');
			return;
		}

		onSubmit(validIds);
	};

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={theme.border}
			padding={1}
			width={60}
		>
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color={theme.primary}>
					Link Tasks to Worktree: {worktreeName}
				</Text>
			</Box>

			{/* Instructions */}
			<Box marginBottom={1}>
				<Text color={theme.muted}>
					Enter task IDs to link (comma or space separated)
				</Text>
				<Text color={theme.muted}>Examples: 1, 2.3, 15, 15.2</Text>
			</Box>

			{/* Input */}
			<Box marginBottom={1}>
				<Text>Task IDs: </Text>
				<TextInput
					value={taskIds}
					onChange={setTaskIds}
					placeholder="e.g., 1, 2.3, 15"
				/>
			</Box>

			{/* Error message */}
			{error && (
				<Box marginBottom={1}>
					<Text color={theme.error}>{error}</Text>
				</Box>
			)}

			{/* Available tasks preview */}
			<Box flexDirection="column" marginBottom={1}>
				<Text color={theme.muted}>Available tasks:</Text>
				<Box paddingLeft={2} flexDirection="column" height={10}>
					{availableTasks.slice(0, 8).map((task) => (
						<Text key={task.id} color={theme.textDim}>
							{task.id}: {task.title}
							{task.status === 'done' && <Text color={theme.success}> ✓</Text>}
						</Text>
					))}
					{availableTasks.length > 8 && (
						<Text color={theme.muted}>
							... and {availableTasks.length - 8} more
						</Text>
					)}
				</Box>
			</Box>

			{/* Actions */}
			<Box gap={2}>
				<Text color={theme.muted}>[Enter] Link Tasks</Text>
				<Text color={theme.muted}>[Esc] Cancel</Text>
			</Box>
		</Box>
	);
}
