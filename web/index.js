/**
 * Task Master Web Interface Entry Point
 *
 * This module provides the main entry point for the web interface functionality,
 * using conditional loading to ensure graceful fallback when web dependencies
 * are not available.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import webLoader from '../scripts/modules/web-loader.js';
import { getWebServerStateFilePath, getTaskMasterDirectory } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Web server state
let server = null;
let wsServer = null;
let fileWatcher = null;
let globalHealthMonitor = null;

/**
 * Simple debounce implementation to avoid adding lodash dependency
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Enhanced File Watcher Class
 * Implements the requirements from Task 5 with debouncing and comprehensive event handling
 */
class FileWatcher {
	constructor(projectRoot, onUpdate = null) {
		this.projectRoot = projectRoot;
		this.onUpdate = onUpdate;
		this.watcher = null;
		this.isInitialized = false;

		// Debounced update with 100ms delay as specified in task 5
		this.debouncedUpdate = debounce((eventType, filePath) => {
			console.log(`File watcher event: ${eventType} - ${filePath}`);

			// Broadcast to WebSocket clients
			this._broadcastToWebSocket(eventType, filePath);

			// Call custom update handler if provided
			if (this.onUpdate && typeof this.onUpdate === 'function') {
				this.onUpdate(eventType, filePath);
			}
		}, 100);
	}

	/**
	 * Initialize the file watcher with chokidar
	 * @returns {Promise<Object>} File watcher instance
	 */
	async initialize() {
		const chokidar = webLoader.loadChokidar();

		if (!chokidar) {
			throw new Error('File watcher dependency (chokidar) not available');
		}

		// Use standard taskmaster directory for task files
		const taskMasterDir = '.taskmaster';

		// Watch for changes in task files and web assets
		const watchPaths = [
			path.join(this.projectRoot, taskMasterDir, 'tasks/**/*.json'),
			path.join(this.projectRoot, 'web/src/**/*'),
			path.join(this.projectRoot, 'scripts/**/*.js')
		];

		console.log(
			`Watching task files in: ${path.join(this.projectRoot, taskMasterDir, 'tasks/')}`
		);
		console.log(`All watch paths:`, watchPaths);

		this.watcher = chokidar.watch(watchPaths, {
			ignored: /node_modules|\.git|dist|\.DS_Store/,
			persistent: true,
			ignoreInitial: true,
			// Add awaitWriteFinish to prevent partial file reads
			awaitWriteFinish: {
				stabilityThreshold: 50,
				pollInterval: 10
			},
			// Additional options for better cross-platform support
			usePolling: false,
			interval: 100,
			binaryInterval: 300
		});

		// Handle all relevant file system events as specified in task 5
		this.watcher
			.on('add', (filePath) => {
				this.debouncedUpdate('TASK_FILE_ADDED', filePath);
			})
			.on('change', (filePath) => {
				this.debouncedUpdate('TASKS_UPDATED', filePath);
			})
			.on('unlink', (filePath) => {
				this.debouncedUpdate('TASK_FILE_DELETED', filePath);
			})
			.on('addDir', (dirPath) => {
				this.debouncedUpdate('DIRECTORY_ADDED', dirPath);
			})
			.on('unlinkDir', (dirPath) => {
				this.debouncedUpdate('DIRECTORY_DELETED', dirPath);
			})
			.on('error', (error) => {
				console.error('File watcher error:', error);
				// Emit error event for potential error handling
				this._broadcastToWebSocket('WATCHER_ERROR', error.message);
			})
			.on('ready', () => {
				console.log('File watcher is ready and watching for changes');
				this.isInitialized = true;
			});

		return this.watcher;
	}

	/**
	 * Broadcast file change events to WebSocket clients
	 * @private
	 * @param {string} eventType - Type of file system event
	 * @param {string} filePath - Path of the affected file
	 */
	_broadcastToWebSocket(eventType, filePath) {
		if (wsServer && wsServer.clients) {
			const message = {
				type: eventType,
				path: filePath,
				timestamp: Date.now(),
				relativePath: path.relative(this.projectRoot, filePath)
			};

			wsServer.clients.forEach((client) => {
				if (client.readyState === 1) {
					// WebSocket.OPEN
					try {
						client.send(JSON.stringify(message));
					} catch (error) {
						console.warn('Failed to send WebSocket message:', error.message);
					}
				}
			});
		}
	}

	/**
	 * Check if the file watcher is ready
	 * @returns {boolean} True if watcher is initialized and ready
	 */
	isReady() {
		return this.isInitialized && this.watcher !== null;
	}

