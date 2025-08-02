import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Track server startup time
let startTime;

/**
 * Create and configure the Express server
 * @param {Object} options - Server configuration options
 * @param {number} options.port - Preferred port number (default: 3000)
 * @param {boolean} options.verbose - Enable verbose logging
 * @returns {Promise<{app: Express, server: http.Server, port: number}>}
 */
export async function createServer(options = {}) {
	startTime = Date.now();
	
	const app = express();
	const preferredPort = options.port || 3000;

	// Configure CORS for localhost only
	const corsOptions = {
		origin: (origin, callback) => {
			// Allow requests with no origin (like mobile apps or curl requests)
			if (!origin) return callback(null, true);
			
			// Check if origin is localhost
			const allowedOrigins = [
				'http://localhost:3000',
				'http://localhost:3001',
				'http://localhost:3002',
				'http://localhost:3003',
				'http://localhost:3004',
				'http://localhost:3005',
				'http://127.0.0.1:3000',
				'http://127.0.0.1:3001',
				'http://127.0.0.1:3002',
				'http://127.0.0.1:3003',
				'http://127.0.0.1:3004',
				'http://127.0.0.1:3005'
			];
			
			if (allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				callback(null, false);
			}
		},
		credentials: true
	};

	// Apply middleware
	app.use(cors(corsOptions));
	app.use(express.json());
	app.use(express.static(path.join(__dirname, '../client')));

	// Request logging middleware
	app.use((req, res, next) => {
		console.log(`${req.method} ${req.path}`);
		next();
	});

	// Health check endpoint
	app.get('/api/health', (req, res) => {
		res.json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			uptime: process.uptime()
		});
	});

	// 404 handler
	app.use((req, res, next) => {
		if (req.path.startsWith('/api/')) {
			res.status(404).json({ error: 'Not found' });
		} else {
			next();
		}
	});

	// Error handling middleware
	app.use((err, req, res, next) => {
		console.error('Error:', err.message);
		res.status(500).json({
			error: 'Internal server error',
			message: err.message
		});
	});

	// Find available port
	const port = await findAvailablePort(preferredPort);

	// Create HTTP server
	const server = http.createServer(app);

	// Start server
	await new Promise((resolve, reject) => {
		server.listen(port, '127.0.0.1', (err) => {
			if (err) {
				reject(err);
			} else {
				const startupTime = Date.now() - startTime;
				if (options.verbose) {
					console.log(`Server startup time: ${startupTime}ms`);
				}
				resolve();
			}
		});
	});

	// Set up graceful shutdown
	setupGracefulShutdown(server);

	return { app, server, port };
}

/**
 * Find an available port starting from the preferred port
 * @param {number} preferredPort - The preferred port to start searching from
 * @returns {Promise<number>} The available port number
 */
async function findAvailablePort(preferredPort) {
	let port = preferredPort;
	let attempts = 0;
	const maxAttempts = 10;

	while (attempts < maxAttempts) {
		try {
			await checkPortAvailable(port);
			return port;
		} catch (err) {
			port++;
			attempts++;
		}
	}

	throw new Error(`Could not find available port after ${maxAttempts} attempts`);
}

/**
 * Check if a port is available
 * @param {number} port - Port to check
 * @returns {Promise<void>} Resolves if port is available, rejects otherwise
 */
function checkPortAvailable(port) {
	return new Promise((resolve, reject) => {
		const testServer = http.createServer();
		
		testServer.once('error', (err) => {
			if (err.code === 'EADDRINUSE') {
				reject(new Error(`Port ${port} is already in use`));
			} else {
				reject(err);
			}
		});

		testServer.once('listening', () => {
			testServer.close();
			resolve();
		});

		testServer.listen(port, '127.0.0.1');
	});
}

/**
 * Set up graceful shutdown handlers
 * @param {http.Server} server - The HTTP server instance
 */
function setupGracefulShutdown(server) {
	let isShuttingDown = false;
	const connections = new Set();

	// Track connections
	server.on('connection', (connection) => {
		connections.add(connection);
		connection.on('close', () => {
			connections.delete(connection);
		});
	});

	const gracefulShutdown = (signal) => {
		if (isShuttingDown) return;
		isShuttingDown = true;

		console.log(`\nReceived ${signal}, shutting down gracefully...`);

		// Force shutdown after 10 seconds
		const forceShutdownTimer = setTimeout(() => {
			console.error('Could not close connections in time, forcefully shutting down');
			process.exit(1);
		}, 10000);

		// Stop accepting new connections
		server.close(() => {
			clearTimeout(forceShutdownTimer);
			console.log('Server closed');
			process.exit(0);
		});

		// Close existing connections
		connections.forEach((connection) => {
			connection.destroy();
		});
	};

	// Handle shutdown signals
	process.on('SIGINT', () => gracefulShutdown('SIGINT'));
	process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

	// Clean up signal handlers when server closes
	server.on('close', () => {
		process.removeAllListeners('SIGINT');
		process.removeAllListeners('SIGTERM');
	});
}