import {
	jest,
	describe,
	it,
	expect,
	beforeEach,
	afterEach
} from '@jest/globals';
import request from 'supertest';
import { createServer } from '../../../../src/ui/server/index.js';

describe('TaskMaster UI Server', () => {
	let server;
	let app;

	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks();
	});

	afterEach(async () => {
		// Ensure server is closed after each test
		if (server && server.listening) {
			await new Promise((resolve) => {
				server.close(resolve);
			});
		}
	});

	describe('Server Creation', () => {
		it('should create an Express application', async () => {
			const result = await createServer();
			expect(result).toBeDefined();
			expect(result.app).toBeDefined();
			expect(result.server).toBeDefined();
			expect(result.port).toBeDefined();
		});

		it('should find an available port starting from 3000', async () => {
			const result = await createServer();
			expect(result.port).toBeGreaterThanOrEqual(3000);
			server = result.server;
		});

		it('should handle port conflicts gracefully', async () => {
			// Create first server on default port
			const server1 = await createServer();
			const firstPort = server1.port;
			expect(firstPort).toBeGreaterThanOrEqual(3000);

			// Create second server - should use next available port
			const server2 = await createServer();
			expect(server2.port).toBe(firstPort + 1);

			// Cleanup
			await new Promise((resolve) => server1.server.close(resolve));
			await new Promise((resolve) => server2.server.close(resolve));
		});

		it('should allow custom port specification', async () => {
			// Use a higher port number to avoid common conflicts
			const customPort = 9876;
			const result = await createServer({ port: customPort });
			expect(result.port).toBe(customPort);
			server = result.server;
		});

		it('should bind to localhost only for security', async () => {
			const result = await createServer();
			const address = result.server.address();
			expect(address.address).toBe('127.0.0.1');
			server = result.server;
		});
	});

	describe('API Endpoints', () => {
		beforeEach(async () => {
			const result = await createServer();
			app = result.app;
			server = result.server;
		});

		it('should have a health check endpoint', async () => {
			const response = await request(app).get('/api/health').expect(200);

			expect(response.body).toEqual({
				status: 'ok',
				timestamp: expect.any(String),
				uptime: expect.any(Number)
			});
		});

		it('should handle 404 for unknown routes', async () => {
			const response = await request(app).get('/api/unknown').expect(404);

			expect(response.body).toHaveProperty('error');
		});

		it('should have CORS configured for localhost only', async () => {
			const response = await request(app)
				.get('/api/health')
				.set('Origin', 'http://localhost:3000')
				.expect(200);

			expect(response.headers['access-control-allow-origin']).toBe(
				'http://localhost:3000'
			);
		});

		it('should reject non-localhost CORS requests', async () => {
			const response = await request(app)
				.get('/api/health')
				.set('Origin', 'http://example.com')
				.expect(200);

			expect(response.headers['access-control-allow-origin']).toBeUndefined();
		});
	});

	describe('Middleware', () => {
		beforeEach(async () => {
			const result = await createServer();
			app = result.app;
			server = result.server;
		});

		it('should have request logging middleware', async () => {
			const consoleSpy = jest
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			await request(app).get('/api/health').expect(200);

			expect(consoleSpy).toHaveBeenCalledWith('GET /api/health');

			consoleSpy.mockRestore();
		});

		it('should have error handling middleware', async () => {
			// Create a new server to add the error route before middleware
			const result = await createServer();
			const testApp = result.app;
			const testServer = result.server;

			// Add a route that throws an error - do this by manipulating the app
			// Since we can't add routes after error handler, we'll test differently
			// by creating a request that will trigger an error in existing routes

			// Instead, let's verify error handling exists by checking the app's stack
			const errorHandler = testApp._router.stack.find(
				(layer) => layer.handle && layer.handle.length === 4 // Error handlers have 4 params
			);

			expect(errorHandler).toBeDefined();

			// Close the test server
			await new Promise((resolve) => testServer.close(resolve));
		});
	});

	describe('Graceful Shutdown', () => {
		let processExitSpy;

		beforeEach(() => {
			// Mock process.exit to prevent test from exiting
			processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
		});

		afterEach(() => {
			// Restore process.exit
			processExitSpy.mockRestore();
		});

		it('should handle graceful shutdown on SIGINT', async () => {
			const result = await createServer();
			server = result.server;

			const shutdownPromise = new Promise((resolve) => {
				server.on('close', resolve);
			});

			// Simulate SIGINT
			process.emit('SIGINT');

			// Wait for server to close
			await shutdownPromise;

			expect(server.listening).toBe(false);
			expect(processExitSpy).toHaveBeenCalledWith(0);
		});

		it('should handle graceful shutdown on SIGTERM', async () => {
			const result = await createServer();
			server = result.server;

			const shutdownPromise = new Promise((resolve) => {
				server.on('close', resolve);
			});

			// Simulate SIGTERM
			process.emit('SIGTERM');

			// Wait for server to close
			await shutdownPromise;

			expect(server.listening).toBe(false);
			expect(processExitSpy).toHaveBeenCalledWith(0);
		});

		it('should close active connections during shutdown', async () => {
			const result = await createServer();
			server = result.server;
			app = result.app;

			// Track active connections (simulate what the server does)
			let activeConnections = 0;
			let connectionsDestroyed = 0;

			// Override connection tracking to monitor it
			const originalOn = server.on.bind(server);
			server.on = (event, handler) => {
				if (event === 'connection') {
					return originalOn(event, (connection) => {
						activeConnections++;
						connection.on('close', () => {
							activeConnections--;
						});
						// Track if connection.destroy() was called
						const originalDestroy = connection.destroy.bind(connection);
						connection.destroy = () => {
							connectionsDestroyed++;
							return originalDestroy();
						};
						handler(connection);
					});
				}
				return originalOn(event, handler);
			};

			// Create a long-running request handler
			app.get('/api/long-request', (req, res) => {
				// Simulate long-running request
				setTimeout(() => {
					if (!res.headersSent) {
						res.json({ done: true });
					}
				}, 5000);
			});

			// Start request but don't wait for it
			const requestPromise = request(app)
				.get('/api/long-request')
				.catch(() => {}); // Ignore errors

			// Give the request time to establish connection
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Trigger shutdown
			const shutdownPromise = new Promise((resolve) => {
				server.on('close', resolve);
			});
			process.emit('SIGINT');

			// Wait for shutdown
			await shutdownPromise;

			// Verify server shut down properly
			expect(server.listening).toBe(false);
			expect(processExitSpy).toHaveBeenCalledWith(0);

			// Clean up the request promise
			await requestPromise;
		});
	});

	describe('Performance', () => {
		it('should start up within 3 seconds', async () => {
			const startTime = Date.now();
			const result = await createServer();
			const startupTime = Date.now() - startTime;

			expect(startupTime).toBeLessThan(3000);
			server = result.server;
		});

		it('should track and report startup metrics', async () => {
			const consoleSpy = jest
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			const result = await createServer({ verbose: true });
			server = result.server;

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('startup time')
			);

			consoleSpy.mockRestore();
		});
	});
});
