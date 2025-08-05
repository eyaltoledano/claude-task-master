import React from 'react';
import { Box, Text } from 'ink';
import { useTaskManagementStore } from '../../stores/task-management-store.js';

export function TaskListView() {
	const { tasks, selectedIndex, scrollOffset } = useTaskManagementStore();

	// This is a simplified representation. The original has more complex rendering logic
	// for status, priority, etc. which should be moved here.
	const visibleTasks = tasks.slice(scrollOffset, scrollOffset + 15); // 15 is an example height

	return (
		<Box flexDirection="column">
			<Text>Task List</Text>
			{visibleTasks.map((task, index) => (
				<Box key={task.id}>
					<Text
						color={index === selectedIndex - scrollOffset ? 'blue' : 'white'}
					>
						{task.title}
					</Text>
				</Box>
			))}
		</Box>
	);
}
