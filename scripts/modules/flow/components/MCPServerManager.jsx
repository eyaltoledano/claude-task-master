import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { MCPServerForm } from './MCPServerForm.jsx';
import { MCPServerDetails } from './MCPServerDetails.jsx';
import {
	loadServers,
	saveServers,
	addServer,
	updateServer,
	removeServer
} from '../mcp/servers.js';
import { connectionPool } from '../mcp/connection-pool.js';
import { theme } from '../theme.js';

export function MCPServerManager({ onBack, onUseServer, log }) {
	const [servers, setServers] = useState([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [view, setView] = useState('list'); // 'list', 'add', 'edit', 'details'
	const [editingServer, setEditingServer] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);
	const [confirmDelete, setConfirmDelete] = useState(null);

	useEffect(() => {
		loadServerList();
	}, []);

	const loadServerList = async () => {
		try {
			setIsLoading(true);
			const serverList = await loadServers();

			// Update connection status and tool count for each server
			const updatedServers = await Promise.all(
				serverList.map(async (server) => {
					const status = connectionPool.getStatus(server.id);
					let toolCount = null;

					// Get tool count if server is connected
					if (status === 'active') {
						try {
							const tools = await connectionPool.listTools(server.id);
							toolCount = tools.length;
						} catch (err) {
							// Ignore errors getting tool count
						}
					}

					return {
						...server,
						status,
						toolCount
					};
				})
			);

			setServers(updatedServers);
			setError(null);
		} catch (err) {
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	};

	useInput((input, key) => {
		if (view !== 'list') return;

		if (confirmDelete) {
			if (input === 'y') {
				handleConfirmDelete();
			} else if (input === 'n' || key.escape) {
				setConfirmDelete(null);
			}
			return;
		}

		if (key.upArrow) {
			setSelectedIndex(Math.max(0, selectedIndex - 1));
		} else if (key.downArrow) {
			setSelectedIndex(Math.min(servers.length - 1, selectedIndex + 1));
		} else if (key.return && servers[selectedIndex]) {
			handleViewDetails(servers[selectedIndex]);
		} else if (input === 'a') {
			setView('add');
		} else if (input === 'r' && servers[selectedIndex]) {
			if (servers[selectedIndex].id === 'local') {
				setError('Cannot remove the local server');
			} else {
				setConfirmDelete(servers[selectedIndex]);
			}
		} else if (input === 'e' && servers[selectedIndex]) {
			handleEditServer(servers[selectedIndex]);
		} else if (input === ' ' && servers[selectedIndex]) {
			handleToggleConnection(servers[selectedIndex]);
		} else if (input === 'u' && servers[selectedIndex]) {
			handleUseServer(servers[selectedIndex]);
		} else if (key.escape || input === 'q') {
			onBack();
		}
	});

	const handleViewDetails = (server) => {
		// Update server status
		const updatedServer = {
			...server,
			status: connectionPool.getStatus(server.id)
		};
		setEditingServer(updatedServer);
		setView('details');
	};

	const handleEditServer = (server) => {
		setEditingServer(server);
		setView('edit');
	};

	const handleToggleConnection = async (server) => {
		try {
			if (server.status === 'active') {
				await connectionPool.disconnect(server.id);
			} else {
				await connectionPool.connect(server, log);
			}
			// Reload to update tool counts
			await loadServerList();
		} catch (err) {
			setError(`Failed to toggle connection: ${err.message}`);
		}
	};

	const handleUseServer = async (server) => {
		try {
			// Ensure server is connected
			if (server.status !== 'active') {
				await connectionPool.connect(server, log);
			}

			// Switch backend
			await onUseServer(server);
		} catch (err) {
			setError(`Failed to use server: ${err.message}`);
		}
	};

	const handleConfirmDelete = async () => {
		try {
			await connectionPool.disconnect(confirmDelete.id);
			await removeServer(confirmDelete.id);
			await loadServerList();
			setConfirmDelete(null);
		} catch (err) {
			setError(`Failed to remove server: ${err.message}`);
		}
	};

	const handleSaveServer = async (serverData) => {
		try {
			if (view === 'add') {
				await addServer(serverData);
			} else {
				await updateServer(serverData);
			}
			await loadServerList();
			setView('list');
			setEditingServer(null);
		} catch (err) {
			throw err; // Let the form handle the error
		}
	};

	const handleCancel = () => {
		setView('list');
		setEditingServer(null);
	};

	// Render different views
	if (view === 'add') {
		return <MCPServerForm onSave={handleSaveServer} onCancel={handleCancel} />;
	}

	if (view === 'edit') {
		return (
			<MCPServerForm
				server={editingServer}
				onSave={handleSaveServer}
				onCancel={handleCancel}
			/>
		);
	}

	if (view === 'details') {
		return (
			<MCPServerDetails
				server={editingServer}
				onBack={() => {
					setView('list');
					loadServerList(); // Refresh status
				}}
				onEdit={() => setView('edit')}
				onUse={() => handleUseServer(editingServer)}
				log={log}
			/>
		);
	}

	// List view
	if (isLoading) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box>
					<Spinner type="dots" />
					<Text> Loading servers...</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color={theme.accent}>
					MCP Server Management
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text color={theme.textDim}>
					Manage external MCP servers for Task Master
				</Text>
			</Box>

			{confirmDelete && (
				<Box marginBottom={1} borderStyle="round" borderColor="red" padding={1}>
					<Text color="red">
						Delete server "{confirmDelete.name}"? This cannot be undone. (Y/N)
					</Text>
				</Box>
			)}

			<Box flexDirection="column">
				{servers.map((server, index) => (
					<ServerRow
						key={server.id}
						server={server}
						isSelected={selectedIndex === index}
					/>
				))}
			</Box>

			{servers.length === 0 && (
				<Box marginTop={1}>
					<Text color={theme.textDim}>
						No servers configured. Press 'A' to add one.
					</Text>
				</Box>
			)}

			{error && (
				<Box marginTop={1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			)}

			<Box marginTop={2} flexDirection="column">
				<Text color={theme.textDim}>
					↑↓ Navigate • Enter: View Details • Space: Toggle Active
				</Text>
				<Text color={theme.textDim}>
					A: Add Server • E: Edit • R: Remove • U: Use as Backend
				</Text>
				<Text color={theme.textDim}>Q/Esc: Back</Text>
			</Box>
		</Box>
	);
}

function ServerRow({ server, isSelected }) {
	const statusIcon =
		{
			active: '🟢',
			inactive: '⚫',
			connecting: '🟡',
			error: '🔴'
		}[server.status] || '⚫';

	const statusColor =
		{
			active: 'green',
			inactive: 'gray',
			connecting: 'yellow',
			error: 'red'
		}[server.status] || 'gray';

	return (
		<Box>
			<Box width={3}>
				<Text>{statusIcon}</Text>
			</Box>
			<Box width={20}>
				<Text color={isSelected ? theme.accent : theme.text}>
					{server.name}
				</Text>
			</Box>
			<Box width={10}>
				<Text color={theme.textDim}>({server.id})</Text>
			</Box>
			<Box width={30}>
				<Text color={theme.textDim}>{server.scriptPath}</Text>
			</Box>
			<Box width={10}>
				<Text color={statusColor}>{server.status}</Text>
			</Box>
			{server.toolCount !== null && (
				<Box width={10}>
					<Text color={theme.textDim}>[{server.toolCount} tools]</Text>
				</Box>
			)}
			{server.default && <Text color="yellow"> [default]</Text>}
			{isSelected && <Text color={theme.accent}> ◄</Text>}
		</Box>
	);
}
