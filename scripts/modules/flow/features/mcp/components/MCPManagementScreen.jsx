import React from 'react';
import { Box, Text } from 'ink';
import { useMCPManager } from '../hooks/useMCPManager.js';
import { ServerList } from './ServerList.jsx';
import { ServerDetails } from './ServerDetails.jsx';
import { ToolDetails } from './ToolDetails.jsx';
import { AddServerForm } from './AddServerForm.jsx';
import { theme } from '../../../shared/theme/theme.js';

export function MCPManagementScreen() {
	const {
		servers,
		selectedIndex,
		loading,
		error,
		showAddForm,
		view,
		selectedServer,
		selectedTool,
		serverTools,
		scrollOffset,
		viewportHeight
	} = useMCPManager();

	if (loading) {
		return (
			<Box flexDirection="column" height="100%">
				<Box justifyContent="center" alignItems="center" height="100%">
					<Text color={theme.accent}>Loading MCP servers...</Text>
				</Box>
			</Box>
		);
	}

	if (showAddForm) {
		return <AddServerForm />;
	}

	if (view === 'tool-details' && selectedTool) {
		return (
			<ToolDetails
				selectedTool={selectedTool}
				selectedServer={selectedServer}
			/>
		);
	}

	if (view === 'server-details' && selectedServer) {
		return (
			<ServerDetails
				selectedServer={selectedServer}
				serverTools={serverTools}
				selectedIndex={selectedIndex}
				scrollOffset={scrollOffset}
				viewportHeight={viewportHeight}
			/>
		);
	}

	return (
		<ServerList
			servers={servers}
			selectedIndex={selectedIndex}
			error={error}
			scrollOffset={scrollOffset}
			viewportHeight={viewportHeight}
		/>
	);
}
