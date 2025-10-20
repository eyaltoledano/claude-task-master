import React from 'react';
import { Box, Text } from 'ink';
import type { Task } from '@tm/core';
import {
	getStatusColor,
	getPriorityColor,
	getComplexityDisplay,
	padText
} from '../../utils/task-helpers.js';

interface TaskListSectionProps {
	tasks: Task[];
	complexityMap: Map<string, number> | null;
	selectedIndex: number;
	scrollOffset: number;
	maxHeight: number;
}

/**
 * Task List Section
 * Shows all tasks with subtasks in a scrollable table
 */
export const TaskListSection: React.FC<TaskListSectionProps> = ({
	tasks,
	complexityMap,
	selectedIndex,
	scrollOffset,
	maxHeight
}) => {
	const flattenedTasks: Array<any> = [];
	tasks.forEach((task) => {
		flattenedTasks.push(task);
		if (task.subtasks && task.subtasks.length > 0) {
			task.subtasks.forEach((subtask, index) => {
				const isLastSubtask = index === task.subtasks!.length - 1;
				flattenedTasks.push({
					...subtask,
					isSubtask: true,
					isLastSubtask,
					parentId: task.id
				});
			});
		}
	});

	const idWidth = 5;
	const statusWidth = 12;
	const priorityWidth = 8;
	const depsWidth = 12;
	const complexityWidth = 10;

	const visibleRows = Math.max(1, maxHeight - 5);

	return (
		<Box
			flexDirection="column"
			borderStyle="single"
			paddingX={1}
			flexGrow={1}
			overflow="hidden"
		>
			<Box flexDirection="row" flexShrink={0} columnGap={1}>
				<Box width={idWidth} flexShrink={0}>
					<Text bold color="blue" wrap="truncate-end">
						ID
					</Text>
				</Box>
				<Box flexGrow={1} flexShrink={1} minWidth={7}>
					<Text bold color="blue" wrap="truncate-end">
						Title
					</Text>
				</Box>
				<Box width={statusWidth} flexShrink={0}>
					<Text bold color="blue" wrap="truncate-end">
						Status
					</Text>
				</Box>
				<Box width={priorityWidth} flexShrink={0}>
					<Text bold color="blue" wrap="truncate-end">
						Priority
					</Text>
				</Box>
				<Box width={depsWidth} flexShrink={0}>
					<Text bold color="blue" wrap="truncate-end">
						Dependencies
					</Text>
				</Box>
				{complexityMap && (
					<Box width={complexityWidth} flexShrink={0}>
						<Text bold color="blue" wrap="truncate-end">
							Complex…
						</Text>
					</Box>
				)}
			</Box>

			<Box flexDirection="column" flexGrow={1}>
				{flattenedTasks
					.slice(scrollOffset, scrollOffset + visibleRows)
					.map((task, index) => {
						const actualIndex = scrollOffset + index;
						const isSelected = selectedIndex === actualIndex;
						const taskId = task.isSubtask
							? `${task.parentId}.${task.id}`
							: task.id;

						const treeChar = task.isSubtask
							? task.isLastSubtask
								? '└─ '
								: '├─ '
							: '';
						const taskTitle = task.isSubtask
							? `${treeChar}${task.title}`
							: task.title;

						const deps =
							task.dependencies && task.dependencies.length > 0
								? task.dependencies.join(', ')
								: 'None';

						const complexity = task.isSubtask
							? undefined
							: complexityMap?.get(String(task.id)) || task.complexity;
						const complexityDisplay = getComplexityDisplay(complexity);

						return (
							<Box
								key={actualIndex}
								flexDirection="row"
								flexShrink={0}
								columnGap={1}
								{...({
									backgroundColor: isSelected ? 'blue' : 'transparent'
								} as any)}
							>
								<Box width={idWidth} flexShrink={0}>
									<Text
										color={
											isSelected ? 'white' : task.isSubtask ? 'gray' : 'cyan'
										}
										wrap="truncate-end"
									>
										{padText(String(taskId), idWidth)}
									</Text>
								</Box>
								<Box flexGrow={1} flexShrink={1} minWidth={7}>
									{task.isSubtask ? (
										<Text wrap="truncate-end">
											<Text color={isSelected ? 'white' : 'gray'}>
												{treeChar}
											</Text>
											<Text color={isSelected ? 'white' : undefined}>
												{task.title}
											</Text>
										</Text>
									) : (
										<Text
											color={isSelected ? 'white' : undefined}
											wrap="truncate-end"
										>
											{taskTitle}
										</Text>
									)}
								</Box>
								<Box width={statusWidth} flexShrink={0}>
									<Text
										color={isSelected ? 'white' : getStatusColor(task.status)}
										wrap="truncate-end"
									>
										{padText(task.status, statusWidth)}
									</Text>
								</Box>
								<Box width={priorityWidth} flexShrink={0}>
									<Text
										color={
											isSelected ? 'white' : getPriorityColor(task.priority)
										}
										wrap="truncate-end"
									>
										{padText(task.priority || '-', priorityWidth)}
									</Text>
								</Box>
								<Box width={depsWidth} flexShrink={0}>
									<Text
										color={isSelected ? 'white' : 'cyan'}
										wrap="truncate-end"
									>
										{deps}
									</Text>
								</Box>
								{complexityMap && (
									<Box width={complexityWidth} flexShrink={0}>
										<Text
											color={isSelected ? 'white' : complexityDisplay.color}
											wrap="truncate-end"
										>
											● {complexityDisplay.text}
										</Text>
									</Box>
								)}
							</Box>
						);
					})}
			</Box>
		</Box>
	);
};
