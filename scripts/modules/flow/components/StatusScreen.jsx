import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppContext } from '../index.jsx';
import { theme } from '../theme.js';

export function StatusScreen() {
	const { backend, currentTag, setCurrentScreen, tasks } = useAppContext();
	const [tags, setTags] = useState([]);
	const [models, setModels] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Load data on mount
	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		try {
			setLoading(true);
			const [tagsResult, modelsResult] = await Promise.all([
				backend.listTags(),
				backend.getModels()
			]);
			setTags(tagsResult.tags || []);
			setModels(modelsResult);
			setLoading(false);
		} catch (err) {
			setError(err.message);
			setLoading(false);
		}
	};

	// Calculate task statistics
	const taskStats = {
		total: tasks.length,
		byStatus: {
			pending: tasks.filter((t) => t.status === 'pending').length,
			'in-progress': tasks.filter((t) => t.status === 'in-progress').length,
			done: tasks.filter((t) => t.status === 'done').length,
			blocked: tasks.filter((t) => t.status === 'blocked').length,
			cancelled: tasks.filter((t) => t.status === 'cancelled').length,
			deferred: tasks.filter((t) => t.status === 'deferred').length,
			other: tasks.filter(
				(t) =>
					![
						'pending',
						'in-progress',
						'done',
						'blocked',
						'cancelled',
						'deferred'
					].includes(t.status)
			).length
		},
		byPriority: {
			high: tasks.filter((t) => t.priority === 'high').length,
			medium: tasks.filter((t) => t.priority === 'medium').length,
			low: tasks.filter((t) => t.priority === 'low').length
		},
		withSubtasks: tasks.filter((t) => t.subtasks && t.subtasks.length > 0)
			.length,
		totalSubtasks: tasks.reduce((sum, t) => sum + (t.subtasks?.length || 0), 0),
		completionRate:
			tasks.length > 0
				? Math.round(
						(tasks.filter((t) => t.status === 'done').length / tasks.length) *
							100
					)
				: 0
	};

	// Calculate tag statistics
	const currentTagInfo = tags.find((t) => t.name === currentTag);
	const totalTasksAcrossTags = tags.reduce(
		(sum, tag) => sum + (tag.taskCount || 0),
		0
	);

	// Handle keyboard input
	useInput((input, key) => {
		if (key.escape) {
			setCurrentScreen('welcome');
		}
	});

	if (loading) {
		return (
			<Box flexDirection="column" height="100%">
				<Box justifyContent="center" alignItems="center" height="100%">
					<Text color={theme.accent}>Loading status...</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Box flexGrow={1}>
					<Text color={theme.accent}>Task Master</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color={theme.text}>Project Status</Text>
				</Box>
				<Text color={theme.textDim}>[ESC back]</Text>
			</Box>

			{/* Content */}
			<Box flexGrow={1} paddingLeft={1} paddingRight={1}>
				<Box flexDirection="column">
					{/* AI Models Configuration - Top, Single Column */}
					<Box
						borderStyle="round"
						borderColor={theme.border}
						paddingLeft={1}
						paddingRight={1}
						paddingTop={1}
						paddingBottom={1}
						marginBottom={1}
					>
						<Box flexDirection="column">
							<Text color={theme.accent} bold>
								AI Models Configuration
							</Text>
							{models ? (
								<Box flexDirection="column">
									<Box>
										<Text color={theme.text}>Main: </Text>
										<Text color={theme.success}>
											{models.main?.provider || 'N/A'}
										</Text>
										<Text color={theme.textDim}>
											{' '}
											/ {models.main?.model || 'N/A'}
										</Text>
									</Box>
									<Box>
										<Text color={theme.text}>Research: </Text>
										<Text color={theme.success}>
											{models.research?.provider || 'N/A'}
										</Text>
										<Text color={theme.textDim}>
											{' '}
											/ {models.research?.model || 'N/A'}
										</Text>
									</Box>
									<Box>
										<Text color={theme.text}>Fallback: </Text>
										<Text color={theme.success}>
											{models.fallback?.provider || 'N/A'}
										</Text>
										<Text color={theme.textDim}>
											{' '}
											/ {models.fallback?.model || 'N/A'}
										</Text>
									</Box>
								</Box>
							) : (
								<Text color={theme.textDim}>Loading...</Text>
							)}
						</Box>
					</Box>

					{/* Two column layout for remaining sections */}
					<Box>
						{/* Left Column */}
						<Box flexDirection="column" width="50%" paddingRight={1}>
							{/* Current Tag & Overview */}
							<Box
								borderStyle="round"
								borderColor={theme.border}
								paddingLeft={1}
								paddingRight={1}
								paddingTop={1}
								paddingBottom={1}
								marginBottom={1}
							>
								<Box flexDirection="column">
									<Text color={theme.accent} bold>
										Current Tag: {currentTag || 'master'}
									</Text>
									<Text color={theme.text}>
										{taskStats.total} tasks • {taskStats.completionRate}%
										complete
									</Text>
									{currentTagInfo && (
										<Text color={theme.textDim}>
											{currentTagInfo.completedTasks}/{currentTagInfo.taskCount}{' '}
											done in this tag
										</Text>
									)}
								</Box>
							</Box>

							{/* Task Status */}
							<Box
								borderStyle="round"
								borderColor={theme.border}
								paddingLeft={1}
								paddingRight={1}
								paddingTop={1}
								paddingBottom={1}
								marginBottom={1}
							>
								<Box flexDirection="column">
									<Text color={theme.accent} bold>
										Status Distribution
									</Text>
									{/* Visual bar */}
									{taskStats.total > 0 ? (
										<Box flexDirection="column">
											<Box>
												{/* Create visual distribution bar */}
												{(() => {
													const total = taskStats.total;
													const pendingPercent = Math.round((taskStats.byStatus.pending / total) * 100);
													const inProgressPercent = Math.round((taskStats.byStatus['in-progress'] / total) * 100);
													const donePercent = Math.round((taskStats.byStatus.done / total) * 100);
													const otherPercent = Math.round(((taskStats.byStatus.blocked + taskStats.byStatus.cancelled + taskStats.byStatus.deferred) / total) * 100);
													
													// Calculate bar segments (max width 40 chars)
													const barWidth = 40;
													const pendingBars = Math.round((pendingPercent / 100) * barWidth);
													const inProgressBars = Math.round((inProgressPercent / 100) * barWidth);
													const doneBars = Math.round((donePercent / 100) * barWidth);
													const otherBars = barWidth - pendingBars - inProgressBars - doneBars;
													
													return (
														<>
															<Text color={theme.statusPending}>{'█'.repeat(Math.max(0, pendingBars))}</Text>
															<Text color={theme.statusInProgress}>{'█'.repeat(Math.max(0, inProgressBars))}</Text>
															<Text color={theme.statusDone}>{'█'.repeat(Math.max(0, doneBars))}</Text>
															{otherBars > 0 && <Text color={theme.textDim}>{'█'.repeat(Math.max(0, otherBars))}</Text>}
														</>
													);
												})()}
											</Box>
											{/* Legend */}
											<Box flexWrap="wrap">
												<Text color={theme.statusPending}>
													{taskStats.byStatus.pending} Pending
												</Text>
												<Text color={theme.textDim}> ({Math.round((taskStats.byStatus.pending / taskStats.total) * 100)}%) </Text>
												{taskStats.byStatus['in-progress'] > 0 && (
													<>
														<Text color={theme.textDim}>• </Text>
														<Text color={theme.statusInProgress}>
															{taskStats.byStatus['in-progress']} In Progress
														</Text>
														<Text color={theme.textDim}> ({Math.round((taskStats.byStatus['in-progress'] / taskStats.total) * 100)}%) </Text>
													</>
												)}
												{taskStats.byStatus.done > 0 && (
													<>
														<Text color={theme.textDim}>• </Text>
														<Text color={theme.statusDone}>
															{taskStats.byStatus.done} Done
														</Text>
														<Text color={theme.textDim}> ({Math.round((taskStats.byStatus.done / taskStats.total) * 100)}%)</Text>
													</>
												)}
												{(taskStats.byStatus.blocked + taskStats.byStatus.cancelled + taskStats.byStatus.deferred) > 0 && (
													<>
														<Text color={theme.textDim}> • </Text>
														<Text color={theme.textDim}>
															{taskStats.byStatus.blocked + taskStats.byStatus.cancelled + taskStats.byStatus.deferred} Other
														</Text>
														<Text color={theme.textDim}> ({Math.round(((taskStats.byStatus.blocked + taskStats.byStatus.cancelled + taskStats.byStatus.deferred) / taskStats.total) * 100)}%)</Text>
													</>
												)}
											</Box>
										</Box>
									) : (
										<Text color={theme.textDim}>No tasks</Text>
									)}
								</Box>
							</Box>

							{/* Priority Distribution */}
							<Box
								borderStyle="round"
								borderColor={theme.border}
								paddingLeft={1}
								paddingRight={1}
								paddingTop={1}
								paddingBottom={1}
							>
								<Box flexDirection="column">
									<Text color={theme.accent} bold>
										Priority Distribution
									</Text>
									{/* Visual bar */}
									{taskStats.total > 0 ? (
										<Box flexDirection="column">
											<Box>
												{/* Create visual distribution bar */}
												{(() => {
													const total = taskStats.total;
													const highPercent = Math.round((taskStats.byPriority.high / total) * 100);
													const mediumPercent = Math.round((taskStats.byPriority.medium / total) * 100);
													const lowPercent = Math.round((taskStats.byPriority.low / total) * 100);
													
													// Calculate bar segments (max width 40 chars)
													const barWidth = 40;
													const highBars = Math.round((highPercent / 100) * barWidth);
													const mediumBars = Math.round((mediumPercent / 100) * barWidth);
													const lowBars = barWidth - highBars - mediumBars;
													
													return (
														<>
															<Text color={theme.priorityHigh}>{'█'.repeat(Math.max(0, highBars))}</Text>
															<Text color={theme.priorityMedium}>{'█'.repeat(Math.max(0, mediumBars))}</Text>
															<Text color={theme.priorityLow}>{'█'.repeat(Math.max(0, lowBars))}</Text>
														</>
													);
												})()}
											</Box>
											{/* Legend */}
											<Box>
												<Text color={theme.priorityHigh}>
													{taskStats.byPriority.high} High
												</Text>
												<Text color={theme.textDim}> ({Math.round((taskStats.byPriority.high / taskStats.total) * 100)}%) </Text>
												<Text color={theme.textDim}>• </Text>
												<Text color={theme.priorityMedium}>
													{taskStats.byPriority.medium} Medium
												</Text>
												<Text color={theme.textDim}> ({Math.round((taskStats.byPriority.medium / taskStats.total) * 100)}%) </Text>
												<Text color={theme.textDim}>• </Text>
												<Text color={theme.priorityLow}>
													{taskStats.byPriority.low} Low
												</Text>
												<Text color={theme.textDim}> ({Math.round((taskStats.byPriority.low / taskStats.total) * 100)}%)</Text>
											</Box>
										</Box>
									) : (
										<Text color={theme.textDim}>No tasks</Text>
									)}
								</Box>
							</Box>
						</Box>

						{/* Right Column */}
						<Box flexDirection="column" width="50%" paddingLeft={1}>
							{/* Task Hierarchy */}
							<Box
								borderStyle="round"
								borderColor={theme.border}
								paddingLeft={1}
								paddingRight={1}
								paddingTop={1}
								paddingBottom={1}
								marginBottom={1}
							>
								<Box flexDirection="column">
									<Text color={theme.accent} bold>
										Task Hierarchy
									</Text>
									<Text color={theme.text}>
										{taskStats.withSubtasks} parent tasks
									</Text>
									<Text color={theme.textDim}>
										{taskStats.totalSubtasks} total subtasks
									</Text>
								</Box>
							</Box>

							{/* All Tags Summary */}
							<Box
								borderStyle="round"
								borderColor={theme.border}
								paddingLeft={1}
								paddingRight={1}
								paddingTop={1}
								paddingBottom={1}
							>
								<Box flexDirection="column">
									<Text color={theme.accent} bold>
										All Tags Summary
									</Text>
									<Text color={theme.text}>{tags.length} tags total</Text>
									<Text color={theme.textDim}>
										{totalTasksAcrossTags} tasks across all tags
									</Text>
									<Box marginTop={1}>
										{tags.slice(0, 3).map((tag) => (
											<Box key={tag.name}>
												<Text
													color={
														tag.name === currentTag ? theme.success : theme.text
													}
												>
													{tag.name === currentTag ? '● ' : '  '}
													{tag.name}: {tag.taskCount}
												</Text>
											</Box>
										))}
										{tags.length > 3 && (
											<Text color={theme.textDim}>
												{' '}
												...and {tags.length - 3} more
											</Text>
										)}
									</Box>
								</Box>
							</Box>
						</Box>
					</Box>
				</Box>
			</Box>

			{/* Footer */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				paddingTop={1}
				paddingLeft={1}
				paddingRight={1}
			>
				{error ? (
					<Text color={theme.error}>{error}</Text>
				) : (
					<Text color={theme.text}>Press ESC to go back</Text>
				)}
			</Box>
		</Box>
	);
}
