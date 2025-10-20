import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { createTaskMasterCore, type TaskMasterCore } from '@tm/core';

/**
 * System message type
 */
export type MessageType = 'error' | 'warning' | 'info' | 'success';

/**
 * System message interface
 */
export interface SystemMessage {
	id: string;
	type: MessageType;
	content: string;
	timestamp: string;
	autoDismiss?: boolean;
	dismissAfter?: number; // milliseconds
}

export interface StatusBarProps {
	/**
	 * Project root path for TaskMasterCore initialization
	 */
	projectPath: string;

	/**
	 * Optional tag to filter statistics
	 */
	tag?: string;

	/**
	 * Optional TaskMasterCore instance (for reuse)
	 */
	tmCore?: TaskMasterCore;

	/**
	 * Show exit instructions
	 */
	showExitInstructions?: boolean;

	/**
	 * Custom exit key combination text
	 */
	exitKeyText?: string;

	/**
	 * Initial system messages
	 */
	initialMessages?: SystemMessage[];

	/**
	 * Callback when message is dismissed
	 */
	onMessageDismissed?: (messageId: string) => void;

	/**
	 * Auto-dismiss duration for messages (default: 5000ms)
	 */
	defaultAutoDismissDelay?: number;

	/**
	 * Enable live updates via Task Watcher
	 */
	enableLiveUpdates?: boolean;

	/**
	 * Refresh interval in milliseconds (default: 10000ms)
	 * Only used if live updates are disabled
	 */
	refreshInterval?: number;
}

interface TaskCounts {
	total: number;
	inProgress: number;
	completed: number;
	pending: number;
	review: number;
	blocked: number;
}

/**
 * Status Bar Component
 * Displays persistent global task statistics at the bottom of the terminal
 */
