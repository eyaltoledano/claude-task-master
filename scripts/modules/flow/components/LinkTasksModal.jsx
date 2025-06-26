import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { Toast } from './Toast.jsx';
import { getTheme } from '../theme.js';

// Memoized task row component to prevent unnecessary re-renders
const TaskRow = React.memo(
	({ task, isSelected, isLinked, isCurrent, parentSelected, theme }) => {
		return (
			<Box>
				<Text color={isCurrent ? theme.accent : theme.text}>
					{isCurrent ? '>' : ' '}
				</Text>
				<Text>[{isSelected || parentSelected ? '✓' : ' '}]</Text>
				<Text color={task.isSubtask ? theme.muted : theme.text}>
					{task.isSubtask ? '  └─ ' : ''}[{task.id}] {task.title}
				</Text>
				{!task.isSubtask && task.subtaskCount > 0 && (
					<Text color={theme.info}> ({task.subtaskCount} subtasks)</Text>
				)}
				{parentSelected && task.isSubtask && (
					<Text color={theme.info}> (via parent)</Text>
				)}
				{isLinked && !isSelected && !parentSelected && (
					<Text color={theme.warning}> (will unlink)</Text>
				)}
				{!isLinked && (isSelected || parentSelected) && (
					<Text color={theme.success}> (will link)</Text>
				)}
				{task.status === 'done' && <Text color={theme.success}> ✓</Text>}
			</Box>
		);
	}
);

