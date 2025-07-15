import React, { memo, useMemo } from 'react';
import { Box, Text } from 'ink';
import {
	useComponentTheme,
	useTerminalSize,
	useStateAndRef
} from '../../../shared/hooks/index.js';
import { useRenderTracking } from '../../../shared/hooks/usePerformance.js';
import { OptimizedList, ListItem } from '../../../shared/components/optimized/index.js';

export const TaskList = memo(({
	tasks,
	selectedIndex,
	onSelectTask,
	onExpandTask,
	expandedTasks,
	scrollOffset,
	visibleRows = 15,
	compact = false
}) => {
	// Performance tracking
	const trackRender = useRenderTracking('TaskList');
	trackRender({ tasks: tasks.length, selectedIndex });

	// Component-specific theming
	const { theme, getThemedProps } = useComponentTheme('taskList');
	const { maxContentWidth, isNarrow } = useTerminalSize();

	// Performance optimization for large lists
	const [visibleTasks, setVisibleTasks, visibleTasksRef] = useStateAndRef([]);

	React.useEffect(() => {
		// Build flat list of visible tasks (including expanded subtasks)
		const flatTasks = [];
		tasks.forEach((task) => {
			flatTasks.push({ ...task, level: 0 });
			if (expandedTasks.has(task.id) && task.subtasks) {
				task.subtasks.forEach((subtask) => {
					flatTasks.push({ ...subtask, level: 1, parentId: task.id });
				});
			}
		});

		// Virtual scrolling logic for large task lists
		const startIndex = Math.max(0, scrollOffset);
		const endIndex = Math.min(flatTasks.length, scrollOffset + visibleRows + 5); // Add buffer
		setVisibleTasks(flatTasks.slice(startIndex, endIndex));
	}, [tasks, expandedTasks, scrollOffset, visibleRows, setVisibleTasks]);

	const renderTaskItem = (task, index, isSelected) => {
		const actualIndex = scrollOffset + index;
		const statusColor = getStatusColor(task.status);
		const priorityColor = getPriorityColor(task.priority);
		const isSubtask = task.level === 1;

		return (
			<Box
				key={`${task.id}-${task.level || 0}`}
				{...getThemedProps({
					backgroundColor: isSelected
						? theme.item.selected
						: theme.item.background,
					paddingLeft: isSubtask ? 2 : 0
				})}
				width={maxContentWidth}
			>
				{/* Selection indicator */}
				<Text color={isSelected ? theme.accent : 'transparent'}>
					{isSelected ? '▶ ' : '  '}
				</Text>

				{/* Task status and expansion indicator */}
				<Text color={statusColor}>
					{isSubtask
						? '  '
						: expandedTasks.has(task.id) && task.subtasks?.length
							? '▼ '
							: task.subtasks?.length
								? '▶ '
								: '  '}
					{getStatusSymbol(task.status)}
				</Text>

				{/* Task ID */}
				<Text color={theme.text.secondary} dimColor>
					{isSubtask ? ` ${task.parentId}.${task.id}` : ` ${task.id}`}
				</Text>

				{/* Task title */}
				<Text color={isSelected ? theme.text.inverse : theme.text.primary}>
					{' '}
					{task.title}
				</Text>

				{/* Priority indicator (if not narrow) */}
				{!isNarrow &&
					!compact &&
					task.priority &&
					task.priority !== 'medium' && (
						<Text color={priorityColor}> ({task.priority})</Text>
					)}

				{/* Subtask count (if not narrow and not compact) */}
				{!isNarrow && !compact && !isSubtask && task.subtasks?.length > 0 && (
					<Text color={theme.text.secondary}>
						{' '}
						[{task.subtasks.length} subtasks]
					</Text>
				)}
			</Box>
		);
	};

	const handleTaskClick = (task, index) => {
		const actualIndex = scrollOffset + index;
		if (onSelectTask) {
			onSelectTask(task, actualIndex);
		}

		// Handle expansion for parent tasks
		if (task.level === 0 && task.subtasks?.length > 0 && onExpandTask) {
			onExpandTask(task.id);
		}
	};

	if (!visibleTasks.length) {
		return (
			<Box justifyContent="center" width={maxContentWidth}>
				<Text color={theme.text.secondary}>No tasks found</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" width={maxContentWidth}>
			{visibleTasks.map((task, index) => {
				const actualIndex = scrollOffset + index;
				const isSelected = actualIndex === selectedIndex;

				return (
					<Box key={`${task.id}-${task.level || 0}`}>
						{renderTaskItem(task, index, isSelected)}
					</Box>
				);
			})}
		</Box>
	);
});

TaskList.displayName = 'TaskList';

function getStatusSymbol(status) {
	const symbols = {
		done: '✅',
		'in-progress': '⏳',
		pending: '⏱️',
		blocked: '❌',
		deferred: '⏸️',
		review: '👀',
		cancelled: '🚫'
	};
	return symbols[status] || '•';
}

function getStatusColor(status) {
	const colors = {
		done: 'green',
		'in-progress': 'blue',
		pending: 'yellow',
		blocked: 'red',
		deferred: 'gray',
		review: 'cyan',
		cancelled: 'gray'
	};
	return colors[status] || 'white';
}

function getPriorityColor(priority) {
	const colors = {
		high: 'red',
		medium: 'yellow',
		low: 'green'
	};
	return colors[priority] || 'white';
}
