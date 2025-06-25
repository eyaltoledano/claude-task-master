/**
 * Conditional Web Dependencies Loader
 *
 * This module provides conditional loading for web-related dependencies,
 * allowing the CLI to function normally when web dependencies are not installed,
 * while enabling web functionality when they are available.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { debounce } from 'lodash-es';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for loaded modules to avoid repeated loading attempts
const moduleCache = new Map();
const failedModules = new Set();

/**
 * Safely attempts to require a module with graceful fallback
 * @param {string} moduleName - Name of the module to require
 * @param {*} fallbackValue - Value to return if module is not available
 * @returns {*} The required module or fallback value
 */
function safeRequire(moduleName, fallbackValue = null) {
	// Return cached result if available
	if (moduleCache.has(moduleName)) {
		return moduleCache.get(moduleName);
	}

	// Don't attempt to load modules that have already failed
	if (failedModules.has(moduleName)) {
		return fallbackValue;
	}

	try {
		const module = require(moduleName);
		moduleCache.set(moduleName, module);
		return module;
	} catch (error) {
		// Mark module as failed and cache the fallback
		failedModules.add(moduleName);
		moduleCache.set(moduleName, fallbackValue);

		// Only log in development or when explicitly requested
		if (
			process.env.NODE_ENV === 'development' ||
			process.env.TASKMASTER_LOG_LEVEL === 'debug'
		) {
			console.debug(
				`[WebLoader] Module '${moduleName}' not available: ${error.message}`
			);
		}

		return fallbackValue;
	}
}

/**
 * Check if a web dependency is available
 * @param {string} moduleName - Name of the module to check
 * @returns {boolean} True if module is available
 */
export function isWebDependencyAvailable(moduleName) {
	return !failedModules.has(moduleName) && safeRequire(moduleName) !== null;
}

/**
 * Get all available web dependencies status
 * @returns {Object} Object with dependency names as keys and availability as values
 */
export function getWebDependenciesStatus() {
	const dependencies = [
		'express',
		'ws',
		'chokidar',
		'serve-static',
		'cors',
		'react',
		'react-dom',
		'vite'
	];
	const status = {};

	dependencies.forEach((dep) => {
		status[dep] = isWebDependencyAvailable(dep);
	});

	return status;
}

/**
 * Conditional Express.js loader
 * @returns {Object|null} Express module or null if not available
 */
export function loadExpress() {
	return safeRequire('express', null);
}

/**
 * Conditional WebSocket (ws) loader
 * @returns {Object|null} WebSocket module or null if not available
 */
export function loadWebSocket() {
	return safeRequire('ws', null);
}

/**
 * Conditional Chokidar (file watcher) loader
 * @returns {Object|null} Chokidar module or null if not available
 */
export function loadChokidar() {
	return safeRequire('chokidar', null);
}

/**
 * Conditional serve-static loader
 * @returns {Function|null} serve-static function or null if not available
 */
export function loadServeStatic() {
	return safeRequire('serve-static', null);
}

/**
 * Conditional CORS loader
 * @returns {Function|null} CORS middleware function or null if not available
 */
export function loadCors() {
	return safeRequire('cors', null);
}

/**
 * Alias for loadWebSocket for consistency
 * @returns {Object|null} WebSocket module or null if not available
 */
export function loadWs() {
	return loadWebSocket();
}

/**
 * Conditional Net (Node.js built-in) loader
 * @returns {Object|null} Net module or null if not available
 */
export function loadNet() {
	return safeRequire('net', null);
}

/**
 * Conditional React loader
 * @returns {Object|null} React module or null if not available
 */
export function loadReact() {
	return safeRequire('react', null);
}

/**
 * Conditional React DOM loader
 * @returns {Object|null} ReactDOM module or null if not available
 */
export function loadReactDOM() {
	return safeRequire('react-dom', null);
}

/**
 * Conditional Vite loader
 * @returns {Object|null} Vite module or null if not available
 */
export function loadVite() {
	return safeRequire('vite', null);
}

/**
 * Conditional Vite React plugin loader
 * @returns {Object|null} Vite React plugin or null if not available
 */
export function loadViteReactPlugin() {
	return safeRequire('@vitejs/plugin-react', null);
}

/**
 * Check if all required web dependencies for the server are available
 * @returns {boolean} True if all server dependencies are available
 */
export function areServerDependenciesAvailable() {
	const requiredDeps = ['express', 'ws', 'serve-static', 'cors'];
	return requiredDeps.every((dep) => isWebDependencyAvailable(dep));
}

/**
 * Check if all required web dependencies for the build system are available
 * @returns {boolean} True if all build dependencies are available
 */
