import { FastMCP } from 'fastmcp';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from './logger.js';
import { registerTaskMasterTools } from './tools/index.js';
import ProviderRegistry from '../../src/provider-registry/index.js';
import MCPRemoteProvider from './providers/mcp-remote-provider.js';
import { MCPAISDKProvider } from './providers/mcp-ai-sdk-provider.js';

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
		// Get version from package.json using synchronous fs
		const packagePath = path.join(__dirname, '../../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

		this.options = {
			name: 'Task Master MCP Server',
			version: packageJson.version
		};

		this.server = new FastMCP(this.options);
		this.initialized = false;

		this.server.addResource({});

		this.server.addResourceTemplate({});

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

		this.server.on('connect', (event) => {
			this.logger.info(`MCP Server connected: ${event.session}`);
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
				this.logger.warn(
					'MCP session missing required sampling capabilities, providers not registered'
				);
				return;
			}

			// Register BOTH providers with the same MCP session
			
			// 1. Register existing MCPRemoteProvider (keep existing functionality)
			const remoteProvider = new MCPRemoteProvider(this.server);
			remoteProvider.setSession(session);
			
			// 2. Register NEW AI SDK provider
			const aiSdkProvider = new MCPAISDKProvider();
			aiSdkProvider.setSession(session); // Same MCP session, different provider

			// Register both providers with the registry
			const providerRegistry = ProviderRegistry.getInstance();
			providerRegistry.registerProvider('mcp', remoteProvider); // Existing
			providerRegistry.registerProvider('mcp-ai-sdk', aiSdkProvider); // NEW

			this.logger.info('Both MCP providers (remote and AI SDK) registered with Provider Registry');
		} else {
			this.logger.warn(
				'No MCP sessions available, providers not registered'
			);
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
