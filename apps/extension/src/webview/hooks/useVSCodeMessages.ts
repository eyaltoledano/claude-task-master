/**
 * Hook for handling VS Code messages
 */

import { useEffect, useCallback, useRef } from 'react';
import type { AppState, AppAction } from '../types';
import { createToast } from '../utils/toast';
import { REQUEST_TIMEOUT } from '../constants';

interface PendingRequest {
	resolve: Function;
	reject: Function;
	timeout: NodeJS.Timeout;
}

let requestCounter = 0;

export const useVSCodeMessages = (
	vscode: ReturnType<NonNullable<typeof window.acquireVsCodeApi>> | undefined,
	state: AppState,
	dispatch: React.Dispatch<AppAction>
) => {
	const pendingRequestsRef = useRef(new Map<string, PendingRequest>());

	const sendMessage = useCallback(
		(message: any): Promise<any> => {
			if (!vscode) {
				return Promise.reject(new Error('VS Code API not available'));
			}

			return new Promise((resolve, reject) => {
				const requestId = `req_${++requestCounter}_${Date.now()}`;

				const timeout = setTimeout(() => {
					pendingRequestsRef.current.delete(requestId);
					reject(new Error('Request timeout'));
				}, REQUEST_TIMEOUT);

				pendingRequestsRef.current.set(requestId, { resolve, reject, timeout });

				vscode.postMessage({
					...message,
					requestId
				});
			});
		},
		[vscode]
	);

	useEffect(() => {
		if (!vscode) return;

		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			console.log('📥 Received message:', message.type, message);

			// Handle request/response pattern
			if (message.requestId) {
				const pending = pendingRequestsRef.current.get(message.requestId);
				if (pending) {
					clearTimeout(pending.timeout);
					pendingRequestsRef.current.delete(message.requestId);

					if (message.type === 'response') {
						// Check for explicit success field, default to true if data exists
						const isSuccess =
							message.success !== undefined
								? message.success
								: message.data !== undefined;
						if (isSuccess) {
							pending.resolve(message.data);
						} else {
							pending.reject(new Error(message.error || 'Request failed'));
						}
					} else if (message.type === 'error') {
						pending.reject(new Error(message.error || 'Request failed'));
					}
				}
				return;
			}

			// Handle other message types
			switch (message.type) {
				case 'connectionStatus':
					dispatch({
						type: 'SET_CONNECTION_STATUS',
						payload: {
							isConnected: message.data?.isConnected || false,
							status: message.data?.status || 'Unknown'
						}
					});
					break;

				case 'tasksData':
					console.log('📋 Received tasks data:', message.data);
					dispatch({ type: 'SET_TASKS', payload: message.data });
					break;

				case 'pollingStatus':
					dispatch({
						type: 'SET_POLLING_STATUS',
						payload: {
							isActive: message.isActive,
							errorCount: message.errorCount || 0
						}
					});
					break;

				case 'pollingUpdate':
					console.log('🔄 Polling update received:', {
						tasksCount: message.data?.length,
						userInteracting: state.polling.isUserInteracting,
						offlineMode: state.polling.isOfflineMode
					});

					if (
						!state.polling.isUserInteracting &&
						!state.polling.isOfflineMode
					) {
						dispatch({
							type: 'TASKS_UPDATED_FROM_POLLING',
							payload: message.data
						});
					}
					break;

				case 'networkStatus':
					dispatch({
						type: 'SET_NETWORK_STATUS',
						payload: message.data
					});
					break;

				case 'cachedTasks':
					console.log('📦 Received cached tasks:', message.data);
					dispatch({
						type: 'LOAD_CACHED_TASKS',
						payload: message.data
					});
					break;

				case 'errorNotification':
					handleErrorNotification(message, dispatch);
					break;

				case 'error':
					handleGeneralError(message, dispatch);
					break;

				case 'reactError':
					console.log('🔥 React error reported to extension:', message);
					dispatch({
						type: 'ADD_TOAST',
						payload: createToast(
							'error',
							'UI Error',
							'A component error occurred. The extension may need to be reloaded.',
							10000
						)
					});
					break;

				default:
					console.log('❓ Unknown message type:', message.type);
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, [vscode, state.polling, dispatch]);

	return { sendMessage };
};

function handleErrorNotification(
	message: any,
	dispatch: React.Dispatch<AppAction>
) {
	console.log('📨 Error notification received:', message);
	const errorData = message.data;

	// Map severity to toast type
	let toastType: 'error' | 'warning' | 'info' = 'error';
	if (errorData.severity === 'high' || errorData.severity === 'critical') {
		toastType = 'error';
	} else if (errorData.severity === 'medium') {
		toastType = 'warning';
	} else {
		toastType = 'info';
	}

	// Create appropriate toast based on error category
	const title =
		errorData.category === 'network'
			? 'Network Error'
			: errorData.category === 'mcp_connection'
				? 'Connection Error'
				: errorData.category === 'task_loading'
					? 'Task Loading Error'
					: errorData.category === 'ui_rendering'
						? 'UI Error'
						: 'Error';

	dispatch({
		type: 'ADD_TOAST',
		payload: createToast(
			toastType,
			title,
			errorData.message,
			errorData.duration || (toastType === 'error' ? 8000 : 5000)
		)
	});
}

function handleGeneralError(message: any, dispatch: React.Dispatch<AppAction>) {
	console.log('❌ General error from extension:', message);
	const errorTitle =
		message.errorType === 'connection' ? 'Connection Error' : 'Error';
	const errorMessage = message.error || 'An unknown error occurred';

	dispatch({
		type: 'SET_ERROR',
		payload: errorMessage
	});

	dispatch({
		type: 'ADD_TOAST',
		payload: createToast('error', errorTitle, errorMessage, 8000)
	});

	// Set offline mode for connection errors
	if (message.errorType === 'connection') {
		dispatch({
			type: 'SET_NETWORK_STATUS',
			payload: {
				isOfflineMode: true,
				connectionStatus: 'offline',
				reconnectAttempts: 0
			}
		});
	}
}
