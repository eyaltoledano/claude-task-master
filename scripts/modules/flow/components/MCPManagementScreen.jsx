import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppContext } from '../index.jsx';
import { theme } from '../theme.js';
import {
	loadServers,
	saveServers,
	addServer,
	updateServer,
	removeServer
} from '../mcp/servers.js';
import { connectionPool } from '../mcp/connection-pool.js';

export function MCPManagementScreen() {
	const { setCurrentScreen, currentScreen, showToast, backend: currentBackend } = useAppContext();
	const [servers, setServers] = useState([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showAddForm, setShowAddForm] = useState(false);
	const [view, setView] = useState('list'); // 'list', 'server-details', 'tool-details'
	const [selectedServer, setSelectedServer] = useState(null);
	const [selectedTool, setSelectedTool] = useState(null);
	const [serverTools, setServerTools] = useState([]);
	const [formData, setFormData] = useState({
		name: '',
		transport: 'stdio', // stdio, sse, http
		command: '',
		url: '',
		args: [],
		env: {},
		headers: {},
		scope: 'local' // local, project, user
	});
	const [formField, setFormField] = useState('name');
	const [inputValue, setInputValue] = useState('');
	const [scrollOffset, setScrollOffset] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(15); // Visible rows

	// Load MCP servers on mount
	useEffect(() => {
		loadServerList();
	}, []);

	const loadServerList = async () => {
		try {
			setLoading(true);
			const serverList = await loadServers();

			// Update connection status and tool count for each server
			const updatedServers = await Promise.all(
				serverList.map(async (server) => {
					const status = connectionPool.getStatus(server.id);
					let toolCount = null;
					let capabilities = [];

					// Get tool count and capabilities if server is connected
					if (status === 'active') {
						try {
							const tools = await connectionPool.listTools(server.id);
							toolCount = tools.length;
							// Extract unique capabilities from tool names
							capabilities = [...new Set(tools.map(t => t.name.split('_')[0]))].slice(0, 5);
						} catch (err) {
							// Ignore errors getting tool count
						}
					}

					return {
						...server,
						status: status || 'inactive',
						toolCount,
						capabilities,
						transport: server.transport || 'stdio',
						scope: server.scope || 'local'
					};
				})
			);

			setServers(updatedServers);
			setError(null);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const loadServerTools = async (server) => {
		try {
			if (server.status !== 'active') {
				setServerTools([]);
				return;
			}

			const tools = await connectionPool.listTools(server.id);
			setServerTools(tools.map(tool => ({
				...tool,
				description: tool.description || 'No description available'
			})));
		} catch (err) {
			showToast(`Failed to load tools: ${err.message}`, 'error');
			setServerTools([]);
		}
	};

	// Handle keyboard input
	useInput((input, key) => {
		if (currentScreen !== 'mcp-management') return;

		if (showAddForm) {
			handleFormInput(input, key);
			return;
		}

		if (view === 'tool-details') {
			if (key.escape) {
				setView('server-details');
				setSelectedTool(null);
				setSelectedIndex(0);
			}
			return;
		}

		if (view === 'server-details') {
			if (key.escape) {
				setView('list');
				setSelectedServer(null);
				setServerTools([]);
				setSelectedIndex(0);
			}

			if (key.upArrow) {
				if (selectedIndex > 0) {
					setSelectedIndex(selectedIndex - 1);
					// Adjust scroll if needed
					if (selectedIndex - 1 < scrollOffset) {
						setScrollOffset(Math.max(0, scrollOffset - 1));
					}
				}
				return;
			}

			if (key.downArrow) {
				if (selectedIndex < serverTools.length - 1) {
					setSelectedIndex(selectedIndex + 1);
					// Adjust scroll if needed
					if (selectedIndex + 1 >= scrollOffset + viewportHeight) {
						setScrollOffset(scrollOffset + 1);
					}
				}
				return;
			}

			if (key.return && serverTools[selectedIndex]) {
				setSelectedTool(serverTools[selectedIndex]);
				setView('tool-details');
				setScrollOffset(0);
				return;
			}

			return;
		}

		// List view handlers
		if (key.escape) {
			setCurrentScreen('welcome');
			return;
		}

		if (key.upArrow) {
			if (selectedIndex > 0) {
				setSelectedIndex(selectedIndex - 1);
				// Adjust scroll if needed
				if (selectedIndex - 1 < scrollOffset) {
					setScrollOffset(Math.max(0, scrollOffset - 1));
				}
			}
			return;
		}

		if (key.downArrow) {
			if (selectedIndex < servers.length - 1) {
				setSelectedIndex(selectedIndex + 1);
				// Adjust scroll if needed
				if (selectedIndex + 1 >= scrollOffset + viewportHeight) {
					setScrollOffset(scrollOffset + 1);
				}
			}
			return;
		}

		if (input === 'a') {
			setShowAddForm(true);
			setFormField('name');
			setInputValue('');
			return;
		}

		if (input === 'd' && servers.length > 0) {
			removeServerHandler(servers[selectedIndex]);
			return;
		}

		if (key.return && servers.length > 0) {
			// View server details
			const server = servers[selectedIndex];
			setSelectedServer(server);
			setView('server-details');
			setSelectedIndex(0);
			setScrollOffset(0);
			loadServerTools(server);
			return;
		}

		if (input === ' ' && servers.length > 0) {
			// Toggle server connection
			const server = servers[selectedIndex];
			toggleServerConnection(server);
			return;
		}

		if (input === 'u' && servers.length > 0) {
			// Use server as backend
			useServerAsBackend(servers[selectedIndex]);
			return;
		}
	});

	const handleFormInput = (input, key) => {
		if (key.escape) {
			setShowAddForm(false);
			resetForm();
			return;
		}

		if (key.tab) {
			// Cycle through form fields
			const fields = getFormFields();
			const currentIndex = fields.indexOf(formField);
			const nextIndex = (currentIndex + 1) % fields.length;
			setFormField(fields[nextIndex]);
			setInputValue(getFieldValue(fields[nextIndex]));
			return;
		}

		if (key.return) {
			if (formField === 'submit') {
				submitForm();
			} else {
				// Move to next field
				const fields = getFormFields();
				const currentIndex = fields.indexOf(formField);
				if (currentIndex < fields.length - 1) {
					setFormField(fields[currentIndex + 1]);
					setInputValue(getFieldValue(fields[currentIndex + 1]));
				}
			}
			return;
		}

		if (key.backspace || key.delete) {
			setInputValue((prev) => prev.slice(0, -1));
			updateFormData(inputValue.slice(0, -1));
			return;
		}

		if (input && input.length === 1) {
			setInputValue((prev) => prev + input);
			updateFormData(inputValue + input);
		}
	};

	const getFormFields = () => {
		const baseFields = ['name', 'transport'];
		
		if (formData.transport === 'stdio') {
			return [...baseFields, 'command', 'args', 'env', 'scope', 'submit'];
		} else {
			return [...baseFields, 'url', 'headers', 'scope', 'submit'];
		}
	};

	const getFieldValue = (field) => {
		switch (field) {
			case 'name': return formData.name;
			case 'transport': return formData.transport;
			case 'command': return formData.command;
			case 'url': return formData.url;
			case 'args': return formData.args.join(' ');
			case 'env': return Object.entries(formData.env).map(([k, v]) => `${k}=${v}`).join(' ');
			case 'headers': return Object.entries(formData.headers).map(([k, v]) => `${k}: ${v}`).join(', ');
			case 'scope': return formData.scope;
			default: return '';
		}
	};

	const updateFormData = (value) => {
		switch (formField) {
			case 'name':
				setFormData({ ...formData, name: value });
				break;
			case 'transport':
				// Only accept valid transport types
				if (['stdio', 'sse', 'http'].includes(value)) {
					setFormData({ ...formData, transport: value });
				}
				break;
			case 'command':
				setFormData({ ...formData, command: value });
				break;
			case 'url':
				setFormData({ ...formData, url: value });
				break;
			case 'args':
				setFormData({ ...formData, args: value.split(' ').filter(a => a) });
				break;
			case 'env':
				// Parse KEY=value pairs
				const envPairs = value.split(' ').filter(p => p.includes('='));
				const env = {};
				envPairs.forEach(pair => {
					const [key, ...valueParts] = pair.split('=');
					env[key] = valueParts.join('=');
				});
				setFormData({ ...formData, env });
				break;
			case 'headers':
				// Parse Header: value pairs
				const headerPairs = value.split(',').map(h => h.trim()).filter(h => h.includes(':'));
				const headers = {};
				headerPairs.forEach(pair => {
					const [key, ...valueParts] = pair.split(':');
					headers[key.trim()] = valueParts.join(':').trim();
				});
				setFormData({ ...formData, headers });
				break;
			case 'scope':
				if (['local', 'project', 'user'].includes(value)) {
					setFormData({ ...formData, scope: value });
				}
				break;
		}
	};

	const submitForm = async () => {
		try {
			// Validate required fields
			if (!formData.name) {
				showToast('Server name is required', 'error');
				return;
			}

			if (formData.transport === 'stdio' && !formData.command) {
				showToast('Command is required for stdio transport', 'error');
				return;
			}

			if (formData.transport !== 'stdio' && !formData.url) {
				showToast('URL is required for SSE/HTTP transport', 'error');
				return;
			}

			// Create server configuration based on transport type
			const serverConfig = {
				name: formData.name,
				transport: formData.transport,
				scope: formData.scope
			};

			if (formData.transport === 'stdio') {
				serverConfig.scriptPath = formData.command;
				serverConfig.args = formData.args;
				serverConfig.env = formData.env;
			} else {
				serverConfig.url = formData.url;
				serverConfig.headers = formData.headers;
			}

			// Add the server
			await addServer(serverConfig);
			await loadServerList();
			
			showToast(`Added MCP server: ${formData.name}`, 'success');
			setShowAddForm(false);
			resetForm();
		} catch (err) {
			showToast(`Failed to add server: ${err.message}`, 'error');
		}
	};

	const resetForm = () => {
		setFormData({
			name: '',
			transport: 'stdio',
			command: '',
			url: '',
			args: [],
			env: {},
			headers: {},
			scope: 'local'
		});
		setFormField('name');
		setInputValue('');
	};

	const removeServerHandler = async (server) => {
		try {
			if (server.id === 'local') {
				showToast('Cannot remove the local server', 'error');
				return;
			}

			// Disconnect if connected
			if (server.status === 'active') {
				await connectionPool.disconnect(server.id);
			}

			// Remove the server
			await removeServer(server.id);
			await loadServerList();
			
			showToast(`Removed MCP server: ${server.name}`, 'success');
			
			// Adjust selected index if needed
			if (selectedIndex >= servers.length - 1) {
				setSelectedIndex(Math.max(0, servers.length - 2));
			}
		} catch (err) {
			showToast(`Failed to remove server: ${err.message}`, 'error');
		}
	};

	const toggleServerConnection = async (server) => {
		try {
			if (server.status === 'active') {
				await connectionPool.disconnect(server.id);
				showToast(`Disconnected from: ${server.name}`, 'success');
			} else {
				await connectionPool.connect(server, currentBackend.log);
				showToast(`Connected to: ${server.name}`, 'success');
			}
			await loadServerList();
		} catch (err) {
			showToast(`Failed to toggle connection: ${err.message}`, 'error');
		}
	};

	const useServerAsBackend = async (server) => {
		try {
			// Ensure server is connected
			if (server.status !== 'active') {
				await connectionPool.connect(server, currentBackend.log);
			}

			showToast(`Using ${server.name} as backend`, 'success');
			// TODO: Implement backend switching logic
		} catch (err) {
			showToast(`Failed to use server: ${err.message}`, 'error');
		}
	};

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
		return renderAddForm();
	}

	if (view === 'tool-details' && selectedTool) {
		return renderToolDetails();
	}

	if (view === 'server-details' && selectedServer) {
		return renderServerDetails();
	}

	// Calculate visible servers
	const visibleServers = servers.slice(scrollOffset, scrollOffset + viewportHeight);
	const showScrollIndicators = servers.length > viewportHeight;

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Box flexGrow={1}>
					<Text color={theme.accent}>Task Master</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color={theme.text}>MCP Servers</Text>
				</Box>
				<Text color={theme.textDim}>[a add] [d remove] [space connect] [↵ details] [ESC back]</Text>
			</Box>

			{/* Server table */}
			<Box flexGrow={1} flexDirection="column">
				{/* Table header */}
				<Box paddingLeft={1} paddingRight={1} marginBottom={1}>
					<Box width={3}><Text> </Text></Box>
					<Box width={3}><Text color={theme.textDim} underline> </Text></Box>
					<Box width={25}><Text color={theme.textDim} underline>Name</Text></Box>
					<Box width={12}><Text color={theme.textDim} underline>Transport</Text></Box>
					<Box width={12}><Text color={theme.textDim} underline>Status</Text></Box>
					<Box width={10}><Text color={theme.textDim} underline>Scope</Text></Box>
					<Box width={8}><Text color={theme.textDim} underline>Tools</Text></Box>
					<Box width={30}><Text color={theme.textDim} underline>Path/URL</Text></Box>
				</Box>

				{/* Scroll indicator (top) */}
				{showScrollIndicators && scrollOffset > 0 && (
					<Box paddingLeft={1}>
						<Text color={theme.textDim}>↑ {scrollOffset} more above</Text>
					</Box>
				)}

				{/* Server rows */}
				{servers.length === 0 ? (
					<Box paddingLeft={1}>
						<Text color={theme.textDim}>No MCP servers configured. Press 'a' to add one.</Text>
					</Box>
				) : (
					visibleServers.map((server, visibleIndex) => {
						const actualIndex = scrollOffset + visibleIndex;
						const isSelected = actualIndex === selectedIndex;
						
						return (
							<Box
								key={server.id || server.name}
								paddingLeft={1}
								paddingRight={1}
							>
								<Box width={3}>
									<Text color={isSelected ? theme.accent : theme.textDim}>
										{isSelected ? '→' : ' '}
									</Text>
								</Box>
								<Box width={3}>
									<Text color={
										server.status === 'active' ? theme.success :
										server.status === 'error' ? theme.error :
										theme.textDim
									}>
										{server.status === 'active' ? '●' : 
										 server.status === 'error' ? '●' : '○'}
									</Text>
								</Box>
								<Box width={25}>
									<Text color={isSelected ? theme.accent : theme.text}>
										{server.name}
										{server.default && <Text color={theme.warning}> *</Text>}
									</Text>
								</Box>
								<Box width={12}>
									<Text color={theme.text}>{server.transport}</Text>
								</Box>
								<Box width={12}>
									<Text color={
										server.status === 'active' ? theme.success :
										server.status === 'authenticated' ? theme.success :
										server.status === 'connecting' ? theme.warning :
										server.status === 'error' ? theme.error :
										theme.textDim
									}>
										{server.status}
									</Text>
								</Box>
								<Box width={10}>
									<Text color={theme.text}>{server.scope}</Text>
								</Box>
								<Box width={8}>
									<Text color={theme.textDim}>
										{server.toolCount !== null ? `[${server.toolCount}]` : '-'}
									</Text>
								</Box>
								<Box width={30}>
									<Text color={theme.textDim}>
										{server.transport === 'stdio' 
											? (server.scriptPath || server.command || '-')
											: (server.url || '-')
										}
									</Text>
								</Box>
							</Box>
						);
					})
				)}

				{/* Scroll indicator (bottom) */}
				{showScrollIndicators && (scrollOffset + viewportHeight < servers.length) && (
					<Box paddingLeft={1}>
						<Text color={theme.textDim}>↓ {servers.length - scrollOffset - viewportHeight} more below</Text>
					</Box>
				)}
			</Box>

			{/* Footer */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				paddingTop={1}
				paddingLeft={1}
				paddingRight={1}
			>
				{error ? (
					<Text color={theme.error}>{error}</Text>
				) : (
					<Text color={theme.textDim}>
						{servers.length} server{servers.length !== 1 ? 's' : ''} configured
						{servers.filter(s => s.status === 'active').length > 0 && 
							<Text color={theme.success}> • {servers.filter(s => s.status === 'active').length} connected</Text>
						}
					</Text>
				)}
			</Box>
		</Box>
	);

	function renderServerDetails() {
		const visibleTools = serverTools.slice(scrollOffset, scrollOffset + viewportHeight);
		const showScrollIndicators = serverTools.length > viewportHeight;

		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>MCP Servers</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>{selectedServer.name}</Text>
					</Box>
					<Text color={theme.textDim}>[↵ view tool] [ESC back]</Text>
				</Box>

				{/* Server info */}
				<Box paddingLeft={1} paddingRight={1} marginBottom={1} flexDirection="column">
					<Box>
						<Text color={theme.textDim}>Status: </Text>
						<Text color={
							selectedServer.status === 'active' ? theme.success :
							selectedServer.status === 'error' ? theme.error :
							theme.textDim
						}>
							{selectedServer.status === 'active' ? '● ' : 
							 selectedServer.status === 'error' ? '● ' : '○ '}
							{selectedServer.status}
						</Text>
					</Box>
					<Box>
						<Text color={theme.textDim}>Transport: </Text>
						<Text>{selectedServer.transport}</Text>
					</Box>
					<Box>
						<Text color={theme.textDim}>Scope: </Text>
						<Text>{selectedServer.scope}</Text>
					</Box>
					{selectedServer.transport === 'stdio' ? (
						<Box>
							<Text color={theme.textDim}>Command: </Text>
							<Text>{selectedServer.scriptPath || selectedServer.command}</Text>
						</Box>
					) : (
						<Box>
							<Text color={theme.textDim}>URL: </Text>
							<Text>{selectedServer.url}</Text>
						</Box>
					)}
				</Box>

				{/* Tools section */}
				<Box flexGrow={1} flexDirection="column">
					<Box paddingLeft={1} marginBottom={1}>
						<Text color={theme.accent} bold>Available Tools ({serverTools.length})</Text>
					</Box>

					{/* Tool list header */}
					<Box paddingLeft={1} paddingRight={1} marginBottom={1}>
						<Box width={3}><Text> </Text></Box>
						<Box width={30}><Text color={theme.textDim} underline>Tool Name</Text></Box>
						<Box flexGrow={1}><Text color={theme.textDim} underline>Description</Text></Box>
					</Box>

					{/* Scroll indicator (top) */}
					{showScrollIndicators && scrollOffset > 0 && (
						<Box paddingLeft={1}>
							<Text color={theme.textDim}>↑ {scrollOffset} more above</Text>
						</Box>
					)}

					{/* Tool rows */}
					{serverTools.length === 0 ? (
						<Box paddingLeft={1}>
							<Text color={theme.textDim}>
								{selectedServer.status === 'active' 
									? 'No tools available from this server.' 
									: 'Server is not connected. Connect to view tools.'}
							</Text>
						</Box>
					) : (
						visibleTools.map((tool, visibleIndex) => {
							const actualIndex = scrollOffset + visibleIndex;
							const isSelected = actualIndex === selectedIndex;
							
							return (
								<Box
									key={tool.name}
									paddingLeft={1}
									paddingRight={1}
								>
									<Box width={3}>
										<Text color={isSelected ? theme.accent : theme.textDim}>
											{isSelected ? '→' : ' '}
										</Text>
									</Box>
									<Box width={30}>
										<Text color={isSelected ? theme.accent : theme.text}>
											{tool.name}
										</Text>
									</Box>
									<Box flexGrow={1}>
										<Text color={theme.textDim}>
											{tool.description.length > 60 
												? tool.description.substring(0, 57) + '...'
												: tool.description}
										</Text>
									</Box>
								</Box>
							);
						})
					)}

					{/* Scroll indicator (bottom) */}
					{showScrollIndicators && (scrollOffset + viewportHeight < serverTools.length) && (
						<Box paddingLeft={1}>
							<Text color={theme.textDim}>↓ {serverTools.length - scrollOffset - viewportHeight} more below</Text>
						</Box>
					)}
				</Box>
			</Box>
		);
	}

	function renderToolDetails() {
		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>MCP Servers</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>{selectedServer.name}</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>{selectedTool.name}</Text>
					</Box>
					<Text color={theme.textDim}>[ESC back]</Text>
				</Box>

				{/* Tool details */}
				<Box flexGrow={1} paddingLeft={1} paddingRight={1} flexDirection="column">
					<Box marginBottom={1}>
						<Text color={theme.accent} bold>Tool: {selectedTool.name}</Text>
					</Box>

					<Box marginBottom={1} flexDirection="column">
						<Text color={theme.textDim}>Description:</Text>
						<Box paddingLeft={2}>
							<Text>{selectedTool.description}</Text>
						</Box>
					</Box>

					{selectedTool.inputSchema && (
						<Box marginBottom={1} flexDirection="column">
							<Text color={theme.textDim}>Parameters:</Text>
							<Box paddingLeft={2}>
								<Text color={theme.text}>
									{JSON.stringify(selectedTool.inputSchema, null, 2)}
								</Text>
							</Box>
						</Box>
					)}
				</Box>
			</Box>
		);
	}

	function renderAddForm() {
		const fields = getFormFields();

		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>Add MCP Server</Text>
					</Box>
					<Text color={theme.textDim}>[TAB next] [↵ submit] [ESC cancel]</Text>
				</Box>

				{/* Form */}
				<Box flexGrow={1} paddingLeft={2} paddingRight={2} flexDirection="column">
					<Text color={theme.accent} bold>Add New MCP Server</Text>
					<Box height={1} />
					
					{/* Server Name */}
					<Box marginBottom={1}>
						<Box width={15}>
							<Text color={formField === 'name' ? theme.accent : theme.text}>
								Name:
							</Text>
						</Box>
						<Text color={formField === 'name' ? theme.textBright : theme.text}>
							{formField === 'name' ? inputValue : formData.name}
							{formField === 'name' && <Text color={theme.accent}>_</Text>}
						</Text>
					</Box>

					{/* Transport */}
					<Box marginBottom={1}>
						<Box width={15}>
							<Text color={formField === 'transport' ? theme.accent : theme.text}>
								Transport:
							</Text>
						</Box>
						<Text color={formField === 'transport' ? theme.textBright : theme.text}>
							{formField === 'transport' ? inputValue : formData.transport}
							{formField === 'transport' && <Text color={theme.accent}>_</Text>}
						</Text>
						<Text color={theme.textDim}> (stdio, sse, http)</Text>
					</Box>

					{/* Command (for stdio) */}
					{formData.transport === 'stdio' && (
						<>
							<Box marginBottom={1}>
								<Box width={15}>
									<Text color={formField === 'command' ? theme.accent : theme.text}>
										Command:
									</Text>
								</Box>
								<Text color={formField === 'command' ? theme.textBright : theme.text}>
									{formField === 'command' ? inputValue : formData.command}
									{formField === 'command' && <Text color={theme.accent}>_</Text>}
								</Text>
							</Box>

							<Box marginBottom={1}>
								<Box width={15}>
									<Text color={formField === 'args' ? theme.accent : theme.text}>
										Arguments:
									</Text>
								</Box>
								<Text color={formField === 'args' ? theme.textBright : theme.text}>
									{formField === 'args' ? inputValue : formData.args.join(' ')}
									{formField === 'args' && <Text color={theme.accent}>_</Text>}
								</Text>
								<Text color={theme.textDim}> (space-separated)</Text>
							</Box>

							<Box marginBottom={1}>
								<Box width={15}>
									<Text color={formField === 'env' ? theme.accent : theme.text}>
										Environment:
									</Text>
								</Box>
								<Text color={formField === 'env' ? theme.textBright : theme.text}>
									{formField === 'env' ? inputValue : Object.entries(formData.env).map(([k, v]) => `${k}=${v}`).join(' ')}
									{formField === 'env' && <Text color={theme.accent}>_</Text>}
								</Text>
								<Text color={theme.textDim}> (KEY=value pairs)</Text>
							</Box>
						</>
					)}

					{/* URL and Headers (for sse/http) */}
					{formData.transport !== 'stdio' && (
						<>
							<Box marginBottom={1}>
								<Box width={15}>
									<Text color={formField === 'url' ? theme.accent : theme.text}>
										URL:
									</Text>
								</Box>
								<Text color={formField === 'url' ? theme.textBright : theme.text}>
									{formField === 'url' ? inputValue : formData.url}
									{formField === 'url' && <Text color={theme.accent}>_</Text>}
								</Text>
							</Box>

							<Box marginBottom={1}>
								<Box width={15}>
									<Text color={formField === 'headers' ? theme.accent : theme.text}>
										Headers:
									</Text>
								</Box>
								<Text color={formField === 'headers' ? theme.textBright : theme.text}>
									{formField === 'headers' ? inputValue : Object.entries(formData.headers).map(([k, v]) => `${k}: ${v}`).join(', ')}
									{formField === 'headers' && <Text color={theme.accent}>_</Text>}
								</Text>
								<Text color={theme.textDim}> (Header: value, ...)</Text>
							</Box>
						</>
					)}

					{/* Scope */}
					<Box marginBottom={2}>
						<Box width={15}>
							<Text color={formField === 'scope' ? theme.accent : theme.text}>
								Scope:
							</Text>
						</Box>
						<Text color={formField === 'scope' ? theme.textBright : theme.text}>
							{formField === 'scope' ? inputValue : formData.scope}
							{formField === 'scope' && <Text color={theme.accent}>_</Text>}
						</Text>
						<Text color={theme.textDim}> (local, project, user)</Text>
					</Box>

					{/* Submit button */}
					<Box>
						<Text 
							color={formField === 'submit' ? theme.success : theme.text}
							bold={formField === 'submit'}
						>
							{formField === 'submit' ? '▶ ' : '  '}
							Add Server
						</Text>
					</Box>

					{/* Help text */}
					<Box marginTop={2}>
						<Text color={theme.textDim}>
							{formData.transport === 'stdio' 
								? 'Example: command="/usr/local/bin/server" args="--port 3000" env="API_KEY=abc123"'
								: formData.transport === 'sse'
								? 'Example: url="https://api.example.com/sse" headers="Authorization: Bearer token"'
								: 'Example: url="https://api.example.com/mcp" headers="X-API-Key: your-key"'
							}
						</Text>
					</Box>
				</Box>
			</Box>
		);
	}
} 