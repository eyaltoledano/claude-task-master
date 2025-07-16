import React, { useState, useEffect } from 'react';
import { useInput } from 'ink';
import { useAppContext } from '../../../app/index-root.jsx';
import { useServices } from '../../../shared/contexts/ServiceContext.jsx';
import {
	loadServers,
	addServer,
	removeServer
} from '../../../infra/mcp/servers.js';
import { connectionPool } from '../../../infra/mcp/connection-pool.js';

export function useMCPManager() {
	const { backend, logger } = useServices();
	const {
		currentScreen,
		setCurrentScreen,
		showToast
	} = useAppContext();
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
		transport: 'stdio',
		command: '',
		url: '',
		args: [],
		env: {},
		headers: {},
		scope: 'local'
	});
	const [formField, setFormField] = useState('name');
	const [inputValue, setInputValue] = useState('');
	const [scrollOffset, setScrollOffset] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(15);
	const [pasteMode, setPasteMode] = useState(false);
	const [pasteContent, setPasteContent] = useState('');

	useEffect(() => {
		if (currentScreen === 'mcp') {
			loadServerList();
		}
	}, [currentScreen]);

	const loadServerList = async () => {
		try {
			setLoading(true);
			const serverList = await loadServers();
			const updatedServers = await Promise.all(
				serverList.map(async (server) => {
					const status = connectionPool.getStatus(server.id);
					let toolCount = null;
					let capabilities = [];
					if (status === 'active') {
						try {
							const tools = await connectionPool.listTools(server.id);
							toolCount = tools.length;
							capabilities = [
								...new Set(tools.map((t) => t.name.split('_')[0]))
							].slice(0, 5);
						} catch (err) {
							// Ignore
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
			setServerTools(
				tools.map((tool) => ({
					...tool,
					description: tool.description || 'No description available'
				}))
			);
		} catch (err) {
			showToast(`Failed to load tools: ${err.message}`, 'error');
			setServerTools([]);
		}
	};

	useInput((input, key) => {
		if (currentScreen !== 'mcp') return;

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
					if (selectedIndex - 1 < scrollOffset) {
						setScrollOffset(Math.max(0, scrollOffset - 1));
					}
				}
				return;
			}
			if (key.downArrow) {
				if (selectedIndex < serverTools.length - 1) {
					setSelectedIndex(selectedIndex + 1);
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
				if (selectedIndex - 1 < scrollOffset) {
					setScrollOffset(Math.max(0, scrollOffset - 1));
				}
			}
			return;
		}
		if (key.downArrow) {
			if (selectedIndex < servers.length - 1) {
				setSelectedIndex(selectedIndex + 1);
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
			setPasteMode(false);
			return;
		}
		if (input === 'p') {
			setShowAddForm(true);
			setPasteMode(true);
			setPasteContent('');
			setInputValue('');
			return;
		}
		if (input === 'd' && servers.length > 0) {
			removeServerHandler(servers[selectedIndex]);
			return;
		}
		if (key.return && servers.length > 0) {
			const server = servers[selectedIndex];
			setSelectedServer(server);
			setView('server-details');
			setSelectedIndex(0);
			setScrollOffset(0);
			loadServerTools(server);
			return;
		}
		if (input === ' ' && servers.length > 0) {
			toggleServerConnection(servers[selectedIndex]);
		}
	});

	const handleFormInput = (input, key) => {
		if (key.escape) {
			setShowAddForm(false);
			resetForm();
			setPasteMode(false);
			setPasteContent('');
			return;
		}
		if (pasteMode) {
			if (key.return && key.ctrl) {
				parsePastedConfig();
				return;
			}
			if (key.return) {
				setPasteContent((prev) => prev + '\\n');
				return;
			}
			if (key.backspace || key.delete) {
				setPasteContent((prev) => prev.slice(0, -1));
				return;
			}
			if (input) {
				setPasteContent((prev) => prev + input);
			}
			return;
		}
		if (key.tab && key.shift) {
			const fields = getFormFields();
			const currentIndex = fields.indexOf(formField);
			const prevIndex = currentIndex > 0 ? currentIndex - 1 : fields.length - 1;
			setFormField(fields[prevIndex]);
			setInputValue(getFieldValue(fields[prevIndex]));
			return;
		}
		if (key.tab) {
			const fields = getFormFields();
			const currentIndex = fields.indexOf(formField);
			const nextIndex = (currentIndex + 1) % fields.length;
			setFormField(fields[nextIndex]);
			setInputValue(getFieldValue(fields[nextIndex]));
			return;
		}
		if (key.upArrow) {
			const fields = getFormFields();
			const currentIndex = fields.indexOf(formField);
			if (currentIndex > 0) {
				setFormField(fields[currentIndex - 1]);
				setInputValue(getFieldValue(fields[currentIndex - 1]));
			}
			return;
		}
		if (key.downArrow) {
			const fields = getFormFields();
			const currentIndex = fields.indexOf(formField);
			if (currentIndex < fields.length - 1) {
				setFormField(fields[currentIndex + 1]);
				setInputValue(getFieldValue(fields[currentIndex + 1]));
			}
			return;
		}
		if (key.return) {
			if (formField === 'submit') {
				submitForm();
			} else if (formField === 'cancel') {
				setShowAddForm(false);
				resetForm();
			} else {
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
			return [
				...baseFields,
				'command',
				'args',
				'env',
				'scope',
				'submit',
				'cancel'
			];
		} else {
			return [...baseFields, 'url', 'headers', 'scope', 'submit', 'cancel'];
		}
	};

	const getFieldValue = (field) => {
		switch (field) {
			case 'name':
				return formData.name;
			case 'transport':
				return formData.transport;
			case 'command':
				return formData.command;
			case 'url':
				return formData.url;
			case 'args':
				return formData.args.join(' ');
			case 'env':
				return Object.entries(formData.env)
					.map(([k, v]) => `${k}=${v}`)
					.join(' ');
			case 'headers':
				return Object.entries(formData.headers)
					.map(([k, v]) => `${k}: ${v}`)
					.join(', ');
			case 'scope':
				return formData.scope;
			default:
				return '';
		}
	};

	const updateFormData = (value) => {
		switch (formField) {
			case 'name':
				setFormData({ ...formData, name: value });
				break;
			case 'transport':
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
				setFormData({ ...formData, args: value.split(' ').filter((a) => a) });
				break;
			case 'env': {
				// Parse KEY=value pairs
				const envPairs = value.split(' ').filter((p) => p.includes('='));
				const env = {};
				envPairs.forEach((pair) => {
					const [key, ...valueParts] = pair.split('=');
					env[key] = valueParts.join('=');
				});
				setFormData({ ...formData, env });
				break;
			}
			case 'headers': {
				// Parse Header: value pairs
				const headerPairs = value
					.split(',')
					.map((h) => h.trim())
					.filter((h) => h.includes(':'));
				const headers = {};
				headerPairs.forEach((pair) => {
					const [key, ...valueParts] = pair.split(':');
					headers[key.trim()] = valueParts.join(':').trim();
				});
				setFormData({ ...formData, headers });
				break;
			}
			case 'scope':
				if (['local', 'project', 'user'].includes(value)) {
					setFormData({ ...formData, scope: value });
				}
				break;
		}
	};

	const submitForm = async () => {
		try {
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
			const newServer = {
				id: `server-${Date.now()}`,
				...serverConfig,
				createdAt: new Date().toISOString()
			};
			await addServer(newServer);
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
		setPasteMode(false);
		setPasteContent('');
	};

	const parsePastedConfig = async () => {
		try {
			const parsed = JSON.parse(pasteContent);
			const servers = parsed.mcpServers || parsed;
			const serverNames = Object.keys(servers);
			if (serverNames.length === 0) {
				showToast('No server configuration found in pasted JSON', 'error');
				return;
			}
			let addedCount = 0;
			const errors = [];
			for (const serverName of serverNames) {
				try {
					const serverConfig = servers[serverName];
					const mappedConfig = {
						name: serverName,
						transport: 'stdio',
						command: serverConfig.command || '',
						url: serverConfig.url || '',
						args: serverConfig.args || [],
						env: serverConfig.env || {},
						headers: serverConfig.headers || {},
						scope: 'local'
					};
					if (serverConfig.url) {
						if (serverConfig.url.includes('/sse')) {
							mappedConfig.transport = 'sse';
						} else {
							mappedConfig.transport = 'http';
						}
					}
					const newServer = {
						id: `server-${Date.now()}-${addedCount}`,
						name: mappedConfig.name,
						transport: mappedConfig.transport,
						scope: mappedConfig.scope,
						createdAt: new Date().toISOString()
					};
					if (mappedConfig.transport === 'stdio') {
						newServer.scriptPath = mappedConfig.command;
						newServer.args = mappedConfig.args;
						newServer.env = mappedConfig.env;
					} else {
						newServer.url = mappedConfig.url;
						newServer.headers = mappedConfig.headers;
					}
					await addServer(newServer);
					addedCount++;
				} catch (err) {
					errors.push(`${serverName}: ${err.message}`);
				}
			}
			await loadServerList();
			if (addedCount > 0) {
				const message =
					addedCount === 1
						? `Added 1 MCP server`
						: `Added ${addedCount} MCP servers`;
				showToast(message, 'success');
			}
			if (errors.length > 0) {
				showToast(`Failed to add: ${errors.join(', ')}`, 'error');
			}
			if (addedCount > 0) {
				setShowAddForm(false);
				resetForm();
			}
		} catch (err) {
			if (err instanceof SyntaxError) {
				showToast(
					'Invalid JSON format. Please check your configuration.',
					'error'
				);
			} else {
				showToast(`Failed to parse configuration: ${err.message}`, 'error');
			}
		}
	};

	const removeServerHandler = async (server) => {
		try {
			if (server.id === 'local') {
				showToast('Cannot remove the local server', 'error');
				return;
			}
			if (server.status === 'active') {
				await connectionPool.disconnect(server.id);
			}
			await removeServer(server.id);
			await loadServerList();
			showToast(`Removed MCP server: ${server.name}`, 'success');
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
				await connectionPool.connect(server, logger);
				showToast(`Connected to: ${server.name}`, 'success');
			}
			await loadServerList();
		} catch (err) {
			showToast(`Failed to toggle connection: ${err.message}`, 'error');
		}
	};

	return {
		servers,
		selectedIndex,
		loading,
		error,
		showAddForm,
		view,
		selectedServer,
		selectedTool,
		serverTools,
		formData,
		formField,
		inputValue,
		scrollOffset,
		viewportHeight,
		pasteMode,
		pasteContent,
        getFormFields,
	};
} 