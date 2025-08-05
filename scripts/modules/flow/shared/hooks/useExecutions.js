import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useThrottledCallback } from './useOptimizedData.js';

export function useExecutions(options = {}) {
	const [executions, setExecutions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [connectionStatus, setConnectionStatus] = useState('connecting');
	const [lastRefresh, setLastRefresh] = useState(null);

	// Prevent state updates after unmount
	const isMountedRef = useRef(true);
	const pollIntervalRef = useRef(null);

	// Extract config values to stable references
	const pollInterval = options.pollInterval || 2000;
	const maxRetries = options.maxRetries || 3;
	const statusFilter = options.statusFilter;

	// Throttled execution loading to prevent excessive API calls
	const throttledSetExecutions = useThrottledCallback((executionList) => {
		if (isMountedRef.current) {
			setExecutions(executionList);
			setLastRefresh(new Date().toISOString());
		}
	}, 500);

	const loadExecutions = useCallback(
		async (retryCount = 0) => {
			try {
				setConnectionStatus('loading');

				// Use existing execution service - import dynamically to avoid circular deps
				const { executionService } = await import(
					'../services/execution.service.js'
				);

				// Use existing execution service
				const filters = statusFilter ? { status: statusFilter } : {};
				const executionList = executionService.listExecutions(filters);

				if (isMountedRef.current) {
					throttledSetExecutions(executionList);
					setError(null);
					setConnectionStatus('connected');
					setLoading(false);
				}
			} catch (err) {
				if (!isMountedRef.current) return;

				console.error('Failed to load executions:', err);

				if (retryCount < maxRetries) {
					setConnectionStatus('retrying');
					setTimeout(
						() => loadExecutions(retryCount + 1),
						1000 * (retryCount + 1)
					);
				} else {
					setError(err.message);
					setConnectionStatus('error');
					setLoading(false);
				}
			}
		},
		[statusFilter, maxRetries, throttledSetExecutions]
	);

	useEffect(() => {
		isMountedRef.current = true;

		// Initial load
		loadExecutions();

		// Set up polling
		pollIntervalRef.current = setInterval(() => {
			if (isMountedRef.current) {
				loadExecutions();
			}
		}, pollInterval);

		return () => {
			isMountedRef.current = false;
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
			}
		};
	}, [loadExecutions, pollInterval]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// Memoized execution statistics for performance
	const executionStats = useMemo(() => {
		const total = executions.length;
		const running = executions.filter((e) => e.status === 'running').length;
		const completed = executions.filter((e) => e.status === 'completed').length;
		const failed = executions.filter((e) => e.status === 'failed').length;
		const pending = executions.filter((e) => e.status === 'pending').length;

		const avgProgress =
			executions.length > 0
				? executions.reduce((sum, e) => sum + (e.progress || 0), 0) /
					executions.length
				: 0;

		const activeExecutions = executions.filter((e) =>
			['running', 'in-progress'].includes(e.status)
		);

		return {
			total,
			running,
			completed,
			failed,
			pending,
			avgProgress: Math.round(avgProgress),
			activeCount: activeExecutions.length,
			hasActive: activeExecutions.length > 0
		};
	}, [executions]);

	// Manual refresh function with immediate update
	const manualRefresh = useCallback(async () => {
		setLoading(true);
		await loadExecutions();
	}, [loadExecutions]);

	return {
		executions,
		loading,
		error,
		connectionStatus,
		lastRefresh,
		executionStats,
		refetch: () => loadExecutions(),
		manualRefresh
	};
}

export function useStreamingExecution(executionId) {
	const [messages, setMessages] = useState([]);
	const [status, setStatus] = useState('pending');

	useEffect(() => {
		if (!executionId) return;

		// Mock streaming messages for now
		const mockMessages = [
			{
				id: 1,
				timestamp: new Date().toISOString(),
				type: 'INFO',
				data: { message: 'Execution started', level: 'info' }
			},
			{
				id: 2,
				timestamp: new Date(Date.now() - 5000).toISOString(),
				type: 'STATUS',
				data: { status: 'running', progress: 0.3 }
			}
		];

		setMessages(mockMessages);
		setStatus('running');

		// TODO: Integrate with real streaming when available
		// const setupStream = async () => {
		//   const stream = await backend.streamExecution?.(executionId);
		//   // Process stream messages
		// };

		return () => {
			// Cleanup streaming connection
		};
	}, [executionId]);

	return { messages, status };
}