	/**
	 * Get watched paths
	 * @returns {Array<string>} Array of watched paths
	 */
	getWatchedPaths() {
		if (this.watcher) {
			return this.watcher.getWatched();
		}
		return [];
	}

	/**
	 * Close the file watcher and clean up resources
	 * @returns {Promise<void>}
	 */
	async close() {
		if (this.watcher) {
			console.log('Closing file watcher...');
			try {
				await this.watcher.close();
				this.watcher = null;
				this.isInitialized = false;
				console.log('File watcher closed successfully');
			} catch (error) {
				console.error('Error closing file watcher:', error);
				throw error;
			}
		}
	}
}

/**
 * Get web server state file path
 * @param {string} projectRoot - Project root directory
 * @returns {string} State file path
 */
function getStateFilePath(projectRoot) {
	return getWebServerStateFilePath(projectRoot);
}

/**
 * Save server state to file
 * @param {Object} serverState - Server state object
 * @param {string} projectRoot - Project root directory
 */
function saveServerState(serverState, projectRoot) {
	const stateFilePath = getStateFilePath(projectRoot);
	try {
		// Ensure directory exists
		const stateDir = path.dirname(stateFilePath);
		if (!fs.existsSync(stateDir)) {
			fs.mkdirSync(stateDir, { recursive: true });
		}

		// Save state with timestamp
		const stateData = {
			...serverState,
			lastUpdated: Date.now()
		};

		fs.writeFileSync(stateFilePath, JSON.stringify(stateData, null, 2));
		console.log(`Server state saved to: ${stateFilePath}`);
	} catch (error) {
		console.warn('Failed to save server state:', error.message);
	}
}

/**
 * Load server state from file
 * @param {string} projectRoot - Project root directory
 * @returns {Object|null} Server state or null if not found
 */
function loadServerState(projectRoot) {
	const stateFilePath = getStateFilePath(projectRoot);
	try {
		if (!fs.existsSync(stateFilePath)) {
			return null;
		}

		const stateData = fs.readFileSync(stateFilePath, 'utf8');
		return JSON.parse(stateData);
	} catch (error) {
		console.warn('Failed to load server state:', error.message);
		return null;
	}
}

/**
 * Clear server state file
 * @param {string} projectRoot - Project root directory
 */
function clearServerState(projectRoot) {
	const stateFilePath = getStateFilePath(projectRoot);
	try {
		if (fs.existsSync(stateFilePath)) {
			fs.unlinkSync(stateFilePath);
			console.log('Server state cleared');
		}
	} catch (error) {
		console.warn('Failed to clear server state:', error.message);
	}
}

/**
 * Check if a process is running
 * @param {number} pid - Process ID
 * @returns {boolean} True if process is running
 */
function isProcessRunning(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return false;
	}
}

/**
 * Start Express server with optional background mode
 * @param {Object} options - Server configuration options
 * @param {boolean} background - Whether to start in background
 * @returns {Promise<Object>} Server information
 */
export async function startExpressServer(options = {}, background = false) {
	const {
		port = 3001,
		host = 'localhost',
		enableWebSocket = true,
		enableFileWatcher = true,
		projectRoot = process.cwd()
	} = options;

	// Check if server is already running
	const existingState = loadServerState(projectRoot);
	if (existingState && isProcessRunning(existingState.pid)) {
		throw new Error(
			`Server is already running on port ${existingState.port} (PID: ${existingState.pid})`
		);
	}

	// Clear stale state if process is not running
	if (existingState && !isProcessRunning(existingState.pid)) {
		clearServerState(projectRoot);
	}

	// Check for port conflicts
	const isPortBusy = await checkPortInUse(port);
	if (isPortBusy) {
		throw new Error(`Port ${port} is already in use by another process`);
	}

	if (background) {
		// Start server in background as a detached process
		return startServerInBackground(options);
	} else {
		// Start server in current process
		return startServerInCurrentProcess(options);
	}
}

/**
 * Start server in current process (foreground)
 * @param {Object} options - Server configuration options
 * @returns {Promise<Object>} Server information
 */
