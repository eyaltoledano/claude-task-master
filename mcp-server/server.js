#!/usr/bin/env node

import TaskMasterMCPServer from './src/index.js';
import dotenv from 'dotenv';
import logger from './src/logger.js';

// Load environment variables
dotenv.config({ path: resolve(rootDir, '.env') });

/**
 * Start the MCP server
 */
async function startServer() {
	const server = new TaskMasterMCPServer();

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

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down MCP server...');
  process.exit(0);
});

// Start the server
startServer();
