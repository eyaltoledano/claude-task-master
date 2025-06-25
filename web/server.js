#!/usr/bin/env node

/**
 * Task Master Web Server Launcher
 *
 * Simple launcher script for the Task Master web interface.
 * Handles command-line arguments and graceful shutdown.
 */

import {
	initializeWebInterface,
	stopWebInterface,
	checkWebDependencies
} from './index.js';
import { getStateFilePath, getWebServerProjectRoot } from './utils.js';
import path from 'path';
import fs from 'fs';

/**
 * Update server state file with new information
 * @param {Object} stateUpdate - State information to update
 * @param {string} projectRoot - Project root directory
 */
async function updateServerState(stateUpdate, projectRoot) {
	try {
		const stateFilePath = getStateFilePath(projectRoot);

		// Ensure .taskmaster directory exists
		const stateDir = path.dirname(stateFilePath);
		if (!fs.existsSync(stateDir)) {
			fs.mkdirSync(stateDir, { recursive: true });
		}

		// Read existing state if it exists
		let currentState = {};
		if (fs.existsSync(stateFilePath)) {
			try {
				const stateData = fs.readFileSync(stateFilePath, 'utf8');
				currentState = JSON.parse(stateData);
			} catch (error) {
				console.warn(
					'Warning: Could not read existing state file:',
					error.message
				);
			}
		}

		// Merge with new state
		const updatedState = {
			...currentState,
			...stateUpdate,
			timestamp: Date.now()
		};

		fs.writeFileSync(stateFilePath, JSON.stringify(updatedState, null, 2));
	} catch (error) {
		console.error('Failed to update server state:', error.message);
	}
}

// Parse command line arguments
const args = process.argv.slice(2);
const port =
	parseInt(args.find((arg) => arg.startsWith('--port='))?.split('=')[1]) ||
	parseInt(process.env.PORT) ||
	3001;
const host =
	args.find((arg) => arg.startsWith('--host='))?.split('=')[1] ||
	process.env.HOST ||
	'localhost';
// Check for command line project root override, otherwise use smart detection
const explicitProjectRoot = args
	.find((arg) => arg.startsWith('--project-root='))
	?.split('=')[1];
const projectRoot = getWebServerProjectRoot(explicitProjectRoot);

// Show help
if (args.includes('--help') || args.includes('-h')) {
	console.log(`
Task Master Web Server

Usage: node web/server.js [options]

Options:
  --port=<port>          Port number (default: 3001)
  --host=<host>          Host address (default: localhost)
  --project-root=<path>  Project root directory path
  --skip-websocket       Disable WebSocket support
  --skip-watcher         Disable file watching
  --deps-check           Check dependencies and exit
  --help, -h             Show this help message

Environment Variables:
  PORT                        Port number
  HOST                        Host address
  TASK_MASTER_PROJECT_ROOT    Project root directory path
  NODE_ENV                    Environment (development|production|test)

Note: Test isolation is now handled via tag-based contexts instead of separate directories.
`);
	process.exit(0);
}

// Check dependencies if requested
if (args.includes('--deps-check')) {
	console.log('Checking web dependencies...\n');
	const deps = checkWebDependencies();

	console.log(
		'Server dependencies:',
		deps.server.available ? '✅ Available' : '❌ Missing'
	);
	if (deps.server.missing.length > 0) {
		console.log('  Missing:', deps.server.missing.join(', '));
	}

	console.log(
		'Build dependencies:',
		deps.build.available ? '✅ Available' : '❌ Missing'
	);
	if (deps.build.missing.length > 0) {
		console.log('  Missing:', deps.build.missing.join(', '));
	}

	console.log('\nDetailed status:');
	Object.entries(deps.status).forEach(([dep, available]) => {
		console.log(`  ${dep}: ${available ? '✅' : '❌'}`);
	});

	process.exit(deps.server.available ? 0 : 1);
}

// Server configuration
const config = {
	port,
	host,
	enableWebSocket: !args.includes('--skip-websocket'),
	enableFileWatcher: !args.includes('--skip-watcher'),
	projectRoot
};

console.log(`Starting Task Master Web Interface...`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Project Root: ${projectRoot}`);
console.log(`Configuration:`, config);

let serverInfo = null;

// Graceful shutdown handler
async function gracefulShutdown(signal) {
	console.log(`\n${signal} received. Shutting down gracefully...`);

	if (serverInfo) {
		try {
			await stopWebInterface();
			console.log('Web interface stopped successfully');
		} catch (error) {
			console.error('Error during shutdown:', error);
			process.exit(1);
		}
	}

	process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
	gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
	gracefulShutdown('unhandledRejection');
});

// Start the server
async function startServer() {
	try {
		serverInfo = await initializeWebInterface(config);

		// Update server state to indicate successful startup
		await updateServerState(
			{
				pid: process.pid,
				port: config.port,
				host: config.host,
				url: serverInfo.url,
				background: true,
				hasWebSocket: !!serverInfo.wsServer,
				hasFileWatcher: !!serverInfo.fileWatcher,
				status: 'running',
				startTime: new Date().toISOString()
			},
			projectRoot
		);

		console.log(`\n🚀 Task Master Web Interface started successfully!`);
		console.log(`   URL: ${serverInfo.url}`);
		console.log(
			`   WebSocket: ${serverInfo.wsServer ? 'Enabled' : 'Disabled'}`
		);
		console.log(
			`   File Watcher: ${serverInfo.fileWatcher ? 'Enabled' : 'Disabled'}`
		);
		console.log(`\n💡 To stop the server, press Ctrl+C`);

		if (process.env.NODE_ENV === 'development') {
			console.log(`\n📝 Development mode:
   - File changes will trigger hot reloads
   - WebSocket connections will receive live updates
   - Detailed logging is enabled
   
   Build the React assets first: npm run build:web
   Or run the development server: npm run dev:web`);
		}
	} catch (error) {
		console.error('Failed to start web interface:', error.message);

		// Update state to indicate failure
		await updateServerState(
			{
				pid: process.pid,
				status: 'failed',
				error: error.message,
				timestamp: new Date().toISOString()
			},
			projectRoot
		);

		if (error.message.includes('dependencies')) {
			console.log('\n💡 To install missing dependencies, run:');
			console.log('   npm install');
		}

		process.exit(1);
	}
}

// Start the server
startServer().catch((error) => {
	console.error('Startup error:', error);
	process.exit(1);
});
