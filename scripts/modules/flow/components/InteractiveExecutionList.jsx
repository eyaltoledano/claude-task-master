import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Select, ProgressBar, StatusMessage, Badge, Spinner } from '@inkjs/ui';
import { useExecutions } from '../hooks/useExecutions.js';
import { useStreamingExecution } from '../hooks/useStreamingExecution.js';
import { useOptimizedData } from '../hooks/useOptimizedData.js';
import { usePerformanceMonitor } from '../hooks/useOptimizedData.js';
import { useComponentTheme } from '../hooks/useTheme.jsx';

/**
 * LogMessage component for formatted log display with color coding
 */
const LogMessage = ({ message, theme }) => {
	const getLogColor = (level) => {
		switch (level?.toLowerCase()) {
			case 'error':
				return theme.colors?.error || 'red';
			case 'warn':
			case 'warning':
				return theme.colors?.warning || 'yellow';
			case 'info':
				return theme.colors?.info || 'blue';
			case 'debug':
				return theme.colors?.muted || 'gray';
			case 'success':
				return theme.colors?.success || 'green';
			default:
				return theme.colors?.text || 'white';
		}
	};

	const formatTimestamp = (timestamp) => {
		if (!timestamp) return '';
		try {
			return new Date(timestamp).toLocaleTimeString();
		} catch {
			return '';
		}
	};

	return (
		<Box>
			<Text color={theme.colors?.muted || 'gray'}>
				[{formatTimestamp(message.timestamp)}]
			</Text>
			<Text color={getLogColor(message.level)} marginLeft={1}>
				{message.level?.toUpperCase() || 'LOG'}:
			</Text>
			<Text marginLeft={1}>
				{message.data?.message || message.message || 'No message'}
			</Text>
		</Box>
	);
};

/**
 * ExecutionDetailsPanel component showing real-time execution details
 */
const ExecutionDetailsPanel = ({ execution, theme }) => {
	const { messages, currentStatus, currentProgress, isStreaming } =
		useStreamingExecution(execution?.id, {
			maxMessages: 50,
			autoConnect: true
		});

	if (!execution) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color={theme.colors?.muted || 'gray'}>
					Select an execution to view details
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1} height="100%">
			{/* Execution Header */}
			<Box marginBottom={1} flexDirection="column">
				<Box>
					<Text bold color={theme.colors?.primary || 'cyan'}>
						Execution: {execution.id}
					</Text>
					<Box marginLeft={2}>
						<Badge color={isStreaming ? 'green' : 'gray'}>
							{isStreaming ? 'Live' : 'Static'}
						</Badge>
					</Box>
				</Box>
				<Text color={theme.colors?.muted || 'gray'}>
					Task: {execution.taskId || 'Unknown'}
				</Text>
			</Box>

			{/* Status and Progress */}
			<Box marginBottom={1} flexDirection="column">
				<Box alignItems="center">
					<Text color={theme.colors?.text || 'white'}>Status: </Text>
					<StatusMessage
						variant={
							currentStatus === 'completed'
								? 'success'
								: currentStatus === 'failed'
									? 'error'
									: currentStatus === 'running'
										? 'info'
										: 'default'
						}
					>
						{currentStatus || execution.status || 'Unknown'}
					</StatusMessage>
				</Box>

				{(currentProgress > 0 || execution.progress > 0) && (
					<Box marginTop={1}>
						<ProgressBar
							value={currentProgress || execution.progress || 0}
							label={`${Math.round(currentProgress || execution.progress || 0)}%`}
						/>
					</Box>
				)}
			</Box>

			{/* Metadata */}
			<Box marginBottom={1} flexDirection="column">
				<Text color={theme.colors?.muted || 'gray'} bold>
					Metadata:
				</Text>
				<Box paddingLeft={1} flexDirection="column">
					<Text color={theme.colors?.text || 'white'}>
						Provider: {execution.provider || 'Unknown'}
					</Text>
					<Text color={theme.colors?.text || 'white'}>
						Started:{' '}
						{execution.startTime
							? new Date(execution.startTime).toLocaleString()
							: 'N/A'}
					</Text>
					{execution.duration && (
						<Text color={theme.colors?.text || 'white'}>
							Duration: {execution.duration}
						</Text>
					)}
				</Box>
			</Box>

			{/* Live Logs Section */}
			<Box flexDirection="column" flexGrow={1}>
				<Box alignItems="center" marginBottom={1}>
					<Text color={theme.colors?.accent || 'yellow'} bold>
						Live Logs
					</Text>
					{isStreaming && (
						<Box marginLeft={2}>
							<Spinner />
							<Text color={theme.colors?.success || 'green'} marginLeft={1}>
								Streaming ({messages.length} messages)
							</Text>
						</Box>
					)}
				</Box>

				<Box
					flexDirection="column"
					flexGrow={1}
					borderStyle="round"
					borderColor={theme.colors?.border || 'gray'}
					padding={1}
					height="100%"
				>
					{messages.length === 0 ? (
						<Text color={theme.colors?.muted || 'gray'}>
							{isStreaming
								? 'Waiting for log messages...'
								: 'No log messages available'}
						</Text>
					) : (
						messages
							.slice(-10)
							.map((message, index) => (
								<LogMessage
									key={message.id || `${message.timestamp}-${index}`}
									message={message}
									theme={theme}
								/>
							))
					)}
				</Box>
			</Box>
		</Box>
	);
};

