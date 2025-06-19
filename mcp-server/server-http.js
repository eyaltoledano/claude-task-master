#!/usr/bin/env node

import { program } from 'commander';
import TaskMasterMCPServer from './src/index.js';
import dotenv from 'dotenv';
import logger from './src/logger.js';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

/**
 * Start the MCP server in HTTP streaming mode
 */
async function startServer(options) {
	const server = new TaskMasterMCPServer();
	const port = options.port || 3000;

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
		await server.start({
			transportType: 'httpStream',
			port: parseInt(port, 10)
		});
		logger.info(`MCP server started in HTTP streaming mode on port ${port}`);
	} catch (error) {
		logger.error(`Error: ${error.message}`);
		if (error.code === 'EADDRINUSE') {
			logger.error(
				chalk.yellow(
					`Port ${port} is already in use. Try using a different port with --port option.`
				)
			);
		}
		process.exit(1);
	}
}

// Set up Commander
program
	.name('task-master-mcp')
	.description('Task Master MCP Server - HTTP streaming mode')
	.version('1.0.0')
	.option('-p, --port <number>', 'Port to run the server on', parseInt)
	.action(async (options) => {
		try {
			await startServer(options);
		} catch (error) {
			logger.error(`Failed to start MCP server: ${error.message}`);
			process.exit(1);
		}
	});

// Parse command line arguments
program.parse();
