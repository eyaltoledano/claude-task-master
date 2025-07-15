import fs from 'fs/promises';
import path from 'path';
import { findProjectRoot } from '../../../utils.js';

const SERVERS_FILE = 'servers.json';

export async function getServersPath() {
	const projectRoot = findProjectRoot() || process.cwd();
	const mcpDir = path.join(projectRoot, 'scripts', 'modules', 'flow', 'infra', 'mcp');
	await fs.mkdir(mcpDir, { recursive: true });
	return path.join(mcpDir, SERVERS_FILE);
}

export async function loadServers() {
	const filePath = await getServersPath();

	try {
		const data = await fs.readFile(filePath, 'utf8');
		return JSON.parse(data);
	} catch (error) {
		// Return default server if file doesn't exist
		return [
			{
				id: 'local',
				name: 'Local Task Master',
				scriptPath: './mcp-server/server.js',
				description: 'Built-in Task Master MCP server',
				scriptType: 'node',
				status: 'inactive',
				default: true,
				createdAt: new Date().toISOString()
			}
		];
	}
}

export async function saveServers(servers) {
	const filePath = await getServersPath();
	await fs.writeFile(filePath, JSON.stringify(servers, null, 2));
}

export async function addServer(serverData) {
	const servers = await loadServers();

	// Check for duplicate ID
	if (servers.find((s) => s.id === serverData.id)) {
		throw new Error(`Server with ID '${serverData.id}' already exists`);
	}

	// If this is the first custom server, set it as default
	if (servers.length === 1 && servers[0].id === 'local') {
		serverData.default = true;
	}

	servers.push(serverData);
	await saveServers(servers);
	return serverData;
}

export async function updateServer(serverData) {
	const servers = await loadServers();
	const index = servers.findIndex((s) => s.id === serverData.id);

	if (index === -1) {
		throw new Error(`Server with ID '${serverData.id}' not found`);
	}

	servers[index] = { ...servers[index], ...serverData };
	await saveServers(servers);
	return servers[index];
}

export async function removeServer(serverId) {
	const servers = await loadServers();
	const index = servers.findIndex((s) => s.id === serverId);

	if (index === -1) {
		throw new Error(`Server with ID '${serverId}' not found`);
	}

	servers.splice(index, 1);
	await saveServers(servers);
}

export function getDefaultServer(servers) {
	return servers.find((s) => s.default) || servers[0];
}

export function findServerById(servers, id) {
	return servers.find((s) => s.id === id);
}

export async function setDefault(serverId) {
	const servers = await loadServers();

	// Clear all default flags
	servers.forEach((s) => (s.default = false));

	// Set new default
	const server = servers.find((s) => s.id === serverId);
	if (!server) {
		throw new Error(`Server with ID '${serverId}' not found`);
	}

	server.default = true;
	await saveServers(servers);
	return server;
}