export function areBuildDependenciesAvailable() {
	const requiredDeps = ['vite', '@vitejs/plugin-react', 'react', 'react-dom'];
	return requiredDeps.every((dep) => isWebDependencyAvailable(dep));
}

/**
 * Get missing dependencies for a specific feature
 * @param {string} feature - Feature name ('server' or 'build')
 * @returns {string[]} Array of missing dependency names
 */
export function getMissingDependencies(feature = 'all') {
	const dependencies = {
		server: ['express', 'ws', 'serve-static', 'chokidar', 'cors'],
		build: ['vite', '@vitejs/plugin-react', 'react', 'react-dom'],
		all: [
			'express',
			'ws',
			'serve-static',
			'chokidar',
			'cors',
			'vite',
			'@vitejs/plugin-react',
			'react',
			'react-dom'
		]
	};

	const depsToCheck = dependencies[feature] || dependencies.all;
	return depsToCheck.filter((dep) => !isWebDependencyAvailable(dep));
}

/**
 * Create a graceful error message for missing web dependencies
 * @param {string} feature - Feature that requires the dependencies
 * @param {string[]} missingDeps - Array of missing dependency names
 * @returns {string} Formatted error message
 */
export function createMissingDependencyMessage(feature, missingDeps) {
	if (!missingDeps || missingDeps.length === 0) {
		return '';
	}

	const depList = missingDeps.map((dep) => `  - ${dep}`).join('\n');

	return `
Web ${feature} functionality requires additional dependencies that are not installed:

${depList}

To enable web functionality, install the dependencies:
  npm install

If you only need CLI functionality, you can continue using Task Master without these dependencies.
`.trim();
}

/**
 * Validate that web dependencies are available before attempting to use them
 * @param {string} feature - Feature name for error messaging
 * @param {string[]} requiredDeps - Array of required dependency names
 * @throws {Error} If required dependencies are missing
 */
export function validateWebDependencies(feature, requiredDeps = []) {
	const missing = requiredDeps.filter((dep) => !isWebDependencyAvailable(dep));

	if (missing.length > 0) {
		const message = createMissingDependencyMessage(feature, missing);
		throw new Error(message);
	}
}

/**
 * Clear the module cache (useful for testing)
 */
export function clearCache() {
	moduleCache.clear();
	failedModules.clear();
}

// Export a default object with all loaders for convenience
export default {
	loadExpress,
	loadWebSocket,
	loadWs,
	loadChokidar,
	loadServeStatic,
	loadCors,
	loadNet,
	loadReact,
	loadReactDOM,
	loadVite,
	loadViteReactPlugin,
	isWebDependencyAvailable,
	getWebDependenciesStatus,
	areServerDependenciesAvailable,
	areBuildDependenciesAvailable,
	getMissingDependencies,
	createMissingDependencyMessage,
	validateWebDependencies,
	clearCache
};

class FileWatcher {
	constructor(projectRoot, onUpdate) {
		this.projectRoot = projectRoot;
		this.onUpdate = onUpdate;
		this.watcher = null;

		// Debounced update with 100ms delay as specified in task
		this.debouncedUpdate = debounce((eventType, filePath) => {
			this.onUpdate(eventType, filePath);
		}, 100);
	}

	async initialize() {
		const chokidar = webLoader.loadChokidar();
		if (!chokidar) {
			throw new Error('File watcher dependency (chokidar) not available');
		}

		const taskMasterDir = '.taskmaster';
		const watchPaths = [
			path.join(this.projectRoot, taskMasterDir, 'tasks/**/*.json'),
			path.join(this.projectRoot, 'web/src/**/*'),
			path.join(this.projectRoot, 'scripts/**/*.js')
		];

		this.watcher = chokidar.watch(watchPaths, {
			ignored: /node_modules|\.git|dist/,
			persistent: true,
			ignoreInitial: true,
			awaitWriteFinish: {
				stabilityThreshold: 50,
				pollInterval: 10
			}
		});

		// Handle all relevant file system events
		this.watcher
			.on('add', (filePath) =>
				this.debouncedUpdate('TASK_FILE_ADDED', filePath)
			)
			.on('change', (filePath) =>
				this.debouncedUpdate('TASKS_UPDATED', filePath)
			)
			.on('unlink', (filePath) =>
				this.debouncedUpdate('TASK_FILE_DELETED', filePath)
			)
			.on('error', (error) => {
				console.error('File watcher error:', error);
				// Could emit error event or call error callback
			});

		return this.watcher;
	}

	close() {
		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
		}
	}
}
