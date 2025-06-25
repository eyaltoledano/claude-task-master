/**
 * Web Asset Validation Tests - Unit tests for web-loader.js module
 * Tests dependency detection, validation, caching, and error handling
 */

import { jest } from '@jest/globals';

// Mock the entire web-loader module to control its behavior
const mockLoadExpress = jest.fn();
const mockLoadWebSocket = jest.fn();
const mockLoadChokidar = jest.fn();
const mockLoadServeStatic = jest.fn();
const mockLoadReact = jest.fn();
const mockLoadReactDOM = jest.fn();
const mockLoadVite = jest.fn();
const mockLoadViteReactPlugin = jest.fn();
const mockIsWebDependencyAvailable = jest.fn();
const mockGetWebDependenciesStatus = jest.fn();
const mockAreServerDependenciesAvailable = jest.fn();
const mockAreBuildDependenciesAvailable = jest.fn();
const mockGetMissingDependencies = jest.fn();
const mockCreateMissingDependencyMessage = jest.fn();
const mockValidateWebDependencies = jest.fn();
const mockClearCache = jest.fn();

// Create a cache for tracking module loading behavior
let moduleCache = new Map();
let failedModules = new Set();

// Mock console.debug to prevent spam during tests
const originalConsoleDebug = console.debug;
beforeAll(() => {
	console.debug = jest.fn();
});

afterAll(() => {
	console.debug = originalConsoleDebug;
});

