import React from 'react';
import { Box, Text } from 'ink';
import type { Task } from '@tm/core';

interface ProjectDashboardSectionProps {
	tasks: Task[];
}

/**
 * Project Dashboard Section
 * Shows tasks progress, subtasks progress, and priority breakdown
 */
export const ProjectDashboardSection: React.FC<
	ProjectDashboardSectionProps
> = ({ tasks }) => {
	// Calculate task statistics
	const totalTasks = tasks.length;
	const doneTasks = tasks.filter((t) => t.status === 'done').length;
	const cancelledTasks = tasks.filter((t) => t.status === 'cancelled').length;
	const deferredTasks = tasks.filter((t) => t.status === 'deferred').length;
	const inProgressTasks = tasks.filter(
		(t) => t.status === 'in-progress'
	).length;
	const reviewTasks = tasks.filter((t) => t.status === 'review').length;
	const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
	const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;

	const completionPercentage =
		totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

	// Calculate subtask statistics
	const allSubtasks = tasks.flatMap((t) => t.subtasks || []);
	const totalSubtasks = allSubtasks.length;
	const completedSubtasks = allSubtasks.filter(
		(s) => s.status === 'done'
	).length;
	const cancelledSubtasks = allSubtasks.filter(
		(s) => s.status === 'cancelled'
	).length;
	const deferredSubtasks = allSubtasks.filter(
		(s) => s.status === 'deferred'
	).length;
	const inProgressSubtasks = allSubtasks.filter(
		(s) => s.status === 'in-progress'
	).length;
	const reviewSubtasks = allSubtasks.filter(
		(s) => s.status === 'review'
	).length;
	const pendingSubtasks = allSubtasks.filter(
		(s) => s.status === 'pending'
	).length;
	const blockedSubtasks = allSubtasks.filter(
		(s) => s.status === 'blocked'
	).length;

	const subtaskPercentage =
		totalSubtasks > 0
			? Math.round((completedSubtasks / totalSubtasks) * 100)
			: 0;

	// Priority breakdown
	const highPriority = tasks.filter(
		(t) => t.priority === 'high' || t.priority === 'critical'
	).length;
	const mediumPriority = tasks.filter((t) => t.priority === 'medium').length;
	const lowPriority = tasks.filter((t) => t.priority === 'low').length;

	// Calculate status breakdown as percentages for progress bar
	const calculateStatusBreakdown = (stats: {
		total: number;
		inProgress: number;
		pending: number;
		blocked: number;
		deferred: number;
		cancelled: number;
		review: number;
	}) => {
		if (stats.total === 0) return {};

		return {
			'in-progress': (stats.inProgress / stats.total) * 100,
			pending: (stats.pending / stats.total) * 100,
			blocked: (stats.blocked / stats.total) * 100,
			deferred: (stats.deferred / stats.total) * 100,
			cancelled: (stats.cancelled / stats.total) * 100,
			review: (stats.review / stats.total) * 100
		};
	};

	// Progress bar helper matching CLI colors
	const createProgressBar = (
		completionPercentage: number,
		width: number = 30,
		statusBreakdown?: {
			'in-progress'?: number;
			pending?: number;
			blocked?: number;
			deferred?: number;
			cancelled?: number;
			review?: number;
		}
	): React.ReactElement => {
		if (!statusBreakdown) {
			const filled = Math.round((completionPercentage / 100) * width);
			const empty = width - filled;
			return (
				<Text>
					<Text color="green">{'█'.repeat(filled)}</Text>
					<Text color="gray">{'░'.repeat(empty)}</Text>
				</Text>
			);
		}

		// Build the bar with different colored sections matching CLI
		const segments: React.ReactElement[] = [];
		let charsUsed = 0;

		// 1. Green filled blocks for completed tasks (done)
		const completedChars = Math.round((completionPercentage / 100) * width);
		if (completedChars > 0) {
			segments.push(
				<Text key="done" color="green">
					{'█'.repeat(completedChars)}
				</Text>
			);
			charsUsed += completedChars;
		}

		// 2. Gray filled blocks for cancelled
		if (statusBreakdown.cancelled && charsUsed < width) {
			const cancelledChars = Math.round(
				(statusBreakdown.cancelled / 100) * width
			);
			const actualChars = Math.min(cancelledChars, width - charsUsed);
			if (actualChars > 0) {
				segments.push(
					<Text key="cancelled" color="gray">
						{'█'.repeat(actualChars)}
					</Text>
				);
				charsUsed += actualChars;
			}
		}

		// 3. Gray filled blocks for deferred
		if (statusBreakdown.deferred && charsUsed < width) {
			const deferredChars = Math.round(
				(statusBreakdown.deferred / 100) * width
			);
			const actualChars = Math.min(deferredChars, width - charsUsed);
			if (actualChars > 0) {
				segments.push(
					<Text key="deferred" color="gray">
						{'█'.repeat(actualChars)}
					</Text>
				);
				charsUsed += actualChars;
			}
		}

		// 4. Blue filled blocks for in-progress
		if (statusBreakdown['in-progress'] && charsUsed < width) {
			const inProgressChars = Math.round(
				(statusBreakdown['in-progress'] / 100) * width
			);
			const actualChars = Math.min(inProgressChars, width - charsUsed);
			if (actualChars > 0) {
				segments.push(
					<Text key="in-progress" color="blue">
						{'█'.repeat(actualChars)}
					</Text>
				);
				charsUsed += actualChars;
			}
		}

		// 5. Magenta empty blocks for review
		if (statusBreakdown.review && charsUsed < width) {
			const reviewChars = Math.round((statusBreakdown.review / 100) * width);
			const actualChars = Math.min(reviewChars, width - charsUsed);
			if (actualChars > 0) {
				segments.push(
					<Text key="review" color="magenta">
						{'░'.repeat(actualChars)}
					</Text>
				);
				charsUsed += actualChars;
			}
		}

		// 6. Yellow empty blocks for pending
		if (statusBreakdown.pending && charsUsed < width) {
			const pendingChars = Math.round((statusBreakdown.pending / 100) * width);
			const actualChars = Math.min(pendingChars, width - charsUsed);
			if (actualChars > 0) {
				segments.push(
					<Text key="pending" color="yellow">
						{'░'.repeat(actualChars)}
					</Text>
				);
				charsUsed += actualChars;
			}
		}

		// 7. Red empty blocks for blocked
		if (statusBreakdown.blocked && charsUsed < width) {
			const blockedChars = Math.round((statusBreakdown.blocked / 100) * width);
			const actualChars = Math.min(blockedChars, width - charsUsed);
			if (actualChars > 0) {
				segments.push(
					<Text key="blocked" color="red">
						{'░'.repeat(actualChars)}
					</Text>
				);
				charsUsed += actualChars;
			}
		}

		// Fill any remaining space with yellow empty blocks
		if (charsUsed < width) {
			segments.push(
				<Text key="remaining" color="yellow">
					{'░'.repeat(width - charsUsed)}
				</Text>
			);
		}

		return <Text>{segments}</Text>;
	};

	const taskStatusBreakdown = calculateStatusBreakdown({
		total: totalTasks,
		inProgress: inProgressTasks,
		pending: pendingTasks,
		blocked: blockedTasks,
		deferred: deferredTasks,
		cancelled: cancelledTasks,
		review: reviewTasks
	});

	const subtaskStatusBreakdown = calculateStatusBreakdown({
		total: totalSubtasks,
		inProgress: inProgressSubtasks,
		pending: pendingSubtasks,
		blocked: blockedSubtasks,
		deferred: deferredSubtasks,
		cancelled: cancelledSubtasks,
		review: reviewSubtasks
	});

	return (
		<Box
			flexDirection="column"
			borderStyle="single"
			paddingX={1}
			flexGrow={1}
			overflow="hidden"
		>
			<Box marginBottom={1}>
				<Text bold color="white">
					Project Dashboard
				</Text>
			</Box>

			{/* Tasks Progress */}
			<Box flexDirection="column" flexShrink={0}>
				<Text>Tasks Progress:</Text>
			</Box>
			<Box flexDirection="column" flexShrink={0}>
				<Text>
					{createProgressBar(completionPercentage, 30, taskStatusBreakdown)}{' '}
					<Text color="yellow">
						{completionPercentage}% {doneTasks}/{totalTasks}
					</Text>
				</Text>
			</Box>
			<Box flexDirection="column" marginBottom={1} flexShrink={0}>
				<Text>
					Done: <Text color="green">{doneTasks}</Text> Cancelled:{' '}
					<Text color="gray">{cancelledTasks}</Text> Deferred:{' '}
					<Text color="gray">{deferredTasks}</Text>
				</Text>
				<Text>
					In Progress: <Text color="blue">{inProgressTasks}</Text> Review:{' '}
					<Text color="magenta">{reviewTasks}</Text> Pending:{' '}
					<Text color="yellow">{pendingTasks}</Text> Blocked:{' '}
					<Text color="red">{blockedTasks}</Text>
				</Text>
			</Box>

			{/* Subtasks Progress */}
			<Box flexDirection="column" flexShrink={0}>
				<Text>Subtasks Progress:</Text>
			</Box>
			<Box flexDirection="column" flexShrink={0}>
				<Text>
					{createProgressBar(subtaskPercentage, 30, subtaskStatusBreakdown)}{' '}
					<Text color="cyan">
						{subtaskPercentage}% {completedSubtasks}/{totalSubtasks}
					</Text>
				</Text>
			</Box>
			<Box flexDirection="column" marginBottom={1} flexShrink={0}>
				<Text>
					Completed:{' '}
					<Text color="green">
						{completedSubtasks}/{totalSubtasks}
					</Text>{' '}
					Cancelled: <Text color="gray">{cancelledSubtasks}</Text> Deferred:{' '}
					<Text color="gray">{deferredSubtasks}</Text>
				</Text>
				<Text>
					In Progress: <Text color="blue">{inProgressSubtasks}</Text> Review:{' '}
					<Text color="magenta">{reviewSubtasks}</Text> Pending:{' '}
					<Text color="yellow">{pendingSubtasks}</Text> Blocked:{' '}
					<Text color="red">{blockedSubtasks}</Text>
				</Text>
			</Box>

			{/* Priority Breakdown */}
			<Box flexDirection="column">
				<Text bold color="cyan">
					Priority Breakdown:
				</Text>
				<Text>
					<Text color="red">•</Text> <Text color="white">High priority:</Text>{' '}
					{highPriority}
				</Text>
				<Text>
					<Text color="yellow">•</Text>{' '}
					<Text color="white">Medium priority:</Text> {mediumPriority}
				</Text>
				<Text>
					<Text color="green">•</Text> <Text color="white">Low priority:</Text>{' '}
					{lowPriority}
				</Text>
			</Box>
		</Box>
	);
};
