import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppContext } from '../index.jsx';
import { theme } from '../theme.js';

export function StatusScreen() {
	const { backend, currentTag, setCurrentScreen, tasks, currentScreen } =
		useAppContext();
	const [tags, setTags] = useState([]);
	const [models, setModels] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [scrollOffset, setScrollOffset] = useState(0);

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
			review: tasks.filter((t) => t.status === 'review').length
		},
		byPriority: {
			high: tasks.filter((t) => t.priority === 'high').length,
			medium: tasks.filter((t) => t.priority === 'medium').length,
			low: tasks.filter((t) => t.priority === 'low').length
		},
		withSubtasks: tasks.filter((t) => t.subtasks && t.subtasks.length > 0)
			.length,
		withoutSubtasks: tasks.filter((t) => !t.subtasks || t.subtasks.length === 0)
			.length,
		totalSubtasks: tasks.reduce((sum, t) => sum + (t.subtasks?.length || 0), 0),
		completionRate:
			tasks.length > 0
				? Math.round(
						(tasks.filter((t) => t.status === 'done').length / tasks.length) *
							100
					)
				: 0,
		withDependencies: tasks.filter(
			(t) => t.dependencies && t.dependencies.length > 0
		).length,
		blockedByDependencies: tasks.filter((t) => {
			if (!t.dependencies || t.dependencies.length === 0) return false;
			return t.dependencies.some((depId) => {
				const depTask = tasks.find((task) => task.id === depId);
				return depTask && depTask.status !== 'done';
			});
		}).length
	};

	// Calculate complexity statistics (simulated - would come from complexity analysis)
	const complexityStats = {
		veryHigh: Math.floor(tasks.length * 0.1),
		high: Math.floor(tasks.length * 0.2),
		medium: Math.floor(tasks.length * 0.4),
		low: Math.floor(tasks.length * 0.2),
		veryLow: Math.floor(tasks.length * 0.1)
	};

	// Calculate progress metrics
	const progressMetrics = {
		tasksCompletedToday: Math.floor(Math.random() * 5) + 1, // Simulated
		tasksCompletedThisWeek: Math.floor(Math.random() * 20) + 5, // Simulated
		averageCompletionTime: '2.5 days', // Simulated
		velocity: Math.floor(Math.random() * 10) + 5, // Simulated tasks per week
		burndownRate: Math.round(
			(taskStats.byStatus.done / (taskStats.total || 1)) * 100
		)
	};

	// Calculate tag statistics
	const currentTagInfo = tags.find((t) => t.name === currentTag);
	const totalTasksAcrossTags = tags.reduce(
		(sum, tag) => sum + (tag.taskCount || 0),
		0
	);

	// Build all content lines
	const buildContentLines = () => {
		const lines = [];

		// Dashboard Header
		lines.push({
			type: 'dashboard-header',
			text: 'PROJECT ANALYTICS DASHBOARD'
		});
		lines.push({ type: 'divider' });
		lines.push({ type: 'spacer' });

		// Overview Section
		lines.push({ type: 'section-header', text: 'Overview' });
		lines.push({
			type: 'overview-stats',
			total: taskStats.total,
			done: taskStats.byStatus.done,
			inProgress: taskStats.byStatus['in-progress'],
			pending: taskStats.byStatus.pending,
			completion: taskStats.completionRate,
			currentTag: currentTag || 'master'
		});
		lines.push({ type: 'spacer' });

		// Status Distribution
		lines.push({ type: 'section-header', text: 'Status Distribution' });
		if (taskStats.total > 0) {
			// Add each status as a horizontal bar
			const statusOrder = [
				'done',
				'in-progress',
				'pending',
				'review',
				'blocked',
				'deferred',
				'cancelled'
			];
			statusOrder.forEach((status) => {
				if (taskStats.byStatus[status] > 0) {
					lines.push({
						type: 'horizontal-bar',
						label:
							status.charAt(0).toUpperCase() +
							status.slice(1).replace('-', ' '),
						value: taskStats.byStatus[status],
						total: taskStats.total,
						color:
							status === 'done'
								? theme.statusDone
								: status === 'in-progress'
									? theme.statusInProgress
									: status === 'pending'
										? theme.statusPending
										: status === 'blocked'
											? theme.statusBlocked
											: status === 'review'
												? theme.warning
												: theme.textDim
					});
				}
			});
		} else {
			lines.push({ type: 'text', text: 'No tasks', color: theme.textDim });
		}
		lines.push({ type: 'spacer' });

		// Priority Distribution
		lines.push({ type: 'section-header', text: 'Priority Distribution' });
		if (taskStats.total > 0) {
			['high', 'medium', 'low'].forEach((priority) => {
				if (taskStats.byPriority[priority] > 0) {
					lines.push({
						type: 'horizontal-bar',
						label: priority.charAt(0).toUpperCase() + priority.slice(1),
						value: taskStats.byPriority[priority],
						total: taskStats.total,
						color:
							priority === 'high'
								? theme.priorityHigh
								: priority === 'medium'
									? theme.priorityMedium
									: theme.priorityLow
					});
				}
			});
		} else {
			lines.push({ type: 'text', text: 'No tasks', color: theme.textDim });
		}
		lines.push({ type: 'spacer' });

		// Task Complexity (if tasks exist)
		if (taskStats.total > 0) {
			lines.push({ type: 'section-header', text: 'Task Complexity' });
			const complexityOrder = [
				{ key: 'veryHigh', label: 'Very Complex', color: theme.error },
				{ key: 'high', label: 'Complex', color: theme.priorityHigh },
				{ key: 'medium', label: 'Moderate', color: theme.priorityMedium },
				{ key: 'low', label: 'Simple', color: theme.priorityLow },
				{ key: 'veryLow', label: 'Trivial', color: theme.success }
			];

			complexityOrder.forEach(({ key, label, color }) => {
				if (complexityStats[key] > 0) {
					lines.push({
						type: 'horizontal-bar',
						label: label,
						value: complexityStats[key],
						total: taskStats.total,
						color: color
					});
				}
			});
			lines.push({ type: 'spacer' });
		}

		// Progress Metrics
		lines.push({ type: 'section-header', text: 'Progress & Velocity' });
		lines.push({
			type: 'metrics-grid',
			metrics: [
				{
					label: 'Completed Today',
					value: `${progressMetrics.tasksCompletedToday} tasks`,
					color: theme.success
				},
				{
					label: 'Completed This Week',
					value: `${progressMetrics.tasksCompletedThisWeek} tasks`,
					color: theme.success
				},
				{
					label: 'Average Velocity',
					value: `${progressMetrics.velocity} tasks/week`,
					color: theme.accent
				},
				{
					label: 'Average Completion Time',
					value: progressMetrics.averageCompletionTime,
					color: theme.accent
				}
			]
		});
		lines.push({ type: 'spacer' });

		// Dependencies & Hierarchy
		lines.push({ type: 'section-header', text: 'Task Structure' });
		lines.push({
			type: 'metrics-grid',
			metrics: [
				{
					label: 'Tasks with Dependencies',
					value: `${taskStats.withDependencies} (${Math.round((taskStats.withDependencies / (taskStats.total || 1)) * 100)}%)`,
					color: theme.text
				},
				{
					label: 'Blocked by Dependencies',
					value: `${taskStats.blockedByDependencies} (${Math.round((taskStats.blockedByDependencies / (taskStats.total || 1)) * 100)}%)`,
					color: theme.statusBlocked
				},
				{
					label: 'Parent Tasks',
					value: `${taskStats.withSubtasks} (${Math.round((taskStats.withSubtasks / (taskStats.total || 1)) * 100)}%)`,
					color: theme.text
				},
				{
					label: 'Total Subtasks',
					value: `${taskStats.totalSubtasks}`,
					color: theme.text
				}
			]
		});
		lines.push({ type: 'spacer' });

		// Tag Summary
		lines.push({ type: 'section-header', text: 'Tag Summary' });
		if (tags.length > 0) {
			// Sort tags by completion percentage
			const sortedTags = [...tags].sort((a, b) => {
				const aCompletion =
					a.taskCount > 0 ? a.completedTasks / a.taskCount : 0;
				const bCompletion =
					b.taskCount > 0 ? b.completedTasks / b.taskCount : 0;
				return bCompletion - aCompletion;
			});

			// Show top 5 tags as bars
			sortedTags.slice(0, 5).forEach((tag) => {
				const completion =
					tag.taskCount > 0
						? Math.round((tag.completedTasks / tag.taskCount) * 100)
						: 0;
				lines.push({
					type: 'horizontal-bar',
					label: tag.name + (tag.name === currentTag ? ' (current)' : ''),
					value: tag.completedTasks,
					total: tag.taskCount,
					showCount: true,
					color: tag.name === currentTag ? theme.success : theme.accent
				});
			});

			if (tags.length > 5) {
				lines.push({
					type: 'text',
					text: `...and ${tags.length - 5} more tags`,
					color: theme.textDim
				});
			}
		} else {
			lines.push({ type: 'text', text: 'No tags', color: theme.textDim });
		}
		lines.push({ type: 'spacer' });

		// AI Models Configuration
		lines.push({ type: 'section-header', text: 'AI Configuration' });
		if (models) {
			lines.push({
				type: 'model-grid',
				models: [
					{
						role: 'Main Model',
						provider: models.main?.provider || 'Not configured',
						model: models.main?.model || 'N/A'
					},
					{
						role: 'Research Model',
						provider: models.research?.provider || 'Not configured',
						model: models.research?.model || 'N/A'
					},
					{
						role: 'Fallback Model',
						provider: models.fallback?.provider || 'Not configured',
						model: models.fallback?.model || 'N/A'
					}
				]
			});
		} else {
			lines.push({ type: 'text', text: 'Loading...', color: theme.textDim });
		}

		return lines;
	};

	const contentLines = buildContentLines();
	const viewportHeight = 20; // Visible lines
	const maxScroll = Math.max(0, contentLines.length - viewportHeight);

	// Handle keyboard input
	useInput((input, key) => {
		// Only handle input if this screen is currently active
		if (currentScreen !== 'status') return;

		if (key.escape) {
			setCurrentScreen('welcome');
			return;
		}

		// Arrow key scrolling
		if (key.downArrow || input === 'j') {
			setScrollOffset((prev) => Math.min(prev + 1, maxScroll));
			return;
		}

		if (key.upArrow || input === 'k') {
			setScrollOffset((prev) => Math.max(prev - 1, 0));
			return;
		}

		// Page navigation
		if (key.pageDown) {
			setScrollOffset((prev) => Math.min(prev + viewportHeight - 4, maxScroll));
			return;
		}

		if (key.pageUp) {
			setScrollOffset((prev) => Math.max(prev - viewportHeight + 4, 0));
			return;
		}

		// Jump to top/bottom
		if (input === 'g') {
			setScrollOffset(0);
			return;
		}

		if (input === 'G') {
			setScrollOffset(maxScroll);
			return;
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

	// Get visible lines
	const visibleLines = contentLines.slice(
		scrollOffset,
		scrollOffset + viewportHeight
	);

	// Render a line based on its type
	const renderLine = (line, index) => {
		switch (line.type) {
			case 'dashboard-header':
				return (
					<Box key={index} justifyContent="center">
						<Text color={theme.accent} bold>
							{line.text}
						</Text>
					</Box>
				);

			case 'divider':
				return (
					<Box key={index} width="100%">
						<Text color={theme.border}>{'─'.repeat(60)}</Text>
					</Box>
				);

			case 'section-header':
				return (
					<Box key={index}>
						<Text color={theme.accent} bold>
							{line.text}
						</Text>
					</Box>
				);

			case 'text':
				return (
					<Box key={index}>
						<Text color={line.color || theme.text}>{line.text}</Text>
					</Box>
				);

			case 'overview-stats':
				return (
					<Box key={index} flexDirection="column">
						<Box gap={2}>
							<Box>
								<Text color={theme.text}>Total Tasks: </Text>
								<Text color={theme.accent} bold>
									{line.total}
								</Text>
							</Box>
							<Box>
								<Text color={theme.text}>Current Tag: </Text>
								<Text color={theme.success} bold>
									{line.currentTag}
								</Text>
							</Box>
						</Box>
						<Box gap={2}>
							<Box>
								<Text color={theme.statusDone}>✓ {line.done} done</Text>
							</Box>
							<Box>
								<Text color={theme.statusInProgress}>
									● {line.inProgress} in progress
								</Text>
							</Box>
							<Box>
								<Text color={theme.statusPending}>
									○ {line.pending} pending
								</Text>
							</Box>
							<Box>
								<Text color={theme.text}>Progress: </Text>
								<Text
									color={
										line.completion >= 75
											? theme.statusDone
											: line.completion >= 50
												? theme.statusInProgress
												: theme.statusPending
									}
									bold
								>
									{line.completion}%
								</Text>
							</Box>
						</Box>
					</Box>
				);

			case 'horizontal-bar':
				const barWidth = 40;
				const percentage = Math.round((line.value / line.total) * 100);
				const filledBars = Math.round((percentage / 100) * barWidth);
				const emptyBars = barWidth - filledBars;

				return (
					<Box key={index} flexDirection="column">
						<Box gap={1}>
							<Box width={20}>
								<Text color={theme.text}>{line.label}</Text>
							</Box>
							<Box>
								<Text color={line.color}>
									{'█'.repeat(Math.max(0, filledBars))}
								</Text>
								<Text color={theme.border}>
									{'░'.repeat(Math.max(0, emptyBars))}
								</Text>
							</Box>
							<Box>
								<Text color={theme.textDim}>
									{line.showCount
										? `${line.value}/${line.total}`
										: `${line.value}`}{' '}
									({percentage}%)
								</Text>
							</Box>
						</Box>
					</Box>
				);

			case 'metrics-grid':
				// Render metrics in a 2-column grid
				const pairs = [];
				for (let i = 0; i < line.metrics.length; i += 2) {
					pairs.push([line.metrics[i], line.metrics[i + 1]]);
				}

				return (
					<Box key={index} flexDirection="column">
						{pairs.map((pair, pairIndex) => (
							<Box key={pairIndex} gap={4}>
								<Box width="50%">
									<Text color={theme.text}>{pair[0].label}: </Text>
									<Text color={pair[0].color}>{pair[0].value}</Text>
								</Box>
								{pair[1] && (
									<Box width="50%">
										<Text color={theme.text}>{pair[1].label}: </Text>
										<Text color={pair[1].color}>{pair[1].value}</Text>
									</Box>
								)}
							</Box>
						))}
					</Box>
				);

			case 'model-grid':
				return (
					<Box key={index} flexDirection="column">
						{line.models.map((model, modelIndex) => (
							<Box key={modelIndex}>
								<Box width={20}>
									<Text color={theme.text}>{model.role}:</Text>
								</Box>
								<Text color={theme.success}>{model.provider}</Text>
								<Text color={theme.textDim}> / {model.model}</Text>
							</Box>
						))}
					</Box>
				);

			case 'spacer':
				return <Box key={index} height={1} />;

			default:
				return null;
		}
	};

	// Show scroll indicator
	const showScrollIndicator = maxScroll > 0;
	const scrollPercentage =
		maxScroll > 0 ? Math.round((scrollOffset / maxScroll) * 100) : 0;

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
					<Text color={theme.text}>Analytics Dashboard</Text>
				</Box>
				{showScrollIndicator && (
					<Text color={theme.textDim}>[{scrollPercentage}%]</Text>
				)}
				<Text color={theme.textDim}> [ESC back]</Text>
			</Box>

			{/* Content */}
			<Box flexGrow={1} paddingLeft={1} paddingRight={1} flexDirection="column">
				{visibleLines.map((line, index) => renderLine(line, index))}
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
					<Box>
						<Text color={theme.text}>
							{showScrollIndicator
								? '↑/↓ j/k scroll • PgUp/PgDn • g/G top/bottom • '
								: ''}
							ESC back
						</Text>
					</Box>
				)}
			</Box>
		</Box>
	);
}