export const StatusBar: React.FC<StatusBarProps> = ({
	projectPath,
	tag,
	tmCore,
	showExitInstructions = true,
	exitKeyText = 'Ctrl+C',
	initialMessages = [],
	onMessageDismissed,
	defaultAutoDismissDelay = 5000,
	enableLiveUpdates = true,
	refreshInterval = 10000
}) => {
	const [counts, setCounts] = useState<TaskCounts>({
		total: 0,
		inProgress: 0,
		completed: 0,
		pending: 0,
		review: 0,
		blocked: 0
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [core, setCore] = useState<TaskMasterCore | null>(tmCore || null);
	const [messages, setMessages] = useState<SystemMessage[]>(initialMessages);

	useEffect(() => {
		let mounted = true;

		const fetchTaskStats = async () => {
			try {
				setIsLoading(true);
				setError(null);

				// Initialize TaskMasterCore if not provided
				let coreInstance = tmCore;
				if (!coreInstance) {
					coreInstance = await createTaskMasterCore({ projectPath });
					if (mounted) {
						setCore(coreInstance);
					}
				}

				// Fetch task statistics
				const stats = await coreInstance.getTaskStats(tag);

				if (mounted) {
					setCounts({
						total: stats.total,
						inProgress: stats.byStatus['in-progress'] || 0,
						completed: stats.byStatus.done + (stats.byStatus.completed || 0),
						pending: stats.byStatus.pending || 0,
						review: stats.byStatus.review || 0,
						blocked: stats.blocked || 0
					});
					setIsLoading(false);
				}
			} catch (err) {
				if (mounted) {
					setError(
						err instanceof Error ? err.message : 'Failed to fetch stats'
					);
					setIsLoading(false);
				}
			}
		};

		fetchTaskStats();

		// Cleanup
		return () => {
			mounted = false;
			if (core && !tmCore) {
				core.close().catch(() => {
					// Ignore cleanup errors
				});
			}
		};
	}, [projectPath, tag, tmCore, core]);

	// Set up Task Watcher for live updates
	useEffect(() => {
		if (!enableLiveUpdates || !core) {
			// If live updates disabled, use polling instead
			if (!enableLiveUpdates && refreshInterval > 0) {
				const interval = setInterval(async () => {
					try {
						const stats = await core!.getTaskStats(tag);
						setCounts({
							total: stats.total,
							inProgress: stats.byStatus['in-progress'] || 0,
							completed: stats.byStatus.done + (stats.byStatus.completed || 0),
							pending: stats.byStatus.pending || 0,
							review: stats.byStatus.review || 0,
							blocked: stats.blocked || 0
						});
					} catch (err) {
						// Ignore refresh errors
					}
				}, refreshInterval);

				return () => clearInterval(interval);
			}
			return undefined;
		}

		let mounted = true;

		const setupWatcher = async () => {
			try {
				// Get storage instance to access watcher
				const storage = (core as any).taskService?.storage;
				if (!storage || typeof storage.startWatching !== 'function') {
					return undefined;
				}

				// Check if already watching
				if (storage.isWatching?.()) {
					return undefined;
				}

				// Start watching
				await storage.startWatching();

				// Set up event handler for changes
				const taskWatcher = storage.taskWatcher;
				if (taskWatcher) {
					const handleChange = () => {
						if (mounted) {
							// Refetch stats on any change
							core
								.getTaskStats(tag)
								.then((stats) => {
									if (mounted) {
										setCounts({
											total: stats.total,
											inProgress: stats.byStatus['in-progress'] || 0,
											completed:
												stats.byStatus.done + (stats.byStatus.completed || 0),
											pending: stats.byStatus.pending || 0,
											review: stats.byStatus.review || 0,
											blocked: stats.blocked || 0
										});
									}
								})
								.catch(() => {
									// Ignore refetch errors
								});
						}
					};

					taskWatcher.onChange(handleChange);

					// Return cleanup function
					return () => {
						taskWatcher.removeListener('change', handleChange);
					};
				}
				return undefined;
			} catch (err) {
				// Ignore watcher setup errors
				return undefined;
			}
		};

		const cleanup = setupWatcher();

		return () => {
			mounted = false;
			cleanup?.then((cleanupFn) => cleanupFn?.());
		};
	}, [core, enableLiveUpdates, tag, refreshInterval]);

	// Auto-dismiss messages
	useEffect(() => {
		const timers: NodeJS.Timeout[] = [];

		messages.forEach((message) => {
			if (message.autoDismiss !== false) {
				const delay = message.dismissAfter || defaultAutoDismissDelay;
				const timer = setTimeout(() => {
					dismissMessage(message.id);
				}, delay);
				timers.push(timer);
			}
		});

		return () => {
			timers.forEach((timer) => clearTimeout(timer));
		};
	}, [messages, defaultAutoDismissDelay]);

	// Dismiss a message
	const dismissMessage = useCallback(
		(messageId: string) => {
			setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
			if (onMessageDismissed) {
				onMessageDismissed(messageId);
			}
		},
		[onMessageDismissed]
	);

	// Get message color based on type
	const getMessageColor = (type: MessageType): string => {
		switch (type) {
			case 'error':
				return 'red';
			case 'warning':
				return 'yellow';
			case 'success':
				return 'green';
			case 'info':
			default:
				return 'blue';
		}
	};

	// Get message icon based on type
	const getMessageIcon = (type: MessageType): string => {
		switch (type) {
			case 'error':
				return '✗';
			case 'warning':
				return '⚠';
			case 'success':
				return '✓';
			case 'info':
			default:
				return 'ℹ';
		}
	};

	if (isLoading) {
		return (
			<Box borderStyle="single" borderColor="gray" paddingX={1}>
				<Text dimColor>Loading status...</Text>
			</Box>
		);
	}

	if (error) {
		return (
			<Box borderStyle="single" borderColor="red" paddingX={1}>
				<Text color="red">Error: {error}</Text>
			</Box>
		);
	}

	// Calculate progress percentage
	const progressPercentage =
		counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;

	// Get current message to display (show only the most recent)
	const currentMessage =
		messages.length > 0 ? messages[messages.length - 1] : null;

	return (
		<Box flexDirection="column">
			{/* System Messages */}
			{currentMessage && (
				<Box
					borderStyle="single"
					borderColor={getMessageColor(currentMessage.type)}
					paddingX={1}
					marginBottom={0}
				>
					<Text color={getMessageColor(currentMessage.type)}>
						{getMessageIcon(currentMessage.type)}{' '}
					</Text>
					<Text>{currentMessage.content}</Text>
					{messages.length > 1 && (
						<Text dimColor> (+{messages.length - 1} more)</Text>
					)}
				</Box>
			)}

			{/* Status Bar */}
			<Box
				borderStyle="single"
				borderColor={
					currentMessage ? getMessageColor(currentMessage.type) : 'blue'
				}
				paddingX={1}
				flexDirection="row"
				justifyContent="space-between"
			>
				{/* Left side - Task counts */}
				<Box flexDirection="row">
					<Box marginRight={2}>
						<Text dimColor>Total: </Text>
						<Text bold>{counts.total}</Text>
					</Box>

					<Box marginRight={2}>
						<Text dimColor>Progress: </Text>
						<Text bold color="cyan">
							{progressPercentage}%
						</Text>
					</Box>

					{counts.inProgress > 0 && (
						<Box marginRight={2}>
							<Text color="yellow">● </Text>
							<Text>In Progress: {counts.inProgress}</Text>
						</Box>
					)}

					{counts.completed > 0 && (
						<Box marginRight={2}>
							<Text color="green">● </Text>
							<Text>Completed: {counts.completed}</Text>
						</Box>
					)}

					{counts.pending > 0 && (
						<Box marginRight={2}>
							<Text color="blue">● </Text>
							<Text>Pending: {counts.pending}</Text>
						</Box>
					)}

					{counts.review > 0 && (
						<Box marginRight={2}>
							<Text color="cyan">● </Text>
							<Text>Review: {counts.review}</Text>
						</Box>
					)}

					{counts.blocked > 0 && (
						<Box marginRight={2}>
							<Text color="magenta">⚠ </Text>
							<Text>Blocked: {counts.blocked}</Text>
						</Box>
					)}
				</Box>

				{/* Right side - Exit instructions */}
				{showExitInstructions && (
					<Box>
						<Text dimColor>
							Press{' '}
							<Text color="yellow" bold>
								{exitKeyText}
							</Text>{' '}
							to exit
						</Text>
					</Box>
				)}
			</Box>
		</Box>
	);
};

export default StatusBar;
