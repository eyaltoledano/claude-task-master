import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

export class MCPClient {
	constructor(options = {}) {
		this.client = null;
		this.transport = null;
		this.serverPath = null;
		this.log = options.log || console;
		this.process = null;
	}

	async connect(serverConfig, options = {}) {
		try {
			// Handle both string path and server configuration object
			let command, args, env;
			
			if (typeof serverConfig === 'string') {
				// Legacy: just a script path
				this.serverPath = serverConfig;
				
				// Determine command based on file extension
				if (serverConfig.endsWith('.py')) {
					command = 'python';
					args = [serverConfig];
				} else if (serverConfig.endsWith('.js')) {
					command = 'node';
					args = [serverConfig];
				} else if (serverConfig.endsWith('.jar')) {
					command = 'java';
					args = ['-jar', serverConfig];
				} else {
					// Assume it's a binary
					command = serverConfig;
					args = [];
				}
				env = process.env;
			} else {
				// New: server configuration object
				if (serverConfig.command) {
					// Direct command execution (e.g., npx, uvx)
					command = serverConfig.command;
					args = serverConfig.args || [];
					env = { ...process.env, ...(serverConfig.env || {}) };
				} else if (serverConfig.scriptPath) {
					// Script path execution
					this.serverPath = serverConfig.scriptPath;
					
					if (serverConfig.scriptPath.endsWith('.py')) {
						command = 'python';
						args = [serverConfig.scriptPath];
					} else if (serverConfig.scriptPath.endsWith('.js')) {
						command = 'node';
						args = [serverConfig.scriptPath];
					} else if (serverConfig.scriptPath.endsWith('.jar')) {
						command = 'java';
						args = ['-jar', serverConfig.scriptPath];
					} else {
						// Assume it's a binary
						command = serverConfig.scriptPath;
						args = [];
					}
					// Append any additional args
					args = [...args, ...(serverConfig.args || [])];
					env = { ...process.env, ...(serverConfig.env || {}) };
				} else {
					throw new Error('Server configuration must have either command or scriptPath');
				}
			}

			this.log.info(`Launching MCP server: ${command} ${args.join(' ')}`);

			// Create the transport
			this.transport = new StdioClientTransport({
				command,
				args,
				env
			});

			// Connect the client
			this.client = new Client(
				{
					name: 'taskmaster-flow',
					version: '1.0.0'
				},
				{
					capabilities: {}
				}
			);

			await this.client.connect(this.transport);

			return true;
		} catch (error) {
			this.log.error('Failed to connect to MCP server:', error);
			throw error;
		}
	}

	async listTools() {
		if (!this.client) {
			throw new Error('Not connected to MCP server');
		}

		try {
			const response = await this.client.listTools();
			return response.tools || [];
		} catch (error) {
			this.log.error('Failed to list tools:', error);
			return [];
		}
	}

	async callTool(toolName, args = {}) {
		if (!this.client) {
			throw new Error('Not connected to MCP server');
		}

		try {
			const result = await this.client.callTool(toolName, args);

			// Extract the actual content from MCP response
			if (result.content && result.content.length > 0) {
				const content = result.content[0];

				// Handle different content types
				if (content.type === 'text') {
					// Try to parse JSON response
					try {
						return JSON.parse(content.text);
					} catch {
						// Return as-is if not JSON
						return { text: content.text };
					}
				} else if (content.type === 'resource') {
					return content;
				}
			}

			return {};
		} catch (error) {
			this.log.error(`Failed to call tool ${toolName}:`, error);
			throw error;
		}
	}

	async close() {
		if (this.client) {
			await this.client.close();
			this.client = null;
		}
		if (this.transport) {
			await this.transport.close();
			this.transport = null;
		}
	}

	isConnected() {
		return this.client !== null;
	}
}
