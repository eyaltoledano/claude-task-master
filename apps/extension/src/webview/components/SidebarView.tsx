import React, { useState, useEffect } from 'react';
import { TaskMasterLogo } from '../../components/TaskMasterLogo';

interface SidebarViewProps {
	initialConnectionStatus?: boolean;
}

// Acquire VS Code API only once globally to avoid "already acquired" error
const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;

export const SidebarView: React.FC<SidebarViewProps> = ({
	initialConnectionStatus = false
}) => {
	const [isConnected, setIsConnected] = useState(initialConnectionStatus);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === 'connectionStatus') {
				setIsConnected(message.data.isConnected);
			}
		};

		window.addEventListener('message', handleMessage);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	}, []);

	const handleOpenBoard = () => {
		vscode?.postMessage({ command: 'openBoard' });
	};

	return (
		<div className="h-full flex items-center justify-center p-6">
			<div className="text-center">
				<TaskMasterLogo className="w-20 h-20 mx-auto mb-5 opacity-80 text-vscode-foreground" />

				<h2 className="text-xl font-semibold mb-6 text-vscode-foreground">
					TaskMaster
				</h2>

				<button
					onClick={handleOpenBoard}
					className="w-full px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground transition-colors text-sm font-medium"
				>
					Open Kanban Board
				</button>
			</div>
		</div>
	);
};
