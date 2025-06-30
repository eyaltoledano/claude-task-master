import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Toast } from './Toast.jsx';
import { useComponentTheme, useKeypress } from '../hooks/index.js';
import { backgroundOperations } from '../services/BackgroundOperationsManager.js';
import { formatDistanceToNow } from 'date-fns';

export function BackgroundOperationsScreen({ onBack }) {
	const [operations, setOperations] = useState([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [refresh, setRefresh] = useState(0);
	const [success, setSuccess] = useState(null);
	const { theme } = useComponentTheme('backgroundOperations');

	// Load operations and listen for updates
	useEffect(() => {
		const loadOperations = () => {
			const ops = backgroundOperations.getAllOperations()
				.filter(op => op.operation.type && op.operation.type.startsWith('claude-code-'))
				.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
			setOperations(ops);
		};

		// Initial load
		loadOperations();

		// Listen for updates
		const handleUpdate = () => {
			loadOperations();
		};

		backgroundOperations.on('operation-started', handleUpdate);
		backgroundOperations.on('operation-completed', handleUpdate);
		backgroundOperations.on('operation-failed', handleUpdate);
		backgroundOperations.on('operation-aborted', handleUpdate);
		backgroundOperations.on('operation-message', handleUpdate);

		// Auto-refresh every 2 seconds for running operations
		const interval = setInterval(() => {
			const hasRunning = backgroundOperations.hasRunningOperations();
			if (hasRunning) {
				setRefresh(r => r + 1);
				loadOperations();
			}
		}, 2000);

		return () => {
			backgroundOperations.off('operation-started', handleUpdate);
			backgroundOperations.off('operation-completed', handleUpdate);
			backgroundOperations.off('operation-failed', handleUpdate);
			backgroundOperations.off('operation-aborted', handleUpdate);
			backgroundOperations.off('operation-message', handleUpdate);
			clearInterval(interval);
		};
	}, []);

	const handleAbort = () => {
		const selected = operations[selectedIndex];
		if (selected && selected.status === 'running') {
			const aborted = backgroundOperations.abortOperation(selected.id);
			if (aborted) {
				setSuccess('Operation aborted successfully');
			}
		}
	};

	const handlers = {
		escape: onBack,
		q: onBack,
		up: () => setSelectedIndex(Math.max(0, selectedIndex - 1)),
		down: () => setSelectedIndex(Math.min(operations.length - 1, selectedIndex + 1)),
		a: handleAbort,
		r: () => setRefresh(r => r + 1) // Manual refresh
	};

	useKeypress(handlers);

	// Format operation for display
	const formatOperation = (op, index) => {
		const isSelected = index === selectedIndex;
		const metadata = op.operation.metadata || {};
		
		// Status with icon
		let statusDisplay;
		switch (op.status) {
			case 'running':
				statusDisplay = <Text color={theme.warning}><Spinner type="dots" /> Running</Text>;
				break;
			case 'completed':
				statusDisplay = <Text color={theme.success}>✓ Completed</Text>;
				break;
			case 'failed':
				statusDisplay = <Text color={theme.error}>✗ Failed</Text>;
				break;
			case 'aborted':
				statusDisplay = <Text color={theme.textDim}>⚠ Aborted</Text>;
				break;
			default:
				statusDisplay = <Text>{op.status}</Text>;
		}

		// Time display
		const timeAgo = formatDistanceToNow(new Date(op.startTime), { addSuffix: true });
		
		// Task info
		const taskInfo = metadata.taskId ? `Task ${metadata.taskId}` : 'General';
		
		// Message count
		const messageCount = op.messages.length;

		return (
			<Box
				key={op.id}
				paddingTop={index === 0 ? 0 : 1}
				flexDirection="column"
			>
				<Box>
					<Box width={3}>
						<Text color={isSelected ? theme.accent : theme.textDim}>
							{isSelected ? '▸' : ' '}
						</Text>
					</Box>
					<Box width={40}>
						<Text color={isSelected ? theme.accent : theme.text}>
							{op.id.slice(0, 8)}... - {taskInfo}
						</Text>
					</Box>
					<Box width={20}>
						{statusDisplay}
					</Box>
					<Box width={20}>
						<Text color={theme.textDim}>{timeAgo}</Text>
					</Box>
					<Box width={15}>
						<Text color={theme.textDim}>{messageCount} msgs</Text>
					</Box>
				</Box>
				
				{/* Show details for selected operation */}
				{isSelected && (
					<Box marginLeft={3} marginTop={1} flexDirection="column">
						{metadata.taskTitle && (
							<Text color={theme.textDim}>
								Title: {metadata.taskTitle}
							</Text>
						)}
						{op.error && (
							<Text color={theme.error}>
								Error: {op.error}
							</Text>
						)}
						{op.result && op.result.totalCost !== undefined && (
							<Text color={theme.textDim}>
								Cost: ${op.result.totalCost.toFixed(4)}
							</Text>
						)}
						{op.status === 'running' && op.messages.length > 0 && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>
									Latest: {getLatestMessage(op.messages)}
								</Text>
							</Box>
						)}
					</Box>
				)}
			</Box>
		);
	};

	const getLatestMessage = (messages) => {
		const lastMessage = messages[messages.length - 1];
		if (!lastMessage) return 'No messages';
		
		if (lastMessage.type === 'assistant' && lastMessage.message?.content?.[0]?.text) {
			const text = lastMessage.message.content[0].text;
			return text.length > 60 ? text.slice(0, 60) + '...' : text;
		}
		
		return `${lastMessage.type} message`;
	};

	const runningOps = operations.filter(op => op.status === 'running').length;
	const hasOperations = operations.length > 0;

	return (
		<Box flexDirection="column" padding={1}>
			{/* Header */}
			<Box marginBottom={2} flexDirection="column">
				<Box marginBottom={1}>
					<Text color={theme.accent} bold>
						Background Operations
					</Text>
					{runningOps > 0 && (
						<Box marginLeft={2}>
							<Text color={theme.warning}>
								({runningOps} running)
							</Text>
						</Box>
					)}
				</Box>
				<Text color={theme.textDim}>
					Monitor and manage Claude Code operations running in the background
				</Text>
			</Box>

			{/* Operations List */}
			{hasOperations ? (
				<Box flexDirection="column" marginBottom={2}>
					{operations.map((op, index) => formatOperation(op, index))}
				</Box>
			) : (
				<Box marginBottom={2}>
					<Text color={theme.textDim}>
						No background operations. Start a Claude Code task and choose "Run in Background".
					</Text>
				</Box>
			)}

			{/* Controls */}
			<Box marginTop={2} flexDirection="column">
				<Text color={theme.textDim}>Controls:</Text>
				<Box marginLeft={2} flexDirection="column">
					<Text color={theme.textDim}>↑/↓ - Navigate operations</Text>
					{selectedIndex < operations.length && operations[selectedIndex]?.status === 'running' && (
						<Text color={theme.textDim}>A - Abort selected operation</Text>
					)}
					<Text color={theme.textDim}>R - Refresh</Text>
					<Text color={theme.textDim}>Q/Esc - Back to menu</Text>
				</Box>
			</Box>

			{/* Toast notifications */}
			{success && (
				<Toast
					type="success"
					message={success}
					onDismiss={() => setSuccess(null)}
				/>
			)}
		</Box>
	);
} 