/**
 * InteractiveExecutionList component with enhanced real-time functionality
 */
export function InteractiveExecutionList({ onBack }) {
	const [selectedExecutionId, setSelectedExecutionId] = useState(null);
	const [interactiveMode, setInteractiveMode] = useState(false);
	const { theme } = useComponentTheme('executionList');
	const { renderCount } = usePerformanceMonitor('InteractiveExecutionList');

	// Load executions with optimization
	const { executions, loading, error, connectionStatus, refetch } =
		useExecutions({
			pollInterval: 2000,
			maxRetries: 3,
			enableStreaming: true
		});

	// Optimize execution data for display
	const optimizedExecutions = useOptimizedData(executions, [executions]);

	// Prepare execution options for Select component
	const executionOptions = useMemo(() => {
		return optimizedExecutions.map((execution) => ({
			label: `${execution.id} - ${execution.taskId || 'Unknown Task'} (${execution.statusColor || execution.status})`,
			value: execution.id,
			execution: execution
		}));
	}, [optimizedExecutions]);

	// Find selected execution
	const selectedExecution = useMemo(() => {
		return optimizedExecutions.find((exec) => exec.id === selectedExecutionId);
	}, [optimizedExecutions, selectedExecutionId]);

	// Handle keyboard input
	useInput((input, key) => {
		if (key.escape) {
			if (interactiveMode) {
				setInteractiveMode(false);
				setSelectedExecutionId(null);
			} else {
				onBack?.();
			}
		} else if (input === 'i') {
			setInteractiveMode(!interactiveMode);
		} else if (input === 'r') {
			refetch();
		}
	});

	// Handle execution selection
	const handleExecutionSelect = (selectedOption) => {
		setSelectedExecutionId(selectedOption.value);
	};

	if (loading && executions.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box alignItems="center">
					<Spinner />
					<Text marginLeft={1}>Loading executions...</Text>
				</Box>
			</Box>
		);
	}

	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<StatusMessage variant="error">
					Failed to load executions: {error}
				</StatusMessage>
				<Text marginTop={1} color={theme.colors?.muted || 'gray'}>
					Press 'r' to retry or ESC to go back
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" height="100%">
			{/* Header with mode indicator */}
			<Box
				paddingX={1}
				paddingY={1}
				borderStyle="single"
				borderColor={theme.colors?.border || 'gray'}
			>
				<Text bold color={theme.colors?.primary || 'cyan'}>
					📊 Execution Management
				</Text>
				<Box marginLeft={2}>
					<Badge color={interactiveMode ? 'green' : 'blue'}>
						{interactiveMode ? 'Interactive Mode' : 'List Mode'}
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
			<Box flexGrow={1}>
				{!interactiveMode ? (
					/* List Mode - Simple execution list */
					<Box flexDirection="column" padding={1}>
						<Text marginBottom={1}>
							Available Executions ({optimizedExecutions.length}):
						</Text>

						{optimizedExecutions.length === 0 ? (
							<Text color={theme.colors?.muted || 'gray'}>
								No executions found
							</Text>
						) : (
							optimizedExecutions.map((execution, index) => (
								<Box key={execution.id} marginBottom={1}>
									<Text color={theme.colors?.accent || 'yellow'}>
										{index + 1}.
									</Text>
									<Text marginLeft={1}>
										{execution.id} - {execution.taskId || 'Unknown'}
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
									{execution.progressPercent > 0 && (
										<Text marginLeft={2} color={theme.colors?.muted || 'gray'}>
											({execution.progressPercent}%)
										</Text>
									)}
								</Box>
							))
						)}
					</Box>
				) : (
					/* Interactive Mode - Split view with selection and details */
					<Box flexDirection="row" height="100%">
						{/* Left Panel - Execution Selection */}
						<Box
							width="40%"
							flexDirection="column"
							borderRight
							borderColor={theme.colors?.border || 'gray'}
							paddingRight={1}
						>
							<Text
								marginBottom={1}
								bold
								color={theme.colors?.accent || 'yellow'}
							>
								Select Execution:
							</Text>

							{executionOptions.length === 0 ? (
								<Text color={theme.colors?.muted || 'gray'}>
									No executions available
								</Text>
							) : (
								<Select
									options={executionOptions}
									onChange={handleExecutionSelect}
								/>
							)}
						</Box>

						{/* Right Panel - Execution Details */}
						<Box width="60%" paddingLeft={1}>
							<ExecutionDetailsPanel
								execution={selectedExecution}
								theme={theme}
							/>
						</Box>
					</Box>
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
					[i] Toggle Interactive Mode • [r] Refresh • [ESC]{' '}
					{interactiveMode ? 'Exit Interactive' : 'Back'}
				</Text>
			</Box>
		</Box>
	);
}