function LinkTasksModal({ worktree, backend, onClose }) {
	const [loading, setLoading] = useState(true);
	const [tasks, setTasks] = useState([]);
	const [taskInput, setTaskInput] = useState('');
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(null);
	const [mode, setMode] = useState('browse'); // browse, input, confirm
	const [selectedTasks, setSelectedTasks] = useState(new Set());
	const [alreadyLinked, setAlreadyLinked] = useState(new Set());
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [parentTaskSubtasks, setParentTaskSubtasks] = useState(new Map()); // Map of parent ID to subtask count

	const VISIBLE_ITEMS = 15; // Number of tasks visible at once
	const theme = useMemo(() => getTheme(), []); // Cache theme

	// Memoize task lookup map for faster access
	const taskMap = useMemo(() => {
		const map = new Map();
		tasks.forEach((task) => map.set(task.id, task));
		return map;
	}, [tasks]);

	// Calculate visible tasks - memoized to prevent recalculation on every render
	const visibleTasks = useMemo(
		() => tasks.slice(scrollOffset, scrollOffset + VISIBLE_ITEMS),
		[tasks, scrollOffset, VISIBLE_ITEMS]
	);

	const handleToggleTask = useCallback(
		(taskId) => {
			const task = taskMap.get(taskId);
			if (!task) return;

			setSelectedTasks((prevSelected) => {
				const newSelected = new Set(prevSelected);

				if (newSelected.has(taskId)) {
					newSelected.delete(taskId);

					// If it's a parent task, also deselect its subtasks
					if (!task.isSubtask && task.subtaskCount > 0) {
						tasks.forEach((t) => {
							if (t.isSubtask && t.parentId === taskId) {
								newSelected.delete(t.id);
							}
						});
					}
				} else {
					newSelected.add(taskId);

					// If it's a parent task, also select its subtasks
					if (!task.isSubtask && task.subtaskCount > 0) {
						tasks.forEach((t) => {
							if (t.isSubtask && t.parentId === taskId) {
								newSelected.add(t.id);
							}
						});
					}
				}
				return newSelected;
			});
		},
		[taskMap, tasks]
	);

	useEffect(() => {
		loadTasks();
	}, []);

	const loadTasks = async () => {
		setLoading(true);
		try {
			// Get all tasks including subtasks
			const tasksResult = await backend.listTasks({ withSubtasks: true });
			const allTasks = [];
			const parentSubtaskMap = new Map();

			// Get already linked tasks
			const linkedTasksResult = await backend.getWorktreeTasks(worktree.name);
			// Ensure all IDs are strings for consistent comparison
			const linkedIds = new Set(linkedTasksResult.map((t) => String(t.id)));
			setAlreadyLinked(linkedIds);

			// Flatten tasks and subtasks into a single list
			tasksResult.tasks.forEach((task) => {
				// Count subtasks for parent tasks
				if (task.subtasks && task.subtasks.length > 0) {
					parentSubtaskMap.set(task.id.toString(), task.subtasks.length);
				}

				allTasks.push({
					id: task.id.toString(),
					title: task.title,
					status: task.status,
					isSubtask: false,
					subtaskCount: task.subtasks ? task.subtasks.length : 0
				});

				if (task.subtasks && task.subtasks.length > 0) {
					task.subtasks.forEach((subtask) => {
						allTasks.push({
							id: `${task.id}.${subtask.id}`,
							title: subtask.title,
							status: subtask.status,
							isSubtask: true,
							parentId: task.id.toString(),
							parentTitle: task.title
						});
					});
				}
			});

			setTasks(allTasks);
			setParentTaskSubtasks(parentSubtaskMap);
			// Pre-select already linked tasks
			setSelectedTasks(new Set(linkedIds));
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const handleConfirm = async () => {
		setLoading(true);
		setError(null);

		try {
			// Find tasks to link (selected but not already linked)
			const tasksToLink = Array.from(selectedTasks).filter(
				(id) => !alreadyLinked.has(id)
			);

			// Find tasks to unlink (already linked but not selected)
			const tasksToUnlink = Array.from(alreadyLinked).filter(
				(id) => !selectedTasks.has(id)
			);

			// Link new tasks (backend will automatically include subtasks for parent tasks)
			if (tasksToLink.length > 0) {
				const linkResult = await backend.linkWorktreeToTasks(
					worktree.name,
					tasksToLink,
					{ includeSubtasks: true }
				);
				if (!linkResult.success) {
					setError(linkResult.error);
					return;
				}
			}

			// Unlink removed tasks
			for (const taskId of tasksToUnlink) {
				const unlinkResult = await backend.unlinkWorktreeTask(
					worktree.name,
					taskId
				);
				if (!unlinkResult.success) {
					setError(unlinkResult.error);
					return;
				}
			}

			const linkedCount = tasksToLink.length;
			const unlinkedCount = tasksToUnlink.length;

			if (linkedCount > 0 && unlinkedCount > 0) {
				setSuccess(`Linked ${linkedCount} and unlinked ${unlinkedCount} tasks`);
			} else if (linkedCount > 0) {
				setSuccess(
					`Successfully linked ${linkedCount} task${linkedCount > 1 ? 's' : ''}`
				);
			} else if (unlinkedCount > 0) {
				setSuccess(
					`Successfully unlinked ${unlinkedCount} task${unlinkedCount > 1 ? 's' : ''}`
				);
			} else {
				setSuccess('No changes made');
			}

			setTimeout(() => {
				onClose();
			}, 1500);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	useInput((input, key) => {
		if (key.escape) {
			onClose();
		} else if (mode === 'browse') {
			if (key.upArrow) {
				setSelectedIndex((prevIndex) => {
					const newIndex = Math.max(0, prevIndex - 1);
					// Adjust scroll if needed
					if (newIndex < scrollOffset) {
						setScrollOffset(newIndex);
					}
					return newIndex;
				});
			} else if (key.downArrow) {
				setSelectedIndex((prevIndex) => {
					const newIndex = Math.min(tasks.length - 1, prevIndex + 1);
					// Adjust scroll if needed
					if (newIndex >= scrollOffset + VISIBLE_ITEMS) {
						setScrollOffset(newIndex - VISIBLE_ITEMS + 1);
					}
					return newIndex;
				});
			} else if (input === ' ' && tasks[selectedIndex]) {
				// Toggle selection with space
				handleToggleTask(tasks[selectedIndex].id);
			} else if (input === 'a') {
				// Select all
				setSelectedTasks(new Set(tasks.map((t) => t.id)));
			} else if (input === 'n') {
				// Select none
				setSelectedTasks(new Set());
			} else if (input === 'i') {
				// Switch to input mode
				setMode('input');
			} else if (key.return) {
				// Confirm selection
				setMode('confirm');
			}
		} else if (mode === 'input') {
			if (key.return && taskInput.trim()) {
				// Parse input and toggle tasks
				const ids = taskInput.split(/[,\s]+/).filter((id) => id);
				ids.forEach((id) => {
					if (taskMap.has(id)) {
						handleToggleTask(id);
					}
				});
				setTaskInput('');
				setMode('browse');
			} else if (key.escape) {
				setTaskInput('');
				setMode('browse');
			}
		} else if (mode === 'confirm') {
			if (input === 'y') {
				handleConfirm();
			} else if (input === 'n' || key.escape) {
				setMode('browse');
			}
		}
	});

	// Loading state
	if (loading) {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.border}
				padding={1}
				width={80}
			>
				<LoadingSpinner message="Loading tasks..." />
			</Box>
		);
	}

	// Confirmation dialog
	if (mode === 'confirm') {
		const toLink = Array.from(selectedTasks).filter(
			(id) => !alreadyLinked.has(id)
		).length;
		const toUnlink = Array.from(alreadyLinked).filter(
			(id) => !selectedTasks.has(id)
		).length;

		// Count how many subtasks will be automatically included
		let autoIncludedSubtasks = 0;
		const selectedParentTasks = Array.from(selectedTasks).filter((id) => {
			const task = taskMap.get(id);
			return task && !task.isSubtask && task.subtaskCount > 0;
		});

		selectedParentTasks.forEach((parentId) => {
			const subtaskCount = parentTaskSubtasks.get(parentId) || 0;
			autoIncludedSubtasks += subtaskCount;
		});

		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.warning}
				padding={1}
				width={60}
			>
				<Text bold color={theme.warning}>
					Confirm Task Changes
				</Text>
				<Box marginTop={1} flexDirection="column">
					{toLink > 0 && (
						<Text>
							• Link {toLink} new task{toLink > 1 ? 's' : ''}
						</Text>
					)}
					{autoIncludedSubtasks > 0 && (
						<Text color={theme.info}>
							(includes {autoIncludedSubtasks} subtask
							{autoIncludedSubtasks > 1 ? 's' : ''} automatically)
						</Text>
					)}
					{toUnlink > 0 && (
						<Text>
							• Unlink {toUnlink} task{toUnlink > 1 ? 's' : ''}
						</Text>
					)}
					{toLink === 0 && toUnlink === 0 && (
						<Text color={theme.muted}>No changes to make</Text>
					)}
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
			borderColor={theme.border}
			padding={1}
			width={80}
			height={VISIBLE_ITEMS + 12}
		>
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color={theme.primary}>
					Link Tasks to Worktree: {worktree.name}
				</Text>
			</Box>

			{/* Instructions */}
			<Box marginBottom={1}>
				<Text color={theme.muted}>
					{mode === 'input'
						? 'Enter task IDs separated by commas or spaces:'
						: 'Use ↑↓ to navigate, SPACE to toggle, ENTER to confirm'}
				</Text>
			</Box>

			{/* Note about subtasks */}
			<Box marginBottom={1}>
				<Text color={theme.info}>
					Note: Selecting a parent task automatically includes all its subtasks
				</Text>
			</Box>

			{/* Task list or input */}
			{mode === 'input' ? (
				<Box marginBottom={1}>
					<Text>Task IDs: </Text>
					<TextInput
						value={taskInput}
						onChange={setTaskInput}
						placeholder="e.g., 1 2.1 3"
					/>
				</Box>
			) : (
				<Box flexDirection="column" marginBottom={1}>
					{/* Scroll indicator */}
					{scrollOffset > 0 && (
						<Text color={theme.muted}>↑ {scrollOffset} more above</Text>
					)}

					{/* Task list */}
					{visibleTasks.map((task, index) => {
						const actualIndex = scrollOffset + index;
						const isSelected = selectedTasks.has(task.id);
						const isLinked = alreadyLinked.has(task.id);
						const isCurrent = actualIndex === selectedIndex;
						const parentSelected =
							task.isSubtask && selectedTasks.has(task.parentId);

						return (
							<TaskRow
								key={task.id}
								task={task}
								isSelected={isSelected}
								isLinked={isLinked}
								isCurrent={isCurrent}
								parentSelected={parentSelected}
								theme={theme}
							/>
						);
					})}

					{/* Scroll indicator */}
					{scrollOffset + VISIBLE_ITEMS < tasks.length && (
						<Text color={theme.muted}>
							↓ {tasks.length - scrollOffset - VISIBLE_ITEMS} more below
						</Text>
					)}
				</Box>
			)}

			{/* Summary */}
			<Box gap={2} marginBottom={1}>
				<Text>
					Selected: {selectedTasks.size}/{tasks.length}
				</Text>
				<Text color={theme.success}>
					To link:{' '}
					{
						Array.from(selectedTasks).filter((id) => !alreadyLinked.has(id))
							.length
					}
				</Text>
				<Text color={theme.warning}>
					To unlink:{' '}
					{
						Array.from(alreadyLinked).filter((id) => !selectedTasks.has(id))
							.length
					}
				</Text>
			</Box>

			{/* Actions */}
			<Box gap={2}>
				{mode === 'browse' && (
					<>
						<Text color={theme.muted}>[SPACE] Toggle</Text>
						<Text color={theme.muted}>[a] All</Text>
						<Text color={theme.muted}>[n] None</Text>
						<Text color={theme.muted}>[i] Input IDs</Text>
						<Text color={theme.muted}>[ENTER] Confirm</Text>
					</>
				)}
				<Text color={theme.muted}>[ESC] Cancel</Text>
			</Box>

			{/* Success/Error messages */}
			{success && <Toast type="success" message={success} />}
			{error && <Toast type="error" message={error} />}
		</Box>
	);
}

export default LinkTasksModal;
