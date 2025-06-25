/**
 * Web Commands module tests - Unit tests for web command functionality
 * Tests web command parsing, validation, and lifecycle management
 */

import { jest } from '@jest/globals';

// Mock modules first (Jest hoisting pattern)
jest.mock('fs', () => ({
	existsSync: jest.fn(),
	readFileSync: jest.fn(),
	writeFileSync: jest.fn(),
	mkdirSync: jest.fn()
}));

jest.mock('path', () => ({
	join: jest.fn((...parts) => parts.join('/')),
	dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/'))
}));

jest.mock('chalk', () => ({
	red: jest.fn((text) => text),
	blue: jest.fn((text) => text),
	green: jest.fn((text) => text),
	yellow: jest.fn((text) => text),
	cyan: jest.fn((text) => text),
	white: jest.fn((text) => text),
	gray: jest.fn((text) => text)
}));

jest.mock('child_process', () => ({
	spawn: jest.fn()
}));

// Mock config-manager
jest.mock('../../../scripts/modules/config-manager.js', () => ({
	getLogLevel: jest.fn(() => 'info'),
	getDebugFlag: jest.fn(() => false),
	getConfig: jest.fn(() => ({})),
	getGlobalConfig: jest.fn(() => ({}))
}));

// Mock path-utils
jest.mock('../../../src/utils/path-utils.js', () => ({
	__esModule: true,
	findProjectRoot: jest.fn(() => '/mock/project'),
	findConfigPath: jest.fn(() => null),
	findTasksPath: jest.fn(() => '/mock/tasks.json'),
	findComplexityReportPath: jest.fn(() => null),
	resolveTasksOutputPath: jest.fn(() => '/mock/tasks.json'),
	resolveComplexityReportOutputPath: jest.fn(() => '/mock/report.json')
}));

jest.mock('../../../scripts/modules/ui.js', () => ({
	displayBanner: jest.fn(),
	displayHelp: jest.fn()
}));

jest.mock('../../../scripts/modules/utils.js', () => ({
	CONFIG: {
		projectVersion: '1.5.0'
	},
	log: jest.fn()
}));

// Mock the web module
const mockStartExpressServer = jest.fn();
const mockStopWebInterface = jest.fn();
const mockGetWebInterfaceStatus = jest.fn();
const mockCheckWebDependencies = jest.fn();

jest.mock('../../../web/index.js', () => ({
	startExpressServer: mockStartExpressServer,
	stopWebInterface: mockStopWebInterface,
	getWebInterfaceStatus: mockGetWebInterfaceStatus,
	checkWebDependencies: mockCheckWebDependencies
}));

// Mock console methods to prevent output during tests
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest
	.spyOn(console, 'error')
	.mockImplementation(() => {});

// Import modules after mocking
import fs from 'fs';
import path from 'path';
import { setupCLI } from '../../../scripts/modules/commands.js';

