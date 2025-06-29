import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { connectionPool } from '../mcp/connection-pool.js';
import { MCPToolViewer } from './MCPToolViewer.jsx';
import { theme } from '../theme.js';

export function MCPServerDetails({ server, onBack, onEdit, onUse, log }) {
	const [tools, setTools] = useState([]);
	const [filteredTools, setFilteredTools] = useState([]);
	const [selectedToolIndex, setSelectedToolIndex] = useState(0);
	const [isLoadingTools, setIsLoadingTools] = useState(false);
	const [error, setError] = useState(null);
	const [showToolDetails, setShowToolDetails] = useState(false);
	const [connectionStatus, setConnectionStatus] = useState(server.status);
	const [searchMode, setSearchMode] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	useEffect(() => {
		if (connectionStatus === 'active') {
			loadTools();
		}
	}, [connectionStatus]);

	useEffect(() => {
		if (searchQuery) {
			const filtered = tools.filter(
				(tool) =>
					tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					(tool.description &&
						tool.description.toLowerCase().includes(searchQuery.toLowerCase()))
			);
			setFilteredTools(filtered);
			setSelectedToolIndex(0);
		} else {
			setFilteredTools(tools);
		}
	}, [searchQuery, tools]);

	const loadTools = async () => {
		try {
			setIsLoadingTools(true);
			const toolList = await connectionPool.listTools(server.id);
			setTools(toolList);
			setError(null);
		} catch (err) {
			setError(err.message);
		} finally {
			setIsLoadingTools(false);
		}
	};

	const handleConnect = async () => {
		try {
			setConnectionStatus('connecting');
			await connectionPool.connect(server, log);
			setConnectionStatus('active');
			await loadTools();
		} catch (err) {
			setConnectionStatus('error');
			setError(`Failed to connect: ${err.message}`);
		}
	};

	const handleDisconnect = async () => {
		try {
			await connectionPool.disconnect(server.id);
			setConnectionStatus('inactive');
			setTools([]);
		} catch (err) {
			setError(`Failed to disconnect: ${err.message}`);
		}
	};

	useInput((input, key) => {
		if (showToolDetails) return;

		if (searchMode) {
			if (key.escape) {
				setSearchMode(false);
				setSearchQuery('');
			}
			return;
		}

		if (key.upArrow) {
			setSelectedToolIndex(Math.max(0, selectedToolIndex - 1));
		} else if (key.downArrow) {
			setSelectedToolIndex(
				Math.min(filteredTools.length - 1, selectedToolIndex + 1)
			);
		} else if (key.return && filteredTools[selectedToolIndex]) {
			setShowToolDetails(true);
		} else if (input === '/' && tools.length > 0) {
			setSearchMode(true);
		} else if (input === 'c' && connectionStatus !== 'active') {
			handleConnect();
		} else if (input === 'd' && connectionStatus === 'active') {
			handleDisconnect();
		} else if (input === 'e') {
			onEdit();
		} else if (input === 'u') {
			onUse();
		} else if (key.escape || input === 'b') {
			onBack();
		}
	});

	if (showToolDetails && filteredTools[selectedToolIndex]) {
		return (
			<MCPToolViewer
				tool={filteredTools[selectedToolIndex]}
				serverId={server.id}
				onBack={() => setShowToolDetails(false)}
				log={log}
			/>
		);
	}

	const statusColor =
		{
			active: 'green',
			inactive: 'gray',
			connecting: 'yellow',
			error: 'red'
		}[connectionStatus] || 'gray';

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color={theme.accent}>
					{server.name}
				</Text>
				<Text color={theme.textDim}> ({server.id})</Text>
			</Box>

			<Box marginBottom={1}>
				<Text>Status: </Text>
				<Text color={statusColor}>{connectionStatus}</Text>
			</Box>

			<Box marginBottom={1}>
				<Text>Path: {server.scriptPath}</Text>
			</Box>

			{server.description && (
				<Box marginBottom={1}>
					<Text>{server.description}</Text>
				</Box>
			)}

			<Box marginTop={2} marginBottom={1}>
				<Text bold>Available Tools</Text>
				{connectionStatus === 'active' && (
					<Text color={theme.textDim}>
						{' '}
						({filteredTools.length}
						{searchQuery ? `/${tools.length}` : ''})
					</Text>
				)}
			</Box>

			{searchMode && (
				<Box marginBottom={1}>
					<Text>Search: </Text>
					<TextInput
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder="Type to filter tools..."
					/>
				</Box>
			)}

			{connectionStatus !== 'active' ? (
				<Box>
					<Text color={theme.textDim}>
						{connectionStatus === 'connecting'
							? 'Connecting to server...'
							: "Server not connected. Press 'C' to connect."}
					</Text>
				</Box>
			) : isLoadingTools ? (
				<Box>
					<Spinner type="dots" />
					<Text> Loading tools...</Text>
				</Box>
			) : filteredTools.length === 0 ? (
				<Text color={theme.textDim}>
					{searchQuery ? 'No tools match your search' : 'No tools available'}
				</Text>
			) : (
				<Box flexDirection="column">
					{filteredTools.map((tool, index) => (
						<ToolRow
							key={tool.name}
							tool={tool}
							isSelected={selectedToolIndex === index}
						/>
					))}
				</Box>
			)}

			{error && (
				<Box marginTop={1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			)}

			<Box marginTop={2} flexDirection="column">
				{tools.length > 0 && connectionStatus === 'active' && !searchMode && (
					<>
						<Text color={theme.textDim}>
							↑↓ Select Tool • Enter: View Tool Details • /: Search Tools
						</Text>
					</>
				)}
				{searchMode && (
					<Text color={theme.textDim}>Type to search • Esc: Clear search</Text>
				)}
				<Text color={theme.textDim}>
					{connectionStatus === 'active' ? 'D: Disconnect' : 'C: Connect'} • E:
					Edit • U: Use as Backend • B: Back
				</Text>
			</Box>
		</Box>
	);
}

function ToolRow({ tool, isSelected }) {
	return (
		<Box>
			<Box width={30}>
				<Text color={isSelected ? theme.accent : theme.text}>{tool.name}</Text>
			</Box>
			<Box flexGrow={1}>
				<Text color={theme.textDim}>
					{tool.description || 'No description'}
				</Text>
			</Box>
			{isSelected && <Text color={theme.accent}> ◄</Text>}
		</Box>
	);
}
