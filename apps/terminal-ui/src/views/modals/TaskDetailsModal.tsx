import React from 'react';
import { Box, Text } from 'ink';
import { DimmedOverlay } from './DimmedOverlay.js';
import type { Task, TaskStatus } from '@tm/core';

interface TaskDetailsModalProps {
	task: Task & {
		isSubtask?: boolean;
		parentId?: string | number;
		isLastSubtask?: boolean;
	};
	tasks: Task[];
	complexityMap: Map<string, number> | null;
	dimensions: { width: number; height: number };
	getStatusColor: (status: TaskStatus) => string;
	getPriorityColor: (priority?: string) => string;
	getComplexityDisplay?: (complexity: any) => {
		icon: string;
		text: string;
		color: string;
	};
}

/**
 * Task Details Modal
 *
 * Shows detailed information about a task in a modal overlay
 */
export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
	task,
	tasks,
	complexityMap,
	dimensions,
	getStatusColor,
	getPriorityColor,
	getComplexityDisplay
}) => {
	// Calculate proper task ID
	const taskId = task.isSubtask ? `${task.parentId}.${task.id}` : task.id;

	// Find parent task if this is a subtask
	const parentTask =
		task.isSubtask && task.parentId
			? tasks.find((t) => t.id === task.parentId)
			: null;

	// Get complexity for the task (from complexity map or task itself)
	const taskComplexity = task.isSubtask
		? undefined
		: complexityMap?.get(String(task.id)) || task.complexity;

	// Get parent complexity if available
	const parentComplexity = parentTask
		? complexityMap?.get(String(parentTask.id)) || parentTask.complexity
		: undefined;

	const complexityDisplay =
		taskComplexity && getComplexityDisplay
			? getComplexityDisplay(taskComplexity)
			: null;

	const parentComplexityDisplay =
		parentComplexity && getComplexityDisplay
			? getComplexityDisplay(parentComplexity)
			: null;

	return (
		<Box
			position="absolute"
			width="100%"
			height="100%"
			justifyContent="center"
			alignItems="center"
		>
			<DimmedOverlay width={dimensions.width} height={dimensions.height} />

			<Box
				borderStyle="double"
				borderColor="cyan"
				paddingX={2}
				paddingY={1}
				flexDirection="column"
			>
				<Box marginBottom={1}>
					<Text bold color="white">
						{task.isSubtask ? 'Subtask Details' : 'Task Details'}
					</Text>
				</Box>

				{/* Parent Task Info (for subtasks) */}
				{task.isSubtask && parentTask && (
					<Box
						flexDirection="column"
						marginBottom={1}
						borderStyle="single"
						borderColor="gray"
						paddingX={1}
					>
						<Text bold color="cyan">
							Parent Task
						</Text>
						<Text>
							<Text bold>ID:</Text> <Text color="cyan">{parentTask.id}</Text>
						</Text>
						<Text>
							<Text bold>Title:</Text>{' '}
							<Text color="white">{parentTask.title}</Text>
						</Text>
						<Text>
							<Text bold>Priority:</Text>{' '}
							<Text color={getPriorityColor(parentTask.priority)}>
								{parentTask.priority || 'N/A'}
							</Text>
						</Text>
						{parentComplexityDisplay && (
							<Text>
								<Text bold>Complexity:</Text>{' '}
								<Text color={parentComplexityDisplay.color}>
									● {parentComplexityDisplay.text}
								</Text>
							</Text>
						)}
					</Box>
				)}

				{/* Task Info */}
				<Box flexDirection="column">
					<Text>
						<Text bold>ID:</Text> <Text color="cyan">{taskId}</Text>
					</Text>
					<Text>
						<Text bold>Title:</Text> <Text color="white">{task.title}</Text>
					</Text>

					{task.description && (
						<Text>
							<Text bold>Description:</Text> {task.description}
						</Text>
					)}

					<Text>
						<Text bold>Status:</Text>{' '}
						<Text color={getStatusColor(task.status)}>{task.status}</Text>
					</Text>

					<Text>
						<Text bold>Priority:</Text>{' '}
						<Text color={getPriorityColor(task.priority)}>
							{task.priority || '-'}
						</Text>
					</Text>

					{complexityDisplay && (
						<Text>
							<Text bold>Complexity:</Text>{' '}
							<Text color={complexityDisplay.color}>
								● {complexityDisplay.text}
							</Text>
						</Text>
					)}

					<Text>
						<Text bold>Dependencies:</Text>{' '}
						{task.dependencies && task.dependencies.length > 0 ? (
							<Text color="cyan">{task.dependencies.join(', ')}</Text>
						) : (
							<Text color="gray">None</Text>
						)}
					</Text>

					{task.subtasks && task.subtasks.length > 0 && (
						<Text>
							<Text bold>Subtasks:</Text> {task.subtasks.length}
						</Text>
					)}
				</Box>

				<Box marginTop={1}>
					<Text dimColor>
						Press <Text color="yellow">Enter</Text> or{' '}
						<Text color="yellow">Esc</Text> to close
					</Text>
				</Box>
			</Box>
		</Box>
	);
};
