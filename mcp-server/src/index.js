import { FastMCP } from 'fastmcp';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from './logger.js';
import {
	registerTaskMasterTools,
	getToolsConfiguration
} from './tools/index.js';
import ProviderRegistry from '../../src/provider-registry/index.js';
import { MCPProvider } from './providers/mcp-provider.js';
import packageJson from '../../package.json' with { type: 'json' };

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

		this.server = new FastMCP(this.options);
		this.initialized = false;

		this.init = this.init.bind(this);
		this.start = this.start.bind(this);
		this.stop = this.stop.bind(this);

		this.logger = logger;
	}

	/**
	 * Initialize the MCP server with necessary tools and routes
	 */
	async init() {
		if (this.initialized) return;

		const normalizedToolMode = getToolsConfiguration();

		this.logger.info('Task Master MCP Server starting...');
		this.logger.info(`Tool mode configuration: ${normalizedToolMode}`);

		const registrationResult = registerTaskMasterTools(
			this.server,
			normalizedToolMode
		);

		this.logger.info(
			`Normalized tool mode: ${registrationResult.normalizedMode}`
		);
		this.logger.info(
			`Registered ${registrationResult.registeredTools.length} tools successfully`
		);

		if (registrationResult.registeredTools.length > 0) {
			this.logger.debug(
				`Registered tools: ${registrationResult.registeredTools.join(', ')}`
			);
		}

		if (registrationResult.failedTools.length > 0) {
			this.logger.warn(
				`Failed to register ${registrationResult.failedTools.length} tools: ${registrationResult.failedTools.join(', ')}`
			);
		}

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

		this.server.on('connect', (event) => {
			event.session.server.sendLoggingMessage({
				data: {
					context: event.session.context,
					message: `MCP Server connected: ${event.session.name}`
				},
				level: 'info'
			});
			this.registerRemoteProvider(event.session);
		});

		// Start the FastMCP server with increased timeout
		await this.server.start({
			transportType: 'stdio',
			timeout: 120000 // 2 minutes timeout (in milliseconds)
		});

		return this;
	}

	/**
	 * Register both MCP providers with the provider registry
	 */
	registerRemoteProvider(session) {
		// Check if the server has at least one session
		if (session) {
			// Make sure session has required capabilities
			if (!session.clientCapabilities || !session.clientCapabilities.sampling) {
				session.server.sendLoggingMessage({
					data: {
						context: session.context,
						message: `MCP session missing required sampling capabilities, providers not registered`
					},
					level: 'info'
				});
				return;
			}

			// Register MCP provider with the Provider Registry

			// Register the unified MCP provider
			const mcpProvider = new MCPProvider();
			mcpProvider.setSession(session);

			// Register provider with the registry
			const providerRegistry = ProviderRegistry.getInstance();
			providerRegistry.registerProvider('mcp', mcpProvider);

			session.server.sendLoggingMessage({
				data: {
					context: session.context,
					message: `MCP Server connected`
				},
				level: 'info'
			});
		} else {
			session.server.sendLoggingMessage({
				data: {
					context: session.context,
					message: `No MCP sessions available, providers not registered`
				},
				level: 'warn'
			});
		}
	}

	/**
	 * Stop the MCP server
	 */
	async stop() {
		if (this.server) {
			await this.server.stop();
		}
	}
}

export default TaskMasterMCPServer;