async function startServerInCurrentProcess(options) {
	const { projectRoot = process.cwd() } = options;

	try {
		const serverInfo = await initializeWebInterface(options);

		// Save server state with current process PID
		const serverState = {
			pid: process.pid,
			port: serverInfo.port,
			host: serverInfo.host,
			url: serverInfo.url,
			background: false,
			hasWebSocket: !!serverInfo.wsServer,
			hasFileWatcher: !!serverInfo.fileWatcher
		};

		saveServerState(serverState, projectRoot);

		// Setup cleanup on process exit
		const cleanup = () => {
			clearServerState(projectRoot);
			stopWebInterface().catch(() => {});
		};

		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);
		process.on('exit', cleanup);

		return {
			...serverInfo,
			pid: process.pid,
			background: false
		};
	} catch (error) {
		clearServerState(projectRoot);
		throw error;
	}
}

/**
 * Start server in background as detached process
 * @param {Object} options - Server configuration options
 * @returns {Promise<Object>} Server information
 */
function startServerInBackground(options) {
	const {
		port = 3001,
		host = 'localhost',
		enableWebSocket = true,
		enableFileWatcher = true,
		projectRoot = process.cwd()
	} = options;

	return new Promise((resolve, reject) => {
		// Build command arguments
		const args = [
			path.join(__dirname, 'server.js'),
			`--port=${port}`,
			`--host=${host}`,
			`--project-root=${projectRoot}`
		];

		if (!enableWebSocket) args.push('--skip-websocket');
		if (!enableFileWatcher) args.push('--skip-watcher');

		// Start detached process
		const child = spawn('node', args, {
			detached: true,
			stdio: 'ignore'
		});

		// Unref to allow parent process to exit
		child.unref();

		// Save server state immediately for background process
		const serverState = {
			pid: child.pid,
			port,
			host,
			url: `http://${host}:${port}`,
			background: true,
			hasWebSocket: enableWebSocket,
			hasFileWatcher: enableFileWatcher
		};

		saveServerState(serverState, projectRoot);

		// Return immediately - true fire-and-forget daemon behavior
		resolve({
			pid: child.pid,
			port,
			host,
			url: `http://${host}:${port}`,
			background: true,
			message: `Server started in background (PID: ${child.pid})`
		});
	});
}

/**
 * Check if a port is in use
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} True if port is in use
 */
async function checkPortInUse(port) {
	return new Promise((resolve) => {
		const { createServer } = webLoader.loadNet();
		if (!createServer) {
			resolve(false); // Can't check, assume available
			return;
		}

		const server = createServer();
		server.listen(port, () => {
			server.once('close', () => resolve(false));
			server.close();
		});
		server.on('error', () => resolve(true));
	});
}

/**
 * Initialize the complete web interface
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Server components
 */
