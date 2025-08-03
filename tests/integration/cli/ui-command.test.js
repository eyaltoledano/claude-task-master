import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, '../../../bin/task-master.js');

describe('TaskMaster UI Command', () => {
	let cliProcess;
	let serverStarted = false;

	afterEach(async () => {
		// Clean up any running processes
		if (cliProcess) {
			cliProcess.kill('SIGTERM');
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
		serverStarted = false;
	});

	// Helper function to run CLI command
	function runCLI(args = [], timeout = 10000) {
		return new Promise((resolve, reject) => {
			const output = { stdout: '', stderr: '', exitCode: null };
			
			cliProcess = spawn('node', [CLI_PATH, ...args], {
				env: { ...process.env, NODE_ENV: 'test' }
			});

			const timer = setTimeout(() => {
				cliProcess.kill('SIGTERM');
				reject(new Error(`CLI command timed out after ${timeout}ms`));
			}, timeout);

			cliProcess.stdout.on('data', (data) => {
				output.stdout += data.toString();
				// Check if server started
				if (data.toString().includes('TaskMaster UI started successfully')) {
					serverStarted = true;
				}
			});

			cliProcess.stderr.on('data', (data) => {
				output.stderr += data.toString();
			});

			cliProcess.on('close', (code) => {
				clearTimeout(timer);
				output.exitCode = code;
				resolve(output);
			});

			cliProcess.on('error', (err) => {
				clearTimeout(timer);
				reject(err);
			});
		});
	}

	// Helper to check if port is in use
	function isPortInUse(port) {
		return new Promise((resolve) => {
			const server = http.createServer();
			server.once('error', (err) => {
				if (err.code === 'EADDRINUSE') {
					resolve(true);
				} else {
					resolve(false);
				}
			});
			server.once('listening', () => {
				server.close();
				resolve(false);
			});
			server.listen(port, '127.0.0.1');
		});
	}

	// Helper to wait for server to start
	async function waitForServer(port = 3000, maxAttempts = 20) {
		for (let i = 0; i < maxAttempts; i++) {
			if (await isPortInUse(port)) {
				return true;
			}
			await new Promise(resolve => setTimeout(resolve, 500));
		}
		return false;
	}

	describe('Command Registration', () => {
		it('should show ui command in help', async () => {
			const { stdout } = await runCLI(['--help']);
			expect(stdout).toContain('ui');
			expect(stdout).toContain('Launch the Kanban board UI interface');
		});

		it('should show ui command specific help', async () => {
			const { stdout } = await runCLI(['ui', '--help']);
			expect(stdout).toContain('--port');
			expect(stdout).toContain('--no-browser');
			expect(stdout).toContain('Port to run the server on');
			expect(stdout).toContain('Do not automatically open the browser');
		});
	});

	describe('Server Launch', () => {
		it('should start server on default port', async () => {
			// Start server in background
			const cliPromise = runCLI(['ui', '--no-browser']);
			
			// Wait for server to start
			const serverReady = await waitForServer(3000);
			expect(serverReady).toBe(true);
			
			// Kill the process
			cliProcess.kill('SIGINT');
			const result = await cliPromise;
			
			// Check output
			expect(result.stdout).toContain('TaskMaster UI started successfully');
			expect(result.stdout).toContain('http://localhost:3000');
			expect(result.stdout).toContain('Press Ctrl+C to stop the server');
		});

		it('should start server on custom port', async () => {
			const customPort = 4567;
			
			// Start server in background
			const cliPromise = runCLI(['ui', '--port', customPort.toString(), '--no-browser']);
			
			// Wait for server to start
			const serverReady = await waitForServer(customPort);
			expect(serverReady).toBe(true);
			
			// Kill the process
			cliProcess.kill('SIGINT');
			const result = await cliPromise;
			
			// Check output
			expect(result.stdout).toContain(`http://localhost:${customPort}`);
			expect(result.stdout).toContain(`Port: ${customPort}`);
		});

		it('should show loading spinner', async () => {
			// Start server and immediately kill it
			const cliPromise = runCLI(['ui', '--no-browser']);
			
			// Give it a moment to show spinner
			await new Promise(resolve => setTimeout(resolve, 100));
			cliProcess.kill('SIGINT');
			
			const result = await cliPromise;
			expect(result.stdout).toContain('Starting TaskMaster UI');
		});
	});

	describe('Console Output', () => {
		it('should display formatted server information', async () => {
			// Start server
			const cliPromise = runCLI(['ui', '--no-browser']);
			
			// Wait for server to start
			await waitForServer(3000);
			
			// Kill the process
			cliProcess.kill('SIGINT');
			const result = await cliPromise;
			
			// Check for formatted output
			expect(result.stdout).toContain('🎯 TaskMaster Kanban UI');
			expect(result.stdout).toContain('🌐 URL:');
			expect(result.stdout).toContain('📝 Port:');
			expect(result.stdout).toContain('📊 Status: Running');
			expect(result.stdout).toContain('💡 Press Ctrl+C to stop the server');
		});

		it('should show file watching message', async () => {
			// Start server
			const cliPromise = runCLI(['ui', '--no-browser']);
			
			// Wait for server to start
			await waitForServer(3000);
			
			// Kill the process
			cliProcess.kill('SIGINT');
			const result = await cliPromise;
			
			// Check for file watching message
			expect(result.stdout).toContain('Watching for file changes');
			expect(result.stdout).toContain('Polling for updates every 30 seconds');
		});
	});

	describe('Browser Launch', () => {
		it('should indicate browser launch when not disabled', async () => {
			// Mock open to prevent actual browser launch
			const openMock = jest.fn().mockResolvedValue();
			jest.doMock('open', () => ({ default: openMock }));
			
			// Start server WITHOUT --no-browser
			const cliPromise = runCLI(['ui']);
			
			// Wait for server to start
			await waitForServer(3000);
			
			// Kill the process
			cliProcess.kill('SIGINT');
			const result = await cliPromise;
			
			// Should try to open browser
			expect(result.stdout).toMatch(/Browser opened automatically|Could not open browser/);
		});

		it('should not launch browser with --no-browser flag', async () => {
			// Start server
			const cliPromise = runCLI(['ui', '--no-browser']);
			
			// Wait for server to start
			await waitForServer(3000);
			
			// Kill the process  
			cliProcess.kill('SIGINT');
			const result = await cliPromise;
			
			// Should not mention browser launch
			expect(result.stdout).not.toContain('Browser opened automatically');
		});
	});

	describe('Graceful Shutdown', () => {
		it('should handle SIGINT gracefully', async () => {
			// Start server
			const cliPromise = runCLI(['ui', '--no-browser']);
			
			// Wait for server to start
			await waitForServer(3000);
			
			// Send SIGINT
			cliProcess.kill('SIGINT');
			const result = await cliPromise;
			
			// Check shutdown messages
			expect(result.stdout).toContain('Shutting down TaskMaster UI');
			expect(result.exitCode).toBe(0);
		});
	});

	describe('Error Handling', () => {
		it('should handle missing tasks file gracefully', async () => {
			// Use a non-existent tasks file
			const result = await runCLI(['ui', '--no-browser', '-f', '/non/existent/tasks.json']);
			
			// Should show error
			expect(result.stderr).toContain('Error');
			expect(result.exitCode).toBe(1);
		});

		it('should handle invalid port numbers', async () => {
			const result = await runCLI(['ui', '--no-browser', '--port', 'invalid']);
			
			// Should show error for invalid port
			expect(result.exitCode).toBe(1);
		});
	});
});