/**
 * Polling Status Indicator Component
 */

import React from 'react';
import type { AppState } from '../types';

interface PollingStatusProps {
	polling: AppState['polling'];
	onRetry?: () => void;
}

export const PollingStatus: React.FC<PollingStatusProps> = ({
	polling,
	onRetry
}) => {
	const {
		isActive,
		errorCount,
		isOfflineMode,
		connectionStatus,
		reconnectAttempts,
		maxReconnectAttempts
	} = polling;

	if (isOfflineMode || connectionStatus === 'offline') {
		return (
			<div className="flex items-center gap-2">
				<div
					className="flex items-center gap-1 text-red-400"
					title="Offline mode - using cached data"
				>
					<div className="w-2 h-2 rounded-full bg-red-400" />
					<span className="text-xs">Offline</span>
				</div>
				<button
					onClick={onRetry}
					className="text-xs text-blue-400 hover:underline"
					title="Attempt to reconnect"
				>
					Retry
				</button>
			</div>
		);
	}

	if (connectionStatus === 'reconnecting') {
		return (
			<div
				className="flex items-center gap-1 text-yellow-400"
				title={`Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`}
			>
				<div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
				<span className="text-xs">Reconnecting</span>
			</div>
		);
	}

	if (errorCount > 0) {
		return (
			<div
				className="flex items-center gap-1 text-yellow-400"
				title={`${errorCount} polling error${errorCount > 1 ? 's' : ''}`}
			>
				<div className="w-2 h-2 rounded-full bg-yellow-400" />
				<span className="text-xs">Live (errors)</span>
			</div>
		);
	}

	if (isActive) {
		return (
			<div
				className="flex items-center gap-1 text-green-400"
				title="Live updates active"
			>
				<div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
				<span className="text-xs">Live</span>
			</div>
		);
	}

	return null;
};