export async function initializeWebInterface(options = {}) {
	const {
		port = 3001,
		host = 'localhost',
		enableWebSocket = true,
		enableFileWatcher = true,
		projectRoot = process.cwd()
	} = options;

	// Validate web dependencies
	const express = webLoader.loadExpress();
	const serveStatic = webLoader.loadServeStatic();

	if (!express) {
		throw new Error(
			'Web server dependencies not available. Run: npm install express'
		);
	}

	if (!serveStatic) {
		throw new Error(
			'Static file serving dependency not available. Run: npm install serve-static'
		);
	}

	console.log(`Using project root: ${projectRoot}`);

	// Initialize health monitoring system
	try {
		const { initializeHealthMonitor } = await import(
			'./middleware/health-monitor.js'
		);
		const healthMonitor = await initializeHealthMonitor(projectRoot);
		globalHealthMonitor = healthMonitor;
		console.log('🏥 Health monitoring system started');
	} catch (error) {
		console.warn('⚠️  Health monitoring initialization failed:', error.message);
		// Continue without health monitoring - server should still work
	}

	// Import createApiRouter from api-routes.js
	const { createApiRouter } = await import('./api-routes.js');

	// Setup Express app
	const app = express();

	// Enable JSON parsing for API requests
	app.use(express.json());

	// Setup API router with tag-based isolation (no test mode)
	const apiRouter = createApiRouter(projectRoot);
	app.use('/api', apiRouter);

	// Serve static assets from web/dist directory for the React frontend
	const staticPath = path.join(__dirname, 'dist');
	console.log(`Serving static files from: ${staticPath}`);
	app.use('/', serveStatic(staticPath));

	// Fallback route for SPA - serve index.html for any non-API routes
	app.get('*', (req, res) => {
		res.sendFile(path.join(staticPath, 'index.html'));
	});

	// Start HTTP server with proper error handling
	const httpServer = app.listen(port, host, () => {
		console.log(
			`✅ Task Master Web Interface running at http://${host}:${port}`
		);
		console.log('📚 Available endpoints:');
		console.log(`   • GET  http://${host}:${port}/ - Web Interface`);
		console.log(`   • GET  http://${host}:${port}/api - API Documentation`);
	});

	// Handle server errors, especially port binding issues
	httpServer.on('error', (error) => {
		if (error.code === 'EADDRINUSE') {
			console.error(
				`❌ Port ${port} is already in use. Please choose a different port or stop the existing server.`
			);
			throw new Error(`Port ${port} is already in use`);
		} else if (error.code === 'EACCES') {
			console.error(
				`❌ Permission denied: Cannot bind to port ${port}. Try using a port number above 1024.`
			);
			throw new Error(`Permission denied for port ${port}`);
		} else {
			console.error(`❌ Server error:`, error.message);
			throw error;
		}
	});

	// Store server reference for cleanup
	server = httpServer;

	const serverInfo = {
		app,
		server: httpServer,
		port,
		host,
		url: `http://${host}:${port}`
	};

	// Initialize additional services if requested
	if (enableWebSocket || enableFileWatcher) {
		const setupAdditionalServices = async () => {
			try {
				// Setup WebSocket if enabled
				if (enableWebSocket) {
					try {
						const webSocketServer = await initializeWebSocket(httpServer);
						wsServer = webSocketServer;
						serverInfo.wsServer = webSocketServer;
						console.log(`🌐 WebSocket server initialized`);
					} catch (wsError) {
						console.warn(
							'⚠️  WebSocket initialization failed:',
							wsError.message
						);
						// Continue without WebSocket - it's optional
					}
				}

				// Setup File Watcher if enabled
				if (enableFileWatcher) {
					try {
						const watcher = await initializeFileWatcher(projectRoot);
						fileWatcher = watcher;
						serverInfo.fileWatcher = watcher;
						console.log('📁 File watcher initialized');
					} catch (watcherError) {
						console.warn(
							'⚠️  File watcher initialization failed:',
							watcherError.message
						);
						// Continue without file watcher - it's optional
					}
				}
			} catch (error) {
				console.warn('⚠️  Error setting up additional services:', error.message);
				// Don't fail the entire server startup for optional features
			}
		};

		// Setup additional services asynchronously to avoid blocking server startup
		setupAdditionalServices();
	}

	return serverInfo;
}

/**
 * Initialize WebSocket server for real-time communication
 * @param {Object} httpServer - HTTP server instance
 * @returns {Promise<Object>} WebSocket server instance
 */
async function initializeWebSocket(httpServer) {
	const WebSocketClass = webLoader.loadWebSocket();

	if (!WebSocketClass) {
		throw new Error('WebSocket dependency not available. Run: npm install ws');
	}

	// Create WebSocket server attached to HTTP server
	const wss = new WebSocketClass.WebSocketServer({
		server: httpServer,
		path: '/ws'
	});

	// Handle WebSocket connections
	wss.on('connection', (ws, req) => {
		console.log(
			`🔌 WebSocket client connected from ${req.socket.remoteAddress}`
		);

		// Send welcome message
		ws.send(
			JSON.stringify({
				type: 'WELCOME',
				timestamp: Date.now(),
				message: 'Connected to Task Master WebSocket server'
			})
		);

		// Handle client messages
		ws.on('message', (data) => {
			try {
				const message = JSON.parse(data.toString());
				console.log('📨 WebSocket message received:', message);

				// Echo message back for now (can be extended for specific functionality)
				ws.send(
					JSON.stringify({
						type: 'ECHO',
						timestamp: Date.now(),
						original: message
					})
				);
			} catch (error) {
				console.warn('Invalid WebSocket message:', error.message);
			}
		});

		// Handle client disconnect
		ws.on('close', () => {
			console.log('🔌 WebSocket client disconnected');
		});

		// Handle WebSocket errors
		ws.on('error', (error) => {
			console.error('WebSocket error:', error.message);
		});
	});

	// Handle WebSocket server errors
	wss.on('error', (error) => {
		console.error('WebSocket server error:', error.message);
	});

	return wss;
}

/**
 * Initialize file watcher for real-time task updates
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<Object>} File watcher instance
 */
async function initializeFileWatcher(projectRoot) {
	const watcher = new FileWatcher(projectRoot);
	await watcher.initialize();
	return watcher;
}

/**
 * Stop the web interface and clean up resources
 * @param {boolean} force - Force stop without graceful shutdown
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<Object>} Shutdown information
 */
