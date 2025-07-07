import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { ProgressBar, StatusMessage, Badge, Spinner } from '@inkjs/ui';
import { useExecutions } from '../hooks/useExecutions.js';
import { useStreamingExecution } from '../hooks/useStreamingExecution.js';
import { useOptimizedData } from '../hooks/useOptimizedData.js';
import { usePerformanceMonitor } from '../hooks/useOptimizedData.js';
import { useComponentTheme } from '../hooks/useTheme.jsx';

/**
 * ExecutionProgressCard component for detailed progress tracking
 */
const ExecutionProgressCard = ({ execution, theme }) => {
	const { currentStatus, currentProgress, isStreaming } = useStreamingExecution(
		execution.id,
		{ maxMessages: 5, autoConnect: true }
	);

	const formatDuration = (startTime) => {
		if (!startTime) return 'N/A';
		const start = new Date(startTime);
		const now = new Date();
		const diffMs = now - start;
		const diffMins = Math.floor(diffMs / 60000);
		const diffSecs = Math.floor((diffMs % 60000) / 1000);
		return `${diffMins}m ${diffSecs}s`;
	};

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={theme.colors?.border || 'gray'}
			padding={1}
			marginBottom={1}
		>
			{/* Execution Header */}
			<Box alignItems="center" marginBottom={1}>
				<Text bold color={theme.colors?.primary || 'cyan'}>
					{execution.taskId || execution.id}
				</Text>
				<Box marginLeft={2}>
					<Badge color={isStreaming ? 'green' : 'gray'}>
						{isStreaming ? 'Live' : 'Static'}
					</Badge>
				</Box>
				<Box marginLeft={2}>
					<StatusMessage
						variant={
							currentStatus === 'completed' || execution.status === 'completed'
								? 'success'
								: currentStatus === 'failed' || execution.status === 'failed'
									? 'error'
									: currentStatus === 'running' ||
											execution.status === 'running'
										? 'info'
										: 'default'
						}
					>
						{currentStatus || execution.status || 'Unknown'}
					</StatusMessage>
				</Box>
			</Box>

			{/* Progress Bar */}
			{(currentProgress > 0 || execution.progress > 0) && (
				<Box marginBottom={1}>
					<ProgressBar
						value={currentProgress || execution.progress || 0}
						label={`${Math.round(currentProgress || execution.progress || 0)}%`}
					/>
				</Box>
			)}

			{/* Execution Details */}
			<Box flexDirection="column">
				<Box>
					<Text color={theme.colors?.muted || 'gray'}>Provider: </Text>
					<Text color={theme.colors?.text || 'white'}>
						{execution.provider || 'Unknown'}
					</Text>
				</Box>
				<Box>
					<Text color={theme.colors?.muted || 'gray'}>Duration: </Text>
					<Text color={theme.colors?.text || 'white'}>
						{formatDuration(execution.startTime)}
					</Text>
				</Box>
				{execution.phase && (
					<Box>
						<Text color={theme.colors?.muted || 'gray'}>Phase: </Text>
						<Text color={theme.colors?.accent || 'yellow'}>
							{execution.phase}
						</Text>
					</Box>
				)}
			</Box>
		</Box>
	);
};

/**
 * ProgressOverview component showing quick stats and recent executions
 */
const ProgressOverview = ({ executions, theme }) => {
	const stats = useMemo(() => {
		const total = executions.length;
		const running = executions.filter((e) => e.status === 'running').length;
		const completed = executions.filter((e) => e.status === 'completed').length;
		const failed = executions.filter((e) => e.status === 'failed').length;
		const pending = executions.filter((e) => e.status === 'pending').length;

		return { total, running, completed, failed, pending };
	}, [executions]);

	const recentExecutions = useMemo(() => {
		return executions
			.filter((e) => e.startTime)
			.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
			.slice(0, 3);
	}, [executions]);

	return (
		<Box flexDirection="column">
			{/* Statistics */}
			<Box marginBottom={2}>
				<Text bold color={theme.colors?.accent || 'yellow'}>
					Execution Statistics:
				</Text>
				<Box flexDirection="row" marginTop={1} paddingLeft={1}>
					<Box marginRight={2}>
						<Badge color="blue">Total: {stats.total}</Badge>
					</Box>
					<Box marginRight={2}>
						<Badge color="green">Running: {stats.running}</Badge>
					</Box>
					<Box marginRight={2}>
						<Badge color="cyan">Completed: {stats.completed}</Badge>
					</Box>
					<Box marginRight={2}>
						<Badge color="red">Failed: {stats.failed}</Badge>
					</Box>
					<Box>
						<Badge color="gray">Pending: {stats.pending}</Badge>
					</Box>
				</Box>
			</Box>

			{/* Recent Executions */}
			<Box flexDirection="column">
				<Text bold color={theme.colors?.accent || 'yellow'}>
					Recent Executions:
				</Text>
				<Box paddingLeft={1} marginTop={1} flexDirection="column">
					{recentExecutions.length === 0 ? (
						<Text color={theme.colors?.muted || 'gray'}>
							No recent executions
						</Text>
					) : (
						recentExecutions.map((execution) => (
							<Box key={execution.id} marginBottom={1}>
								<Text color={theme.colors?.text || 'white'}>
									{execution.taskId || execution.id}
								</Text>
								<Box marginLeft={2}>
									<Badge
										color={
											execution.status === 'completed'
												? 'green'
												: execution.status === 'failed'
													? 'red'
													: execution.status === 'running'
														? 'blue'
														: 'gray'
										}
									>
										{execution.status}
									</Badge>
								</Box>
								{execution.progress > 0 && (
									<Text marginLeft={2} color={theme.colors?.muted || 'gray'}>
										({execution.progress}%)
									</Text>
								)}
								<Text marginLeft={2} color={theme.colors?.muted || 'gray'}>
									{new Date(execution.startTime).toLocaleTimeString()}
								</Text>
							</Box>
						))
					)}
				</Box>
			</Box>
		</Box>
	);
};

