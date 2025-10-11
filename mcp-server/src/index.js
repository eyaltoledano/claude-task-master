import { FastMCP } from 'fastmcp';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from './logger.js';
import { registerTaskMasterTools } from './tools/index.js';
import ProviderRegistry from '../../src/provider-registry/index.js';
import { MCPProvider } from './providers/mcp-provider.js';
import packageJson from '../../package.json' with { type: 'json' };

// Load environment variables
dotenv.config();

// Constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main MCP server class that integrates with Task Master
 */
class TaskMasterMCPServer {
	constructor() {
		this.options = {
			name: 'Task Master MCP Server',
			version: packageJson.version
		};

		// Create FastMCP instance with JSON Schema Draft-07 compatibility
		this.server = new FastMCP(this.options, {
			toJsonSchema: async (schema) => {
				// Import zod-to-json-schema directly to control the target schema version
				const { zodToJsonSchema } = await import('zod-to-json-schema');
				// Use jsonSchema7 target for MCP client compatibility
				return zodToJsonSchema(schema, { target: 'jsonSchema7' });
			}
		});
		this.initialized = false;

		// Bind methods
		this.init = this.init.bind(this);
		this.start = this.start.bind(this);
		this.stop = this.stop.bind(this);

		// Setup logging
		this.logger = logger;
	}

	/**
	 * Initialize the MCP server with necessary tools and routes
	 */
	async init() {
		if (this.initialized) return;

		// Pass the manager instance to the tool registration function
		registerTaskMasterTools(this.server, this.asyncManager);

		this.initialized = true;

		return this;
	}

	/**
	 * Start the MCP server
	 */
	async start() {
		if (!this.initialized) {
			await this.init();
		}

		// Start with stdio transport and 2 minute timeout
		await this.server.start({
			transport: 'stdio',
			timeout: 120000
		});

		// Log startup
		this.logger.info('MCP server started');

		// Register a disconnect handler
		this.server.on('disconnect', () => {
			this.logger.info('Client disconnected from MCP server');
		});

		// Register the remote MCP providers
		// Only register providers that have the required capabilities
		const providers = ProviderRegistry.getAllProviders();
		for (const provider of providers) {
			try {
				// Check capabilities before registering
				const hasSampling = await provider.hasCapability('sampling');
				if (hasSampling) {
					this.logger.info(`Registering remote provider: ${provider.name}`);
					await this.server.addRemoteProvider(new MCPProvider(provider));
				} else {
					this.logger.warn(`Skipping provider ${provider.name} - missing required capabilities`);
				}
			} catch (error) {
				this.logger.error(`Failed to register provider ${provider.name}: ${error.message}`);
			}
		}

		return this;
	}

	/**
	 * Stop the MCP server
	 */
	async stop() {
		this.logger.info('Stopping MCP server...');
		await this.server.stop();
		this.logger.info('MCP server stopped');
	}
}

export default TaskMasterMCPServer;