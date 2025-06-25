import { MCPClient } from './client.js';

class MCPConnectionPool {
	constructor() {
		this.connections = new Map();
		this.connectionStatus = new Map();
	}

	async connect(server, log) {
		try {
			// Update status
			this.connectionStatus.set(server.id, 'connecting');

			// Close existing connection if any
			if (this.connections.has(server.id)) {
				await this.disconnect(server.id);
			}

			const client = new MCPClient({ log });
			await client.connect(server.scriptPath);

			this.connections.set(server.id, client);
			this.connectionStatus.set(server.id, 'active');

			return client;
		} catch (error) {
			this.connectionStatus.set(server.id, 'error');
			throw error;
		}
	}

	async disconnect(serverId) {
		const client = this.connections.get(serverId);
		if (client) {
			await client.close();
			this.connections.delete(serverId);
			this.connectionStatus.set(serverId, 'inactive');
		}
	}

	getClient(serverId) {
		return this.connections.get(serverId);
	}

	getStatus(serverId) {
		return this.connectionStatus.get(serverId) || 'inactive';
	}

	async listTools(serverId) {
		const client = this.connections.get(serverId);
		if (!client) {
			throw new Error('Server not connected');
		}
		return await client.listTools();
	}

	async disconnectAll() {
		for (const serverId of this.connections.keys()) {
			await this.disconnect(serverId);
		}
	}
}

export const connectionPool = new MCPConnectionPool();