/**
 * DetailedProgressView component with individual execution progress cards
 */
const DetailedProgressView = ({ executions, theme }) => {
	const runningExecutions = useMemo(() => {
		return executions.filter(
			(e) => e.status === 'running' || e.status === 'in-progress'
		);
	}, [executions]);

	const allExecutions = useMemo(() => {
		return executions.sort((a, b) => {
			// Sort by status priority (running first), then by start time
			const statusPriority = {
				running: 1,
				'in-progress': 2,
				completed: 3,
				failed: 4,
				pending: 5
			};

			const aPriority = statusPriority[a.status] || 6;
			const bPriority = statusPriority[b.status] || 6;

			if (aPriority !== bPriority) {
				return aPriority - bPriority;
			}

			// If same priority, sort by start time (newest first)
			const aTime = a.startTime ? new Date(a.startTime) : new Date(0);
			const bTime = b.startTime ? new Date(b.startTime) : new Date(0);
			return bTime - aTime;
		});
	}, [executions]);

	return (
		<Box flexDirection="column">
			{runningExecutions.length > 0 && (
				<Box marginBottom={2}>
					<Text bold color={theme.colors?.accent || 'yellow'}>
						Active Executions ({runningExecutions.length}):
					</Text>
					<Box paddingLeft={1} marginTop={1} flexDirection="column">
						{runningExecutions.map((execution) => (
							<ExecutionProgressCard
								key={execution.id}
								execution={execution}
								theme={theme}
							/>
						))}
					</Box>
				</Box>
			)}

			<Box flexDirection="column">
				<Text bold color={theme.colors?.accent || 'yellow'}>
					All Executions ({allExecutions.length}):
				</Text>
				<Box paddingLeft={1} marginTop={1} flexDirection="column" height="100%">
					{allExecutions.slice(0, 5).map((execution) => (
						<ExecutionProgressCard
							key={execution.id}
							execution={execution}
							theme={theme}
						/>
					))}
					{allExecutions.length > 5 && (
						<Box marginTop={1}>
							<Text color={theme.colors?.muted || 'gray'}>
								... and {allExecutions.length - 5} more executions
							</Text>
						</Box>
					)}
				</Box>
			</Box>
		</Box>
	);
};

/**
 * InteractiveProgressSection component with toggleable views
 */
export function InteractiveProgressSection() {
	const [viewMode, setViewMode] = useState('overview'); // 'overview' or 'detailed'
	const { theme } = useComponentTheme('progressSection');
	const { renderCount } = usePerformanceMonitor('InteractiveProgressSection');

	// Load executions with real-time updates
	const { executions, loading, error, connectionStatus, refetch } =
		useExecutions({
			pollInterval: 2000,
			maxRetries: 3,
			enableStreaming: true
		});

	// Optimize execution data for display
	const optimizedExecutions = useOptimizedData(executions, [executions]);

	// Handle keyboard input
	useInput((input, key) => {
		if (input === 't') {
			setViewMode(viewMode === 'overview' ? 'detailed' : 'overview');
		} else if (input === 'r') {
			refetch();
		}
	});

	if (loading && executions.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box alignItems="center">
					<Spinner />
					<Text marginLeft={1}>Loading execution progress...</Text>
				</Box>
			</Box>
		);
	}

	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<StatusMessage variant="error">
					Failed to load execution progress: {error}
				</StatusMessage>
				<Text marginTop={1} color={theme.colors?.muted || 'gray'}>
					Press 'r' to retry
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" height="100%">
			{/* Header with view mode toggle */}
			<Box
				paddingX={1}
				paddingY={1}
				borderStyle="single"
				borderColor={theme.colors?.border || 'gray'}
				marginBottom={1}
			>
				<Text bold color={theme.colors?.primary || 'cyan'}>
					📊 Execution Progress Tracker
				</Text>
				<Box marginLeft={2}>
					<Badge color={viewMode === 'overview' ? 'green' : 'blue'}>
						{viewMode === 'overview' ? 'Overview Mode' : 'Detailed Mode'}
					</Badge>
				</Box>
				<Box marginLeft={2}>
					<Badge color={connectionStatus === 'connected' ? 'green' : 'yellow'}>
						{connectionStatus}
					</Badge>
				</Box>
				<Box marginLeft={2}>
					<Text color={theme.colors?.muted || 'gray'}>
						Renders: {renderCount}
					</Text>
				</Box>
			</Box>

			{/* Content Area */}
			<Box flexGrow={1} padding={1}>
				{viewMode === 'overview' ? (
					<ProgressOverview executions={optimizedExecutions} theme={theme} />
				) : (
					<DetailedProgressView
						executions={optimizedExecutions}
						theme={theme}
					/>
				)}
			</Box>

			{/* Footer with controls */}
			<Box
				paddingX={1}
				paddingY={1}
				borderStyle="single"
				borderTop
				borderColor={theme.colors?.border || 'gray'}
			>
				<Text color={theme.colors?.muted || 'gray'}>
					[t] Toggle View Mode • [r] Refresh • Real-time updates every 2s
				</Text>
			</Box>
		</Box>
	);
}
