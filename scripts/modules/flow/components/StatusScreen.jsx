import React from 'react';
import { Box, Text } from 'ink';
import { style, gradient, getComponentTheme, getColor } from '../theme.js';

export const StatusScreen = ({ projectInfo, tasksInfo, modelsInfo, mcpInfo }) => {
	const taskTheme = getComponentTheme('taskList');
	const statusTheme = getComponentTheme('status');
	
	// Helper function to style status values
	const getStatusStyle = (status) => {
		const statusMap = {
			'active': 'state.success.primary',
			'connected': 'state.success.primary',
			'ready': 'state.success.primary',
			'configured': 'state.success.primary',
			'inactive': 'state.error.primary',
			'disconnected': 'state.error.primary',
			'not configured': 'state.warning.primary',
			'partial': 'state.warning.primary'
		};
		
		return statusMap[status?.toLowerCase()] || 'text.primary';
	};
	
	// Helper function to format task counts with semantic colors
	const formatTaskCount = (count, status) => {
		const color = taskTheme.status[status] || 'text.primary';
		return style(`${count}`, color);
	};
	
	return (
		<Box flexDirection="column" padding={1}>
			{/* Gradient Header */}
			<Box marginBottom={1}>
				<Text>
					{gradient('═══════════════════════════════════════════════════════════', ['primary', 'secondary'])}
				</Text>
			</Box>
			<Box justifyContent="center" marginBottom={1}>
				<Text>
					{gradient('Task Master Flow - Project Status', ['primary', 'accent'])}
				</Text>
			</Box>
			<Box marginBottom={2}>
				<Text>
					{gradient('═══════════════════════════════════════════════════════════', ['secondary', 'primary'])}
				</Text>
			</Box>

			{/* Project Information */}
			<Box flexDirection="column" marginBottom={2}>
				<Text bold>{style('📁 Project Information', 'primary')}</Text>
				<Box marginLeft={2} flexDirection="column">
					<Box>
						<Text>{style('Name: ', 'text.secondary')}</Text>
						<Text>{style(projectInfo?.name || 'Unknown', 'text.primary')}</Text>
					</Box>
					<Box>
						<Text>{style('Path: ', 'text.secondary')}</Text>
						<Text>{style(projectInfo?.path || 'N/A', 'text.tertiary')}</Text>
					</Box>
					<Box>
						<Text>{style('Current Tag: ', 'text.secondary')}</Text>
						<Text>{style(projectInfo?.currentTag || 'master', 'accent')}</Text>
					</Box>
					<Box>
						<Text>{style('Git Branch: ', 'text.secondary')}</Text>
						<Text>{style(projectInfo?.gitBranch || 'N/A', getStatusStyle(projectInfo?.gitStatus || 'inactive'))}</Text>
					</Box>
				</Box>
			</Box>

			{/* Tasks Overview */}
			<Box flexDirection="column" marginBottom={2}>
				<Text bold>{style('📋 Tasks Overview', 'primary')}</Text>
				<Box marginLeft={2} flexDirection="column">
					<Box>
						<Text>{style('Total Tasks: ', 'text.secondary')}</Text>
						<Text>{style(tasksInfo?.total?.toString() || '0', 'text.primary')}</Text>
					</Box>
					<Box>
						<Text>{style('✓ Done: ', 'text.secondary')}</Text>
						{formatTaskCount(tasksInfo?.done || 0, 'done')}
					</Box>
					<Box>
						<Text>{style('⏳ In Progress: ', 'text.secondary')}</Text>
						{formatTaskCount(tasksInfo?.inProgress || 0, 'in-progress')}
					</Box>
					<Box>
						<Text>{style('⏸ Pending: ', 'text.secondary')}</Text>
						{formatTaskCount(tasksInfo?.pending || 0, 'pending')}
					</Box>
					<Box>
						<Text>{style('🚫 Blocked: ', 'text.secondary')}</Text>
						{formatTaskCount(tasksInfo?.blocked || 0, 'blocked')}
					</Box>
					{tasksInfo?.nextTask && (
						<Box marginTop={1}>
							<Text>{style('Next Task: ', 'text.secondary')}</Text>
							<Text>{style(`#${tasksInfo.nextTask.id} - ${tasksInfo.nextTask.title}`, 'accent')}</Text>
						</Box>
					)}
				</Box>
			</Box>

			{/* AI Models Configuration */}
			<Box flexDirection="column" marginBottom={2}>
				<Text bold>{style('🤖 AI Models', 'primary')}</Text>
				<Box marginLeft={2} flexDirection="column">
					<Box>
						<Text>{style('Main Model: ', 'text.secondary')}</Text>
						<Text>{style(
							modelsInfo?.main || 'Not configured', 
							getStatusStyle(modelsInfo?.main ? 'configured' : 'not configured')
						)}</Text>
					</Box>
					<Box>
						<Text>{style('Research Model: ', 'text.secondary')}</Text>
						<Text>{style(
							modelsInfo?.research || 'Not configured',
							getStatusStyle(modelsInfo?.research ? 'configured' : 'not configured')
						)}</Text>
					</Box>
					<Box>
						<Text>{style('Fallback Model: ', 'text.secondary')}</Text>
						<Text>{style(
							modelsInfo?.fallback || 'Not configured',
							getStatusStyle(modelsInfo?.fallback ? 'configured' : 'not configured')
						)}</Text>
					</Box>
					<Box marginTop={1}>
						<Text>{style('API Keys Status: ', 'text.secondary')}</Text>
						<Text>{style(
							modelsInfo?.apiKeysStatus || 'Unknown',
							getStatusStyle(modelsInfo?.apiKeysStatus || 'inactive')
						)}</Text>
					</Box>
				</Box>
			</Box>

			{/* MCP Servers */}
			{mcpInfo && mcpInfo.servers && mcpInfo.servers.length > 0 && (
				<Box flexDirection="column" marginBottom={2}>
					<Text bold>{style('🔌 MCP Servers', 'primary')}</Text>
					<Box marginLeft={2} flexDirection="column">
						{mcpInfo.servers.map((server, idx) => (
							<Box key={`server-${server.name}-${idx}`}>
								<Text>{style(`${server.name}: `, 'text.secondary')}</Text>
								<Text>{style(
									server.status || 'Unknown',
									getStatusStyle(server.status || 'inactive')
								)}</Text>
							</Box>
						))}
						<Box marginTop={1}>
							<Text>{style('Total Servers: ', 'text.secondary')}</Text>
							<Text>{style(mcpInfo.servers.length.toString(), 'text.primary')}</Text>
						</Box>
					</Box>
				</Box>
			)}

			{/* Footer with gradient */}
			<Box marginTop={1}>
				<Text>
					{gradient('═══════════════════════════════════════════════════════════', ['primary', 'secondary'])}
				</Text>
			</Box>
			<Box justifyContent="center" marginTop={1}>
				<Text>{style('Press ESC to return to main menu', 'text.tertiary')}</Text>
			</Box>
		</Box>
	);
};
