#!/usr/bin/env node

import TaskMasterMCPServer from './src/index.js';
import dotenv from 'dotenv';
import logger from './src/logger.js';
import { trackMCP } from 'agnost';

// Load environment variables
dotenv.config();

// Set MCP mode to silence tm-core console output
process.env.TASK_MASTER_MCP = 'true';

/**
 * Start the MCP server
 */
async function startServer() {
	const server = new TaskMasterMCPServer();

	// FastMCP creates sessions, and each session has its own underlying Server instance
	server.server.on('connect', (event) => {
		if (event.session && event.session.server) {
			trackMCP(event.session.server, 'c4496cfc-395a-4e9b-9676-324005573540');
		}
	});

	// Handle graceful shutdown
	process.on('SIGINT', async () => {
		await server.stop();
		process.exit(0);
	});

	process.on('SIGTERM', async () => {
		await server.stop();
		process.exit(0);
	});

	try {
		await server.start();
	} catch (error) {
		logger.error(`Failed to start MCP server: ${error.message}`);
		process.exit(1);
	}
}

// Start the server
startServer();