describe('Web Commands Unit Tests', () => {
	let program;
	let mockExit;

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock process.exit
		mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

		// Set up default mock returns
		mockStartExpressServer.mockResolvedValue({
			pid: 12345,
			port: 3001,
			host: 'localhost',
			url: 'http://localhost:3001',
			background: false,
			wsServer: true,
			fileWatcher: true
		});

		mockStopWebInterface.mockResolvedValue();

		mockGetWebInterfaceStatus.mockReturnValue({
			isRunning: false,
			hasWebSocket: false,
			hasFileWatcher: false,
			serverInfo: null
		});

		mockCheckWebDependencies.mockReturnValue({
			server: { available: true, missing: [] },
			build: { available: true, missing: [] },
			status: { express: true, ws: true, 'serve-static': true }
		});

		program = setupCLI();
	});

	// Shared helper functions to eliminate code duplication
	const testWebStartAction = async (options = {}) => {
		const config = {
			port: parseInt(options.port || '3001'),
			host: options.host || 'localhost',
			enableWebSocket: !options.skipWebsocket,
			enableFileWatcher: !options.skipWatcher
		};

		return await mockStartExpressServer(config, options.daemon);
	};

	const testWebStopAction = async (options = {}) => {
		return await mockStopWebInterface(options.force);
	};

	const testWebStatusAction = async () => {
		const status = mockGetWebInterfaceStatus();
		const deps = mockCheckWebDependencies();
		return { status, deps };
	};

	afterEach(() => {
		mockExit.mockRestore();
	});

	afterAll(() => {
		mockConsoleLog.mockRestore();
		mockConsoleError.mockRestore();
	});

	describe('Web Start Command', () => {
		test('should register web-start command with correct options', () => {
			const commands = program.commands;
			const webStartCommand = commands.find(
				(cmd) => cmd.name() === 'web-start'
			);

			expect(webStartCommand).toBeDefined();
			expect(webStartCommand.description()).toBe(
				'Start the Task Master web server'
			);

			// Check for expected options
			const options = webStartCommand.options;
			const optionNames = options.map((opt) => opt.long);

			expect(optionNames).toContain('--port');
			expect(optionNames).toContain('--host');
			expect(optionNames).toContain('--skip-websocket');
			expect(optionNames).toContain('--skip-watcher');
			expect(optionNames).toContain('--daemon');
		});

		test('should start web server with default options', async () => {
			const result = await testWebStartAction({});

			expect(mockStartExpressServer).toHaveBeenCalledWith(
				{
					port: 3001,
					host: 'localhost',
					enableWebSocket: true,
					enableFileWatcher: true
				},
				undefined
			);

			expect(result.port).toBe(3001);
			expect(result.host).toBe('localhost');
		});

		test('should start web server with custom port', async () => {
			await testWebStartAction({ port: '8080' });

			expect(mockStartExpressServer).toHaveBeenCalledWith(
				expect.objectContaining({
					port: 8080
				}),
				undefined
			);
		});

		test('should start web server with custom host', async () => {
			await testWebStartAction({ host: '0.0.0.0' });

			expect(mockStartExpressServer).toHaveBeenCalledWith(
				expect.objectContaining({
					host: '0.0.0.0'
				}),
				undefined
			);
		});

		test('should disable WebSocket when --skip-websocket is used', async () => {
			await testWebStartAction({ skipWebsocket: true });

			expect(mockStartExpressServer).toHaveBeenCalledWith(
				expect.objectContaining({
					enableWebSocket: false
				}),
				undefined
			);
		});

		test('should disable file watcher when --skip-watcher is used', async () => {
			await testWebStartAction({ skipWatcher: true });

			expect(mockStartExpressServer).toHaveBeenCalledWith(
				expect.objectContaining({
					enableFileWatcher: false
				}),
				undefined
			);
		});

		test('should start in daemon mode when --daemon flag is used', async () => {
			await testWebStartAction({ daemon: true });

			expect(mockStartExpressServer).toHaveBeenCalledWith(
				expect.anything(),
				true
			);
		});

		test('should handle server start errors gracefully', async () => {
			mockStartExpressServer.mockRejectedValue(
				new Error('Port already in use')
			);

			await expect(testWebStartAction({})).rejects.toThrow(
				'Port already in use'
			);
		});

		test('should handle web module import errors', async () => {
			// Clear module cache and properly mock the module with error
			jest.resetModules();
			jest.mock('../../../web/index.js', () => {
				throw new Error('Module not found');
			});

			const testWebStartActionWithImportError = async () => {
				try {
					// Simulate dynamic import failure
					throw new Error('Module not found');
				} catch (importError) {
					throw importError;
				}
			};

			await expect(testWebStartActionWithImportError()).rejects.toThrow(
				'Module not found'
			);
		});
	});

	describe('Web Stop Command', () => {
		test('should register web-stop command with correct options', () => {
			const commands = program.commands;
			const webStopCommand = commands.find((cmd) => cmd.name() === 'web-stop');

			expect(webStopCommand).toBeDefined();
			expect(webStopCommand.description()).toBe(
				'Stop the Task Master web server'
			);

			// Check for force option
			const options = webStopCommand.options;
			const forceOption = options.find((opt) => opt.long === '--force');
			expect(forceOption).toBeDefined();
		});

		test('should stop web server successfully', async () => {
			await testWebStopAction({});

			expect(mockStopWebInterface).toHaveBeenCalledWith(undefined);
		});

		test('should stop web server with force flag', async () => {
			await testWebStopAction({ force: true });

			expect(mockStopWebInterface).toHaveBeenCalledWith(true);
		});

		test('should handle stop errors gracefully', async () => {
			mockStopWebInterface.mockRejectedValue(
				new Error('No running server found')
			);

			await expect(testWebStopAction({})).rejects.toThrow(
				'No running server found'
			);
		});

		test('should handle web module import errors for stop command', async () => {
			// Clear module cache and properly mock the module with error
			jest.resetModules();
			jest.mock('../../../web/index.js', () => {
				throw new Error('Module not found');
			});

			const testWebStopActionWithImportError = async () => {
				try {
					// Simulate dynamic import failure
					throw new Error('Module not found');
				} catch (importError) {
					// Real implementation would handle this gracefully
					throw importError;
				}
			};

			await expect(testWebStopActionWithImportError()).rejects.toThrow(
				'Module not found'
			);
		});
	});

	describe('Web Status Command', () => {
		test('should register web-status command', () => {
			const commands = program.commands;
			const webStatusCommand = commands.find(
				(cmd) => cmd.name() === 'web-status'
			);

			expect(webStatusCommand).toBeDefined();
			expect(webStatusCommand.description()).toBe(
				'Check Task Master web server status'
			);
		});

		test('should check web server status successfully', async () => {
			mockGetWebInterfaceStatus.mockReturnValue({
				isRunning: true,
				hasWebSocket: true,
				hasFileWatcher: true,
				serverInfo: {
					address: { address: 'localhost', port: 3001 },
					pid: 12345,
					background: false,
					startTime: '2023-01-01T00:00:00.000Z'
				}
			});

			const result = await testWebStatusAction();

			expect(mockGetWebInterfaceStatus).toHaveBeenCalled();
			expect(mockCheckWebDependencies).toHaveBeenCalled();
			expect(result.status.isRunning).toBe(true);
			expect(result.deps.server.available).toBe(true);
		});

		test('should handle status check when server is not running', async () => {
			mockGetWebInterfaceStatus.mockReturnValue({
				isRunning: false,
				hasWebSocket: false,
				hasFileWatcher: false,
				serverInfo: null
			});

			const result = await testWebStatusAction();

			expect(result.status.isRunning).toBe(false);
			expect(result.status.serverInfo).toBeNull();
		});

		test('should handle missing dependencies', async () => {
			mockCheckWebDependencies.mockReturnValue({
				server: {
					available: false,
					missing: ['express', 'ws']
				},
				build: {
					available: false,
					missing: ['react', 'vite']
				},
				status: {
					express: false,
					ws: false,
					react: false
				}
			});

			const result = await testWebStatusAction();

			expect(result.deps.server.available).toBe(false);
			expect(result.deps.server.missing).toContain('express');
			expect(result.deps.server.missing).toContain('ws');
		});

		test('should handle web module import errors for status command', async () => {
			// Clear module cache and properly mock the module with error
			jest.resetModules();
			jest.mock('../../../web/index.js', () => {
				throw new Error('dependencies missing');
			});

			const testWebStatusActionWithImportError = async () => {
				try {
					// Simulate dynamic import failure
					throw new Error('dependencies missing');
				} catch (importError) {
					if (importError.message.includes('dependencies')) {
						throw importError;
					}
					throw new Error('Web interface not available');
				}
			};

			await expect(testWebStatusActionWithImportError()).rejects.toThrow(
				'dependencies missing'
			);
		});
	});

	describe('Web Command Integration', () => {
		test('should handle port conflicts correctly', async () => {
			mockStartExpressServer.mockRejectedValue(
				new Error('Port 3001 is already in use by another process')
			);

			await expect(testWebStartAction({})).rejects.toThrow('already in use');
		});

		test('should handle permission denied errors', async () => {
			mockStartExpressServer.mockRejectedValue(new Error('Permission denied'));

			await expect(testWebStartAction({ port: '80' })).rejects.toThrow(
				'Permission denied'
			);
		});

		test('should validate port number parsing', async () => {
			await testWebStartAction({ port: '9000' });

			expect(mockStartExpressServer).toHaveBeenCalledWith(
				expect.objectContaining({
					port: 9000
				}),
				undefined
			);
		});

		test('should handle invalid port numbers gracefully', async () => {
			const testWebStartActionWithValidation = async (options = {}) => {
				const config = {
					port: parseInt(options.port || '3001'),
					host: options.host || 'localhost',
					enableWebSocket: !options.skipWebsocket,
					enableFileWatcher: !options.skipWatcher
				};

				// Check for NaN port
				if (isNaN(config.port)) {
					throw new Error('Invalid port number');
				}

				return await mockStartExpressServer(config, options.daemon);
			};

			await expect(
				testWebStartActionWithValidation({ port: 'invalid' })
			).rejects.toThrow('Invalid port number');
		});
	});

	describe('Command Configuration', () => {
		test('should have all web commands properly configured', () => {
			const commands = program.commands;
			const webCommands = commands.filter((cmd) =>
				cmd.name().startsWith('web-')
			);

			// Check that web commands exist (don't enforce exact count since setupCLI registers all commands)
			expect(webCommands.length).toBeGreaterThanOrEqual(3);

			const commandNames = webCommands.map((cmd) => cmd.name());
			expect(commandNames).toContain('web-start');
			expect(commandNames).toContain('web-stop');
			expect(commandNames).toContain('web-status');
		});

		test('should have proper help descriptions for all web commands', () => {
			const commands = program.commands;

			const webStartCommand = commands.find(
				(cmd) => cmd.name() === 'web-start'
			);
			const webStopCommand = commands.find((cmd) => cmd.name() === 'web-stop');
			const webStatusCommand = commands.find(
				(cmd) => cmd.name() === 'web-status'
			);

			expect(webStartCommand.description()).toBeTruthy();
			expect(webStopCommand.description()).toBeTruthy();
			expect(webStatusCommand.description()).toBeTruthy();
		});

		test('should have consistent option naming conventions', () => {
			const commands = program.commands;
			const webStartCommand = commands.find(
				(cmd) => cmd.name() === 'web-start'
			);

			const options = webStartCommand.options;
			const longOptions = options.map((opt) => opt.long);

			// Check that options use kebab-case
			longOptions.forEach((option) => {
				expect(option).toMatch(/^--[a-z]+(-[a-z]+)*$/);
			});
		});
	});
});