export async function stopWebInterface(
	force = false,
	projectRoot = process.cwd()
) {
	const results = {
		httpServer: false,
		webSocket: false,
		fileWatcher: false,
		healthMonitor: false,
		stateCleared: false
	};

	// Load existing server state
	const serverState = loadServerState(projectRoot);

	try {
		// Stop health monitoring first
		if (globalHealthMonitor) {
			try {
				await globalHealthMonitor.stopMonitoring();
				globalHealthMonitor = null;
				results.healthMonitor = true;
				console.log('🏥 Health monitoring stopped');
			} catch (error) {
				console.warn('⚠️  Error stopping health monitoring:', error.message);
			}
		}

		// Close file watcher
		if (fileWatcher) {
			try {
				await fileWatcher.close();
				fileWatcher = null;
				results.fileWatcher = true;
				console.log('📁 File watcher stopped');
			} catch (error) {
				console.warn('⚠️  Error stopping file watcher:', error.message);
			}
		}

		// Close WebSocket server
		if (wsServer) {
			try {
				wsServer.close();
				wsServer = null;
				results.webSocket = true;
				console.log('🌐 WebSocket server stopped');
			} catch (error) {
				console.warn('⚠️  Error stopping WebSocket server:', error.message);
			}
		}

		// Close HTTP server
		if (server) {
			try {
				await new Promise((resolve, reject) => {
					const timeout = setTimeout(() => {
						if (force) {
							console.log('🔥 Force closing HTTP server...');
							server.destroy();
							resolve();
						} else {
							reject(new Error('Server shutdown timeout'));
						}
					}, 5000);

					server.close((error) => {
						clearTimeout(timeout);
						if (error) {
							reject(error);
						} else {
							resolve();
						}
					});
				});

				server = null;
				results.httpServer = true;
				console.log('🛑 HTTP server stopped');
			} catch (error) {
				console.warn('⚠️  Error stopping HTTP server:', error.message);
				if (force && server) {
					server.destroy();
					server = null;
					results.httpServer = true;
					console.log('🔥 HTTP server force stopped');
				}
			}
		}

		// Clear server state
		clearServerState(projectRoot);
		results.stateCleared = true;

		return {
			success: true,
			message: 'Web interface stopped successfully',
			details: results,
			serverState
		};
	} catch (error) {
		console.error('❌ Error during web interface shutdown:', error.message);
		return {
			success: false,
			error: error.message,
			details: results,
			serverState
		};
	}
}

/**
 * Get current web interface status
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Status information
 */
export function getWebInterfaceStatus(projectRoot = process.cwd()) {
	const serverState = loadServerState(projectRoot);

	if (!serverState) {
		return {
			running: false,
			message: 'No server state found'
		};
	}

	const isRunning = isProcessRunning(serverState.pid);

	if (!isRunning) {
		// Clean up stale state
		clearServerState(projectRoot);
		return {
			running: false,
			message: 'Server process is not running (stale state cleaned)',
			lastState: serverState
		};
	}

	return {
		running: true,
		pid: serverState.pid,
		port: serverState.port,
		host: serverState.host,
		url: serverState.url,
		background: serverState.background,
		hasWebSocket: serverState.hasWebSocket,
		hasFileWatcher: serverState.hasFileWatcher,
		lastUpdated: serverState.lastUpdated,
		message: `Server is running at ${serverState.url}`
	};
}

/**
 * Check if web dependencies are available
 * @returns {Object} Dependency availability status
 */
export function checkWebDependencies() {
	const dependencies = {
		express: !!webLoader.loadExpress(),
		serveStatic: !!webLoader.loadServeStatic(),
		webSocket: !!webLoader.loadWebSocket(),
		chokidar: !!webLoader.loadChokidar(),
		net: !!webLoader.loadNet()
	};

	const requiredMissing = [];
	const optionalMissing = [];

	// Check required dependencies
	if (!dependencies.express) requiredMissing.push('express');
	if (!dependencies.serveStatic) requiredMissing.push('serve-static');

	// Check optional dependencies
	if (!dependencies.webSocket) optionalMissing.push('ws');
	if (!dependencies.chokidar) optionalMissing.push('chokidar');

	return {
		dependencies,
		allAvailable: requiredMissing.length === 0,
		requiredMissing,
		optionalMissing,
		installCommand:
			requiredMissing.length > 0
				? `npm install ${requiredMissing.join(' ')}`
				: null,
		optionalInstallCommand:
			optionalMissing.length > 0
				? `npm install ${optionalMissing.join(' ')}`
				: null
	};
}
