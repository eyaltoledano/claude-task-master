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

	async connect(serverScriptPath, options = {}) {
		try {
			this.serverPath = serverScriptPath;

			// Determine command based on file extension
			let command, args;
			if (serverScriptPath.endsWith('.py')) {
				command = 'python';
				args = [serverScriptPath];
			} else if (serverScriptPath.endsWith('.js')) {
				command = 'node';
				args = [serverScriptPath];
			} else if (serverScriptPath.endsWith('.jar')) {
				command = 'java';
				args = ['-jar', serverScriptPath];
			} else {
				// Assume it's a binary
				command = serverScriptPath;
				args = [];
			}

			// Create the transport
			this.transport = new StdioClientTransport({
				command,
				args,
				env: process.env
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