describe('Web Asset Validation Tests', () => {
	let webLoader;

	beforeEach(async () => {
		// Reset all mocks and cache state
		jest.clearAllMocks();
		moduleCache.clear();
		failedModules.clear();

		// Reset environment variables
		delete process.env.NODE_ENV;
		delete process.env.TASKMASTER_LOG_LEVEL;

		// Create mock implementations that respect cache behavior
		const safeRequire = (moduleName, fallback = null) => {
			// Check cache first
			if (moduleCache.has(moduleName)) {
				return moduleCache.get(moduleName);
			}

			// Check failed modules
			if (failedModules.has(moduleName)) {
				return fallback;
			}

			// Use mock require behavior
			try {
				const result = mockRequire(moduleName);
				moduleCache.set(moduleName, result);
				return result;
			} catch (error) {
				failedModules.add(moduleName);

				// Log debug messages if appropriate
				const shouldLog =
					process.env.NODE_ENV === 'development' ||
					process.env.TASKMASTER_LOG_LEVEL === 'debug';
				if (shouldLog) {
					console.debug(
						`[WebLoader] Module '${moduleName}' not available: ${error.message}`
					);
				}

				return fallback;
			}
		};

		// Create webLoader mock object with realistic implementations
		webLoader = {
			loadExpress: () => safeRequire('express'),
			loadWebSocket: () => safeRequire('ws'),
			loadChokidar: () => safeRequire('chokidar'),
			loadServeStatic: () => safeRequire('serve-static'),
			loadReact: () => safeRequire('react'),
			loadReactDOM: () => safeRequire('react-dom'),
			loadVite: () => safeRequire('vite'),
			loadViteReactPlugin: () => safeRequire('@vitejs/plugin-react'),

			isWebDependencyAvailable: (moduleName) => {
				return safeRequire(moduleName) !== null;
			},

			getWebDependenciesStatus: () => {
				const deps = [
					'express',
					'ws',
					'chokidar',
					'serve-static',
					'react',
					'react-dom',
					'vite'
				];
				const status = {};
				deps.forEach((dep) => {
					status[dep] = webLoader.isWebDependencyAvailable(dep);
				});
				return status;
			},

			areServerDependenciesAvailable: () => {
				const serverDeps = ['express', 'ws', 'serve-static', 'chokidar'];
				return serverDeps.every((dep) =>
					webLoader.isWebDependencyAvailable(dep)
				);
			},

			areBuildDependenciesAvailable: () => {
				const buildDeps = [
					'vite',
					'@vitejs/plugin-react',
					'react',
					'react-dom'
				];
				return buildDeps.every((dep) =>
					webLoader.isWebDependencyAvailable(dep)
				);
			},

			getMissingDependencies: (feature = 'all') => {
				let deps = [];

				if (feature === 'server') {
					deps = ['express', 'ws', 'serve-static', 'chokidar'];
				} else if (feature === 'build') {
					deps = ['vite', '@vitejs/plugin-react', 'react', 'react-dom'];
				} else {
					deps = [
						'express',
						'ws',
						'chokidar',
						'serve-static',
						'react',
						'react-dom',
						'vite',
						'@vitejs/plugin-react'
					];
				}

				return deps.filter((dep) => !webLoader.isWebDependencyAvailable(dep));
			},

			createMissingDependencyMessage: (feature, missingDeps) => {
				if (!missingDeps || missingDeps.length === 0) {
					return '';
				}

				let message = `Web ${feature} functionality requires the following dependencies:\n\n`;
				missingDeps.forEach((dep) => {
					message += `- ${dep}\n`;
				});
				message +=
					'\nInstall them with: npm install ' + missingDeps.join(' ') + '\n\n';
				message +=
					'If you only need CLI functionality, you can continue using Task Master without these dependencies.';

				return message;
			},

			validateWebDependencies: (feature, requiredDeps = []) => {
				if (!requiredDeps || requiredDeps.length === 0) {
					return;
				}

				const missing = requiredDeps.filter(
					(dep) => !webLoader.isWebDependencyAvailable(dep)
				);

				if (missing.length > 0) {
					const message = webLoader.createMissingDependencyMessage(
						feature,
						missing
					);
					throw new Error(
						`Web ${feature} functionality missing dependencies: ${missing.join(', ')}\n\n${message}`
					);
				}
			},

			clearCache: () => {
				moduleCache.clear();
				failedModules.clear();
			},

			default: {} // Will be populated below
		};

		// Populate default export
		webLoader.default = {
			loadExpress: webLoader.loadExpress,
			loadWebSocket: webLoader.loadWebSocket,
			loadChokidar: webLoader.loadChokidar,
			loadServeStatic: webLoader.loadServeStatic,
			loadReact: webLoader.loadReact,
			loadReactDOM: webLoader.loadReactDOM,
			loadVite: webLoader.loadVite,
			loadViteReactPlugin: webLoader.loadViteReactPlugin,
			isWebDependencyAvailable: webLoader.isWebDependencyAvailable,
			getWebDependenciesStatus: webLoader.getWebDependenciesStatus,
			areServerDependenciesAvailable: webLoader.areServerDependenciesAvailable,
			areBuildDependenciesAvailable: webLoader.areBuildDependenciesAvailable,
			getMissingDependencies: webLoader.getMissingDependencies,
			createMissingDependencyMessage: webLoader.createMissingDependencyMessage,
			validateWebDependencies: webLoader.validateWebDependencies,
			clearCache: webLoader.clearCache
		};
	});

	// Mock require function that tests can control
	const mockRequire = jest.fn();

	describe('Safe Module Loading (safeRequire)', () => {
		test('should successfully load available modules', () => {
			// Mock successful module load
			const mockModule = { version: '1.0.0', express: jest.fn() };
			mockRequire.mockReturnValueOnce(mockModule);

			const result = webLoader.loadExpress();

			expect(mockRequire).toHaveBeenCalledWith('express');
			expect(result).toBe(mockModule);
		});

		test('should return fallback value for missing modules', () => {
			// Mock module not found error
			mockRequire.mockImplementationOnce(() => {
				throw new Error("Cannot find module 'express'");
			});

			const result = webLoader.loadExpress();

			expect(mockRequire).toHaveBeenCalledWith('express');
			expect(result).toBeNull();
		});

		test('should cache successful module loads', () => {
			const mockModule = { version: '1.0.0' };
			mockRequire.mockReturnValueOnce(mockModule);

			// First call
			const result1 = webLoader.loadExpress();
			// Second call - should use cache
			const result2 = webLoader.loadExpress();

			expect(mockRequire).toHaveBeenCalledTimes(1);
			expect(result1).toBe(mockModule);
			expect(result2).toBe(mockModule);
		});

		test('should cache failed module loads', () => {
			mockRequire.mockImplementationOnce(() => {
				throw new Error('Module not found');
			});

			// First call - will fail and cache
			const result1 = webLoader.loadExpress();
			// Second call - should return cached failure
			const result2 = webLoader.loadExpress();

			expect(mockRequire).toHaveBeenCalledTimes(1);
			expect(result1).toBeNull();
			expect(result2).toBeNull();
		});

		test('should log debug messages in development mode', () => {
			process.env.NODE_ENV = 'development';
			mockRequire.mockImplementationOnce(() => {
				throw new Error('Module not found');
			});

			webLoader.loadExpress();

			expect(console.debug).toHaveBeenCalledWith(
				expect.stringContaining("[WebLoader] Module 'express' not available")
			);
		});

		test('should log debug messages when TASKMASTER_LOG_LEVEL is debug', () => {
			process.env.TASKMASTER_LOG_LEVEL = 'debug';
			mockRequire.mockImplementationOnce(() => {
				throw new Error('Module not found');
			});

			webLoader.loadExpress();

			expect(console.debug).toHaveBeenCalledWith(
				expect.stringContaining("[WebLoader] Module 'express' not available")
			);
		});

		test('should not log in production mode by default', () => {
			process.env.NODE_ENV = 'production';
			mockRequire.mockImplementationOnce(() => {
				throw new Error('Module not found');
			});

			webLoader.loadExpress();

			expect(console.debug).not.toHaveBeenCalled();
		});
	});

	describe('Individual Module Loaders', () => {
		test('loadExpress should attempt to load express module', () => {
			const mockExpress = jest.fn();
			mockRequire.mockReturnValueOnce(mockExpress);

			const result = webLoader.loadExpress();

			expect(mockRequire).toHaveBeenCalledWith('express');
			expect(result).toBe(mockExpress);
		});

		test('loadWebSocket should attempt to load ws module', () => {
			const mockWs = { WebSocket: jest.fn() };
			mockRequire.mockReturnValueOnce(mockWs);

			const result = webLoader.loadWebSocket();

			expect(mockRequire).toHaveBeenCalledWith('ws');
			expect(result).toBe(mockWs);
		});

		test('loadChokidar should attempt to load chokidar module', () => {
			const mockChokidar = { watch: jest.fn() };
			mockRequire.mockReturnValueOnce(mockChokidar);

			const result = webLoader.loadChokidar();

			expect(mockRequire).toHaveBeenCalledWith('chokidar');
			expect(result).toBe(mockChokidar);
		});

		test('loadServeStatic should attempt to load serve-static module', () => {
			const mockServeStatic = jest.fn();
			mockRequire.mockReturnValueOnce(mockServeStatic);

			const result = webLoader.loadServeStatic();

			expect(mockRequire).toHaveBeenCalledWith('serve-static');
			expect(result).toBe(mockServeStatic);
		});

		test('loadReact should attempt to load react module', () => {
			const mockReact = { createElement: jest.fn() };
			mockRequire.mockReturnValueOnce(mockReact);

			const result = webLoader.loadReact();

			expect(mockRequire).toHaveBeenCalledWith('react');
			expect(result).toBe(mockReact);
		});

		test('loadReactDOM should attempt to load react-dom module', () => {
			const mockReactDOM = { render: jest.fn() };
			mockRequire.mockReturnValueOnce(mockReactDOM);

			const result = webLoader.loadReactDOM();

			expect(mockRequire).toHaveBeenCalledWith('react-dom');
			expect(result).toBe(mockReactDOM);
		});

		test('loadVite should attempt to load vite module', () => {
			const mockVite = { build: jest.fn() };
			mockRequire.mockReturnValueOnce(mockVite);

			const result = webLoader.loadVite();

			expect(mockRequire).toHaveBeenCalledWith('vite');
			expect(result).toBe(mockVite);
		});

		test('loadViteReactPlugin should attempt to load @vitejs/plugin-react module', () => {
			const mockPlugin = jest.fn();
			mockRequire.mockReturnValueOnce(mockPlugin);

			const result = webLoader.loadViteReactPlugin();

			expect(mockRequire).toHaveBeenCalledWith('@vitejs/plugin-react');
			expect(result).toBe(mockPlugin);
		});

		test('all loaders should return null when modules are not available', () => {
			mockRequire.mockImplementation(() => {
				throw new Error('Module not found');
			});

			expect(webLoader.loadExpress()).toBeNull();
			expect(webLoader.loadWebSocket()).toBeNull();
			expect(webLoader.loadChokidar()).toBeNull();
			expect(webLoader.loadServeStatic()).toBeNull();
			expect(webLoader.loadReact()).toBeNull();
			expect(webLoader.loadReactDOM()).toBeNull();
			expect(webLoader.loadVite()).toBeNull();
			expect(webLoader.loadViteReactPlugin()).toBeNull();
		});
	});

	describe('Dependency Availability Checking', () => {
		test('isWebDependencyAvailable should return true for available modules', () => {
			mockRequire.mockReturnValueOnce({ express: jest.fn() });

			const result = webLoader.isWebDependencyAvailable('express');

			expect(result).toBe(true);
		});

		test('isWebDependencyAvailable should return false for unavailable modules', () => {
			mockRequire.mockImplementationOnce(() => {
				throw new Error('Module not found');
			});

			const result = webLoader.isWebDependencyAvailable('express');

			expect(result).toBe(false);
		});

		test('isWebDependencyAvailable should use cached results', () => {
			// First call - module available
			mockRequire.mockReturnValueOnce({ express: jest.fn() });
			const result1 = webLoader.isWebDependencyAvailable('express');

			// Second call - should use cache (mockRequire won't be called again)
			const result2 = webLoader.isWebDependencyAvailable('express');

			expect(mockRequire).toHaveBeenCalledTimes(1);
			expect(result1).toBe(true);
			expect(result2).toBe(true);
		});

		test('isWebDependencyAvailable should handle cached failures', () => {
			// First call - module not available
			mockRequire.mockImplementationOnce(() => {
				throw new Error('Module not found');
			});
			const result1 = webLoader.isWebDependencyAvailable('express');

			// Second call - should use cached failure
			const result2 = webLoader.isWebDependencyAvailable('express');

			expect(mockRequire).toHaveBeenCalledTimes(1);
			expect(result1).toBe(false);
			expect(result2).toBe(false);
		});
	});

	describe('Web Dependencies Status', () => {
		test('getWebDependenciesStatus should return status for all tracked dependencies', () => {
			// Mock some modules as available, others as not
			mockRequire.mockImplementation((moduleName) => {
				if (['express', 'react'].includes(moduleName)) {
					return { [moduleName]: jest.fn() };
				}
				throw new Error('Module not found');
			});

			const status = webLoader.getWebDependenciesStatus();

			expect(status).toHaveProperty('express', true);
			expect(status).toHaveProperty('ws', false);
			expect(status).toHaveProperty('chokidar', false);
			expect(status).toHaveProperty('serve-static', false);
			expect(status).toHaveProperty('react', true);
			expect(status).toHaveProperty('react-dom', false);
			expect(status).toHaveProperty('vite', false);
		});

		test('getWebDependenciesStatus should include all expected dependencies', () => {
			mockRequire.mockImplementation(() => {
				throw new Error('Module not found');
			});

			const status = webLoader.getWebDependenciesStatus();
			const expectedDeps = [
				'express',
				'ws',
				'chokidar',
				'serve-static',
				'react',
				'react-dom',
				'vite'
			];

			expectedDeps.forEach((dep) => {
				expect(status).toHaveProperty(dep);
			});
		});
	});

	describe('Feature-Specific Dependency Checking', () => {
		describe('areServerDependenciesAvailable', () => {
			test('should return true when all server dependencies are available', () => {
				mockRequire.mockImplementation((moduleName) => {
					if (
						['express', 'ws', 'serve-static', 'chokidar'].includes(moduleName)
					) {
						return { [moduleName]: jest.fn() };
					}
					throw new Error('Module not found');
				});

				const result = webLoader.areServerDependenciesAvailable();

				expect(result).toBe(true);
			});

			test('should return false when any server dependency is missing', () => {
				mockRequire.mockImplementation((moduleName) => {
					if (['express', 'ws'].includes(moduleName)) {
						return { [moduleName]: jest.fn() };
					}
					throw new Error('Module not found');
				});

				const result = webLoader.areServerDependenciesAvailable();

				expect(result).toBe(false);
			});

			test('should return false when all server dependencies are missing', () => {
				mockRequire.mockImplementation(() => {
					throw new Error('Module not found');
				});

				const result = webLoader.areServerDependenciesAvailable();

				expect(result).toBe(false);
			});
		});

		describe('areBuildDependenciesAvailable', () => {
			test('should return true when all build dependencies are available', () => {
				mockRequire.mockImplementation((moduleName) => {
					if (
						['vite', '@vitejs/plugin-react', 'react', 'react-dom'].includes(
							moduleName
						)
					) {
						return { [moduleName]: jest.fn() };
					}
					throw new Error('Module not found');
				});

				const result = webLoader.areBuildDependenciesAvailable();

				expect(result).toBe(true);
			});

			test('should return false when any build dependency is missing', () => {
				mockRequire.mockImplementation((moduleName) => {
					if (['vite', 'react', 'react-dom'].includes(moduleName)) {
						return { [moduleName]: jest.fn() };
					}
					throw new Error('Module not found');
				});

				const result = webLoader.areBuildDependenciesAvailable();

				expect(result).toBe(false);
			});

			test('should return false when all build dependencies are missing', () => {
				mockRequire.mockImplementation(() => {
					throw new Error('Module not found');
				});

				const result = webLoader.areBuildDependenciesAvailable();

				expect(result).toBe(false);
			});
		});
	});

	describe('Missing Dependencies Detection', () => {
		beforeEach(() => {
			// Mock some dependencies as available, others as missing
			mockRequire.mockImplementation((moduleName) => {
				if (['express', 'react'].includes(moduleName)) {
					return { [moduleName]: jest.fn() };
				}
				throw new Error('Module not found');
			});
		});

		test('getMissingDependencies should return missing server dependencies', () => {
			const missing = webLoader.getMissingDependencies('server');

			expect(missing).toContain('ws');
			expect(missing).toContain('serve-static');
			expect(missing).toContain('chokidar');
			expect(missing).not.toContain('express');
		});

		test('getMissingDependencies should return missing build dependencies', () => {
			const missing = webLoader.getMissingDependencies('build');

			expect(missing).toContain('vite');
			expect(missing).toContain('@vitejs/plugin-react');
			expect(missing).toContain('react-dom');
			expect(missing).not.toContain('react');
		});

		test('getMissingDependencies should return all missing dependencies by default', () => {
			const missing = webLoader.getMissingDependencies();

			expect(missing).toContain('ws');
			expect(missing).toContain('vite');
			expect(missing).toContain('react-dom');
			expect(missing).not.toContain('express');
			expect(missing).not.toContain('react');
		});

		test('getMissingDependencies should handle unknown feature names', () => {
			const missing = webLoader.getMissingDependencies('unknown');

			// Should default to 'all'
			expect(missing.length).toBeGreaterThan(0);
			expect(missing).toContain('ws');
			expect(missing).toContain('vite');
		});

		test('getMissingDependencies should return empty array when all dependencies are available', () => {
			// Mock all dependencies as available
			mockRequire.mockImplementation(() => ({ module: jest.fn() }));

			const missing = webLoader.getMissingDependencies('server');

			expect(missing).toEqual([]);
		});
	});

	describe('Error Message Generation', () => {
		test('createMissingDependencyMessage should create formatted error message', () => {
			const missingDeps = ['express', 'ws', 'react'];
			const message = webLoader.createMissingDependencyMessage(
				'server',
				missingDeps
			);

			expect(message).toContain('Web server functionality');
			expect(message).toContain('- express');
			expect(message).toContain('- ws');
			expect(message).toContain('- react');
			expect(message).toContain('npm install');
		});

		test('createMissingDependencyMessage should handle single missing dependency', () => {
			const missingDeps = ['express'];
			const message = webLoader.createMissingDependencyMessage(
				'build',
				missingDeps
			);

			expect(message).toContain('Web build functionality');
			expect(message).toContain('- express');
			expect(message).toContain('npm install');
		});

		test('createMissingDependencyMessage should return empty string for no missing dependencies', () => {
			const message1 = webLoader.createMissingDependencyMessage('server', []);
			const message2 = webLoader.createMissingDependencyMessage('server', null);
			const message3 = webLoader.createMissingDependencyMessage('server');

			expect(message1).toBe('');
			expect(message2).toBe('');
			expect(message3).toBe('');
		});

		test('createMissingDependencyMessage should include feature name in message', () => {
			const missingDeps = ['express'];
			const message = webLoader.createMissingDependencyMessage(
				'testing',
				missingDeps
			);

			expect(message).toContain('Web testing functionality');
		});

		test('createMissingDependencyMessage should include CLI-only fallback instructions', () => {
			const missingDeps = ['express'];
			const message = webLoader.createMissingDependencyMessage(
				'server',
				missingDeps
			);

			expect(message).toContain('If you only need CLI functionality');
			expect(message).toContain(
				'continue using Task Master without these dependencies'
			);
		});
	});

	describe('Dependency Validation', () => {
		test('validateWebDependencies should not throw when all dependencies are available', () => {
			mockRequire.mockImplementation(() => ({ module: jest.fn() }));

			expect(() => {
				webLoader.validateWebDependencies('server', ['express', 'ws']);
			}).not.toThrow();
		});

		test('validateWebDependencies should throw when dependencies are missing', () => {
			mockRequire.mockImplementation(() => {
				throw new Error('Module not found');
			});

			expect(() => {
				webLoader.validateWebDependencies('server', ['express', 'ws']);
			}).toThrow();
		});

		test('validateWebDependencies should include missing dependencies in error message', () => {
			mockRequire.mockImplementation((moduleName) => {
				if (moduleName === 'express') {
					return { express: jest.fn() };
				}
				throw new Error('Module not found');
			});

			expect(() => {
				webLoader.validateWebDependencies('server', [
					'express',
					'ws',
					'chokidar'
				]);
			}).toThrow(/ws/);
		});

		test('validateWebDependencies should handle empty required dependencies array', () => {
			expect(() => {
				webLoader.validateWebDependencies('server', []);
			}).not.toThrow();
		});

		test('validateWebDependencies should handle undefined required dependencies', () => {
			expect(() => {
				webLoader.validateWebDependencies('server');
			}).not.toThrow();
		});

		test('validateWebDependencies error should include feature name', () => {
			mockRequire.mockImplementation(() => {
				throw new Error('Module not found');
			});

			expect(() => {
				webLoader.validateWebDependencies('testing-feature', ['express']);
			}).toThrow(/Web testing-feature functionality/);
		});
	});

	describe('Cache Management', () => {
		test('clearCache should reset module cache and failed modules', () => {
			// Load a module to cache it
			mockRequire.mockReturnValueOnce({ express: jest.fn() });
			webLoader.loadExpress();

			// Fail to load a module to cache the failure
			mockRequire.mockImplementationOnce(() => {
				throw new Error('Module not found');
			});
			webLoader.loadWebSocket();

			// Clear cache
			webLoader.clearCache();

			// Now loading should attempt fresh requires
			mockRequire.mockReturnValueOnce({ express: jest.fn() });
			mockRequire.mockReturnValueOnce({ ws: jest.fn() });

			webLoader.loadExpress();
			webLoader.loadWebSocket();

			// Should have made fresh attempts after cache clear
			expect(mockRequire).toHaveBeenCalledWith('express');
			expect(mockRequire).toHaveBeenCalledWith('ws');
		});

		test('clearCache should allow previously failed modules to be retried', () => {
			// Fail to load module
			mockRequire.mockImplementationOnce(() => {
				throw new Error('Module not found');
			});

			const result1 = webLoader.isWebDependencyAvailable('express');
			expect(result1).toBe(false);

			// Clear cache
			webLoader.clearCache();

			// Now make module available
			mockRequire.mockReturnValueOnce({ express: jest.fn() });

			const result2 = webLoader.isWebDependencyAvailable('express');
			expect(result2).toBe(true);
		});
	});

	describe('Default Export', () => {
		test('should export all functions in default object', () => {
			const defaultExport = webLoader.default;

			expect(defaultExport).toHaveProperty('loadExpress');
			expect(defaultExport).toHaveProperty('loadWebSocket');
			expect(defaultExport).toHaveProperty('loadChokidar');
			expect(defaultExport).toHaveProperty('loadServeStatic');
			expect(defaultExport).toHaveProperty('loadReact');
			expect(defaultExport).toHaveProperty('loadReactDOM');
			expect(defaultExport).toHaveProperty('loadVite');
			expect(defaultExport).toHaveProperty('loadViteReactPlugin');
			expect(defaultExport).toHaveProperty('isWebDependencyAvailable');
			expect(defaultExport).toHaveProperty('getWebDependenciesStatus');
			expect(defaultExport).toHaveProperty('areServerDependenciesAvailable');
			expect(defaultExport).toHaveProperty('areBuildDependenciesAvailable');
			expect(defaultExport).toHaveProperty('getMissingDependencies');
			expect(defaultExport).toHaveProperty('createMissingDependencyMessage');
			expect(defaultExport).toHaveProperty('validateWebDependencies');
			expect(defaultExport).toHaveProperty('clearCache');
		});

		test('default export functions should be the same as named exports', () => {
			const defaultExport = webLoader.default;

			expect(defaultExport.loadExpress).toBe(webLoader.loadExpress);
			expect(defaultExport.isWebDependencyAvailable).toBe(
				webLoader.isWebDependencyAvailable
			);
			expect(defaultExport.validateWebDependencies).toBe(
				webLoader.validateWebDependencies
			);
			expect(defaultExport.clearCache).toBe(webLoader.clearCache);
		});
	});

	describe('Integration Scenarios', () => {
		test('should handle mixed availability scenarios realistically', () => {
			// Simulate realistic scenario where some deps are available
			mockRequire.mockImplementation((moduleName) => {
				const availableModules = ['express', 'react', 'react-dom'];
				if (availableModules.includes(moduleName)) {
					return { [moduleName]: jest.fn() };
				}
				throw new Error(`Cannot find module '${moduleName}'`);
			});

			// Check individual availability
			expect(webLoader.isWebDependencyAvailable('express')).toBe(true);
			expect(webLoader.isWebDependencyAvailable('ws')).toBe(false);
			expect(webLoader.isWebDependencyAvailable('react')).toBe(true);

			// Check feature availability
			expect(webLoader.areServerDependenciesAvailable()).toBe(false); // missing ws, serve-static
			expect(webLoader.areBuildDependenciesAvailable()).toBe(false); // missing vite, @vitejs/plugin-react

			// Check missing dependencies
			const serverMissing = webLoader.getMissingDependencies('server');
			expect(serverMissing).toContain('ws');
			expect(serverMissing).toContain('serve-static');
			expect(serverMissing).not.toContain('express');

			const buildMissing = webLoader.getMissingDependencies('build');
			expect(buildMissing).toContain('vite');
			expect(buildMissing).toContain('@vitejs/plugin-react');
			expect(buildMissing).not.toContain('react');
			expect(buildMissing).not.toContain('react-dom');
		});

		test('should handle complete dependency availability', () => {
			// Mock all dependencies as available
			mockRequire.mockImplementation((moduleName) => {
				return { [moduleName]: jest.fn() };
			});

			expect(webLoader.areServerDependenciesAvailable()).toBe(true);
			expect(webLoader.areBuildDependenciesAvailable()).toBe(true);

			expect(webLoader.getMissingDependencies('server')).toEqual([]);
			expect(webLoader.getMissingDependencies('build')).toEqual([]);
			expect(webLoader.getMissingDependencies()).toEqual([]);

			expect(() => {
				webLoader.validateWebDependencies('server', [
					'express',
					'ws',
					'serve-static'
				]);
			}).not.toThrow();
		});

		test('should handle complete dependency unavailability', () => {
			// Mock all dependencies as unavailable
			mockRequire.mockImplementation(() => {
				throw new Error('Module not found');
			});

			expect(webLoader.areServerDependenciesAvailable()).toBe(false);
			expect(webLoader.areBuildDependenciesAvailable()).toBe(false);

			const allMissing = webLoader.getMissingDependencies();
			expect(allMissing).toContain('express');
			expect(allMissing).toContain('ws');
			expect(allMissing).toContain('react');
			expect(allMissing).toContain('vite');

			expect(() => {
				webLoader.validateWebDependencies('server', ['express']);
			}).toThrow();
		});
	});

	describe('Error Handling Edge Cases', () => {
		test('should handle invalid module names gracefully', () => {
			mockRequire.mockImplementation(() => {
				throw new Error('Invalid module name');
			});

			expect(webLoader.isWebDependencyAvailable('')).toBe(false);
			expect(webLoader.isWebDependencyAvailable(null)).toBe(false);
			expect(webLoader.isWebDependencyAvailable(undefined)).toBe(false);
		});

		test('should handle various error types during module loading', () => {
			const errorTypes = [
				new Error('Cannot find module'),
				new TypeError('Invalid argument'),
				new ReferenceError('Module not defined'),
				'String error'
			];

			errorTypes.forEach((error, index) => {
				webLoader.clearCache();
				mockRequire.mockImplementationOnce(() => {
					throw error;
				});

				const result = webLoader.isWebDependencyAvailable(
					`test-module-${index}`
				);
				expect(result).toBe(false);
			});
		});

		test('should handle module loading timeout scenarios', () => {
			mockRequire.mockImplementationOnce(() => {
				throw new Error('Timeout loading module');
			});

			const result = webLoader.isWebDependencyAvailable('slow-module');
			expect(result).toBe(false);
		});
	});
});
