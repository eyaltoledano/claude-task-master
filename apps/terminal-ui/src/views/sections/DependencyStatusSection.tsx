import React from 'react';
import { Box, Text } from 'ink';
import type { Task } from '@tm/core';
import { getComplexityDisplay } from '../../utils/task-helpers.js';

interface DependencyStatusSectionProps {
	tasks: Task[];
	complexityMap: Map<string, number> | null;
}

/**
 * Dependency Status Section
 * Shows dependency metrics and next task to work on
 */
export const DependencyStatusSection: React.FC<
	DependencyStatusSectionProps
> = ({ tasks, complexityMap }) => {
	// Calculate dependency metrics
	const tasksWithNoDeps = tasks.filter(
		(t) => !t.dependencies || t.dependencies.length === 0
	).length;

	// Tasks ready to work on (pending with no dependencies or all dependencies done)
	const tasksReadyToWorkOn = tasks.filter((t) => {
		if (t.status !== 'pending') return false;
		if (!t.dependencies || t.dependencies.length === 0) return true;
		return t.dependencies.every((depId) => {
			const depTask = tasks.find((dt) => dt.id === depId);
			return depTask?.status === 'done';
		});
	}).length;

	// Tasks blocked by dependencies
	const tasksBlockedByDeps = tasks.filter((t) => {
		if (t.status !== 'pending') return false;
		if (!t.dependencies || t.dependencies.length === 0) return false;
		return t.dependencies.some((depId) => {
			const depTask = tasks.find((dt) => dt.id === depId);
			return depTask?.status !== 'done';
		});
	}).length;

	// Most depended-on task
	const dependencyCounts = new Map<string, number>();
	tasks.forEach((t) => {
		(t.dependencies || []).forEach((depId) => {
			dependencyCounts.set(depId, (dependencyCounts.get(depId) || 0) + 1);
		});
	});
	const mostDependedOn = Array.from(dependencyCounts.entries()).sort(
		(a, b) => b[1] - a[1]
	)[0];

	// Average dependencies per task
	const totalDeps = tasks.reduce(
		(sum, t) => sum + (t.dependencies?.length || 0),
		0
	);
	const avgDeps =
		tasks.length > 0 ? (totalDeps / tasks.length).toFixed(1) : '0';

	// Find next task to work on
	const nextTask = tasks.find((t) => {
		if (t.status !== 'pending') return false;
		if (!t.dependencies || t.dependencies.length === 0) return true;
		return t.dependencies.every((depId) => {
			const depTask = tasks.find((dt) => dt.id === depId);
			return depTask?.status === 'done';
		});
	});

	// Get complexity for next task
	const nextTaskComplexity = nextTask
		? complexityMap?.get(String(nextTask.id)) || nextTask.complexity
		: undefined;
	const nextTaskComplexityDisplay = getComplexityDisplay(nextTaskComplexity);

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
					Dependency Status & Next Task
				</Text>
			</Box>

			{/* Dependency Metrics */}
			<Box flexDirection="column" marginBottom={1}>
				<Text bold color="cyan">
					Dependency Metrics:
				</Text>
				<Text>
					<Text color="green">•</Text>{' '}
					<Text color="white">Tasks with no dependencies:</Text>{' '}
					{tasksWithNoDeps}
				</Text>
				<Text>
					<Text color="green">•</Text>{' '}
					<Text color="white">Tasks ready to work on:</Text>{' '}
					{tasksReadyToWorkOn}
				</Text>
				<Text>
					<Text color="yellow">•</Text>{' '}
					<Text color="white">Tasks blocked by dependencies:</Text>{' '}
					{tasksBlockedByDeps}
				</Text>
				{mostDependedOn ? (
					<Text>
						<Text color="magenta">•</Text>{' '}
						<Text color="white">Most depended-on task:</Text>{' '}
						<Text color="cyan">
							#{mostDependedOn[0]} ({mostDependedOn[1]} dependents)
						</Text>
					</Text>
				) : (
					<Text>
						<Text color="magenta">•</Text>{' '}
						<Text color="white">Most depended-on task:</Text>{' '}
						<Text color="gray">None</Text>
					</Text>
				)}
				<Text>
					<Text color="blue">•</Text>{' '}
					<Text color="white">Avg dependencies per task:</Text> {avgDeps}
				</Text>
			</Box>

			{/* Next Task */}
			<Box flexDirection="column">
				<Text bold color="cyan">
					Next Task to Work On:
				</Text>
				{nextTask ? (
					<>
						<Text>
							ID: <Text color="cyan">{nextTask.id}</Text> -{' '}
							<Text bold color="white">
								{nextTask.title}
							</Text>
						</Text>
						<Text>
							Priority: {nextTask.priority || <Text color="gray">N/A</Text>}{' '}
							Dependencies:{' '}
							{nextTask.dependencies && nextTask.dependencies.length > 0 ? (
								<Text color="cyan">{nextTask.dependencies.join(', ')}</Text>
							) : (
								<Text color="gray">None</Text>
							)}
						</Text>
						<Text>
							Complexity:{' '}
							<Text color={nextTaskComplexityDisplay.color}>
								{nextTaskComplexityDisplay.text}
							</Text>
						</Text>
					</>
				) : (
					<>
						<Text>
							ID: <Text color="gray">N/A</Text> -{' '}
							<Text color="yellow">No task available</Text>
						</Text>
						<Text>
							Priority: <Text color="gray">N/A</Text> Dependencies:{' '}
							<Text color="gray">None</Text>
						</Text>
						<Text>
							Complexity: <Text color="gray">N/A</Text>
						</Text>
					</>
				)}
			</Box>
		</Box>
	);
};
