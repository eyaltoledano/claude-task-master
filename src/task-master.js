/**
 * task-master.js
 * This module provides a centralized path management system for the Task Master application.
 * It exports the TaskMaster class and the initTaskMaster factory function to create a single,
 * authoritative source for all critical file and directory paths, resolving circular dependencies.
 */

import path from 'path';
import fs from 'fs';
import {
	TASKMASTER_DIR,
	TASKMASTER_TASKS_FILE,
	LEGACY_TASKS_FILE,
	TASKMASTER_DOCS_DIR,
	TASKMASTER_REPORTS_DIR,
	TASKMASTER_CONFIG_FILE,
	LEGACY_CONFIG_FILE
} from './constants/paths.js';

/**
 * Custom error class for TaskMaster-specific errors
 */
export class TaskMasterError extends Error {
	constructor(message, code = 'TASKMASTER_ERROR') {
		super(message);
		this.name = 'TaskMasterError';
		this.code = code;
		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, TaskMasterError);
		}
	}
}

/**
 * Helper function to decode URI components and handle Windows path normalization
 * @param {string} rawPath - The raw path that may be URI-encoded
 * @param {Object} log - Logger instance
 * @returns {string|null} - Normalized path or null on error
 */
function decodeAndNormalizePath(rawPath, log) {
	if (!rawPath) return null;

	try {
		let pathString = rawPath;

		// 1. Decode URI Encoding
		try {
			pathString = decodeURIComponent(pathString);
		} catch (decodeError) {
			if (log) {
				log.warn(
					`Could not decode URI component for path "${rawPath}": ${decodeError.message}. Proceeding with raw string.`
				);
			}
			// Proceed with the original string if decoding fails
			pathString = rawPath;
		}

		// 2. Strip file:// prefix (handle 2 or 3 slashes)
		if (pathString.startsWith('file:///')) {
			pathString = pathString.slice(7); // Slice 7 for file:///, keeping the leading slash
		} else if (pathString.startsWith('file://')) {
			pathString = pathString.slice(7); // Slice 7 for file://
		}

		// 3. Handle potential Windows leading slash after stripping prefix (e.g., /C:/...)
		if (
			pathString.startsWith('/') &&
			/[A-Za-z]:/.test(pathString.substring(1, 3))
		) {
			pathString = pathString.substring(1); // Remove the leading slash
		}

		// 4. Normalize backslashes to forward slashes
		pathString = pathString.replace(/\\/g, '/');

		return pathString;
	} catch (error) {
		if (log) {
			log.error(
				`Error decoding and normalizing path "${rawPath}": ${error.message}`
			);
		}
		return null;
	}
}

/**
 * Resolves and normalizes a project root path from various formats.
 * Handles URI encoding, Windows paths, and file protocols.
 * @param {string | undefined | null} rawPath - The raw project root path.
 * @param {object} [log] - Optional logger object.
 * @returns {string | null} Normalized absolute path or null if input is invalid/empty.
 */
function normalizeProjectRoot(rawPath, log) {
	if (!rawPath) return null;
	try {
		let pathString = Array.isArray(rawPath) ? rawPath[0] : String(rawPath);
		if (!pathString) return null;

		// Use helper function for decoding and normalization
		pathString = decodeAndNormalizePath(pathString, log);
		if (!pathString) return null;

		// Resolve to absolute path using server's OS convention
		const resolvedPath = path.resolve(pathString);
		return resolvedPath;
	} catch (error) {
		if (log) {
			log.error(
				`Error normalizing project root path "${rawPath}": ${error.message}`
			);
		}
		return null; // Return null on error
	}
}

/**
 * Extracts and normalizes the project root path from the MCP session object.
 * @param {Object} session - The MCP session object.
 * @param {Object} log - The MCP logger object.
 * @returns {string|null} - The normalized absolute project root path or null if not found/invalid.
 */
function getProjectRootFromSession(session, log) {
	try {
		// Debug logging of session structure (reduced verbosity)
		if (log.debug) {
			log.debug(
				`Session roots: primary=${!!session?.roots?.[0]?.uri}, alternate=${!!session?.roots?.roots?.[0]?.uri}`
			);
		}

		let rawRootPath = null;
		let decodedPath = null;
		let finalPath = null;

		// Check primary location
		if (session?.roots?.[0]?.uri) {
			rawRootPath = session.roots[0].uri;
			log.info(`Found raw root URI in session.roots[0].uri: ${rawRootPath}`);
		}
		// Check alternate location
		else if (session?.roots?.roots?.[0]?.uri) {
			rawRootPath = session.roots.roots[0].uri;
			log.info(
				`Found raw root URI in session.roots.roots[0].uri: ${rawRootPath}`
			);
		}

		if (rawRootPath) {
			// Use helper function for decoding and normalization
			decodedPath = decodeAndNormalizePath(rawRootPath, log);
			if (!decodedPath) {
				log.warn(`Failed to decode path: ${rawRootPath}`);
				return null;
			}

			log.info(`Decoded path: ${decodedPath}`);

			// Resolve to absolute path for current OS
			finalPath = path.resolve(decodedPath);

			log.info(`Normalized and resolved session path: ${finalPath}`);
			return finalPath;
		}

		// Fallback Logic (remains the same)
		log.warn('No project root URI found in session. Attempting fallbacks...');
		const cwd = process.cwd();

		// Fallback 1: Use server path deduction (Cursor IDE)
		const serverPath = process.argv[1];
		if (serverPath && serverPath.includes('mcp-server')) {
			const mcpServerIndex = serverPath.indexOf('mcp-server');
			if (mcpServerIndex !== -1) {
				const projectRoot = path.dirname(
					serverPath.substring(0, mcpServerIndex)
				); // Go up one level

				if (
					fs.existsSync(path.join(projectRoot, '.cursor')) ||
					fs.existsSync(path.join(projectRoot, 'mcp-server')) ||
					fs.existsSync(path.join(projectRoot, 'package.json'))
				) {
					log.info(
						`Using project root derived from server path: ${projectRoot}`
					);
					return projectRoot; // Already absolute
				}
			}
		}

		// Fallback 2: Use CWD
		log.info(`Using current working directory as ultimate fallback: ${cwd}`);
		return cwd; // Already absolute
	} catch (e) {
		log.error(`Error in getProjectRootFromSession: ${e.message}`);
		// Attempt final fallback to CWD on error
		const cwd = process.cwd();
		log.warn(
			`Returning CWD (${cwd}) due to error during session root processing.`
		);
		return cwd;
	}
}

/**
 * Export TaskMasterError for error filtering
 */

/**
 * TaskMaster class manages all the paths for the application.
 * An instance of this class is created by the initTaskMaster function.
 */
export class TaskMaster {
	#paths;

	/**
	 * The constructor is intended to be used only by the initTaskMaster factory function.
	 * @param {object} paths - A pre-resolved object of all application paths.
	 */
	constructor(paths) {
		this.#paths = Object.freeze({ ...paths });
	}

	/**
	 * @returns {string|null} The absolute path to the project root.
	 */
	getProjectRoot() {
		return this.#paths.projectRoot;
	}

	/**
	 * @returns {string|null} The absolute path to the .taskmaster directory.
	 */
	getTaskMasterDir() {
		return this.#paths.taskMasterDir ?? null;
	}

	/**
	 * @returns {string|null} The absolute path to the tasks.json file.
	 */
	getTasksPath() {
		return this.#paths.tasksPath ?? null;
	}

	/**
	 * @returns {string|null} The absolute path to the PRD file.
	 */
	getPrdPath() {
		return this.#paths.prdPath ?? null;
	}

	/**
	 * @returns {string|null} The absolute path to the complexity report.
	 */
	getComplexityReportPath() {
		return this.#paths.complexityReportPath ?? null;
	}

	/**
	 * @returns {string|null} The absolute path to the config.json file.
	 */
	getConfigPath() {
		return this.#paths.configPath ?? null;
	}

	/**
	 * @returns {string|null} The absolute path to the state.json file.
	 */
	getStatePath() {
		return this.#paths.statePath ?? null;
	}

	/**
	 * @returns {object} A frozen object containing all resolved paths.
	 */
	getAllPaths() {
		return this.#paths;
	}
}

/**
 * Initializes a TaskMaster instance with resolved paths.
 * This function centralizes path resolution logic.
 *
 * @param {object} [options={}] - An object with initialization options.
 * @param {string} [options.projectRoot] - Explicit project root path
 * @param {boolean} [options.bootstrap] - Bootstrap mode bypasses .taskmaster directory validation
 * @param {object} [options.paths] - Path overrides object
 * @param {string[]} [options.required] - Array of required path names (for future enforcement)
 * @returns {TaskMaster} An initialized TaskMaster instance.
 */
export function initTaskMaster(options = {}) {
	const {
		projectRoot,
		bootstrap = false,
		paths: pathOverrides = {},
		required = []
	} = options;

	// merge into the internal 'overrides' object that the existing
	// resolution logic already expects
	const overrides = { bootstrap };
	if (projectRoot !== undefined) overrides.projectRoot = projectRoot;
	Object.entries(pathOverrides).forEach(([k, v]) => (overrides[k] = v));

	// Note: required array is kept for future enforcement, but not processed yet
	// This allows for a more lenient approach aligned with MCP versions
	const findProjectRoot = (startDir = process.cwd()) => {
		const projectMarkers = [TASKMASTER_DIR, LEGACY_CONFIG_FILE];
		let currentDir = path.resolve(startDir);
		const rootDir = path.parse(currentDir).root;
		while (currentDir !== rootDir) {
			for (const marker of projectMarkers) {
				const markerPath = path.join(currentDir, marker);
				if (fs.existsSync(markerPath)) {
					return currentDir;
				}
			}
			currentDir = path.dirname(currentDir);
		}
		return null;
	};

	const resolvePath = (
		pathType,
		override,
		defaultPaths = [],
		basePath = null,
		validateExistence = true
	) => {
		// Handle string paths - resolve and optionally validate existence
		if (typeof override === 'string') {
			const resolvedPath = path.isAbsolute(override)
				? override
				: path.resolve(basePath ?? process.cwd(), override);

			if (validateExistence && !fs.existsSync(resolvedPath)) {
				throw new TaskMasterError(
					`${pathType} override path does not exist: ${resolvedPath}`,
					'PATH_NOT_FOUND'
				);
			}
			return resolvedPath;
		}

		// Handle false - explicitly disabled, return null
		if (override === false) {
			return null;
		}

		// Handle null and undefined - search defaults, return first default if not found
		if (override === null || override === undefined) {
			for (const defaultPath of defaultPaths) {
				const fullPath = path.isAbsolute(defaultPath)
					? defaultPath
					: path.join(basePath ?? process.cwd(), defaultPath);
				if (fs.existsSync(fullPath)) {
					return fullPath;
				}
			}
			// Return the first default path even if it doesn't exist
			if (defaultPaths.length > 0) {
				const firstDefault = defaultPaths[0];
				return path.isAbsolute(firstDefault)
					? firstDefault
					: path.join(basePath ?? process.cwd(), firstDefault);
			}
			return null;
		}

		// Fallback for any other value - treat as undefined
		for (const defaultPath of defaultPaths) {
			const fullPath = path.isAbsolute(defaultPath)
				? defaultPath
				: path.join(basePath ?? process.cwd(), defaultPath);
			if (fs.existsSync(fullPath)) {
				return fullPath;
			}
		}

		return null;
	};

	const paths = {};

	// Project Root
	if (overrides.projectRoot) {
		const resolvedOverride = path.resolve(overrides.projectRoot);
		if (!fs.existsSync(resolvedOverride)) {
			throw new TaskMasterError(
				`Project root override path does not exist: ${resolvedOverride}`,
				'PROJECT_ROOT_NOT_FOUND'
			);
		}

		// Skip validation in bootstrap mode
		if (!overrides.bootstrap) {
			const hasTaskmasterDir = fs.existsSync(
				path.join(resolvedOverride, TASKMASTER_DIR)
			);
			const hasLegacyConfig = fs.existsSync(
				path.join(resolvedOverride, LEGACY_CONFIG_FILE)
			);

			if (!hasTaskmasterDir && !hasLegacyConfig) {
				throw new TaskMasterError(
					`Project root override is not a valid taskmaster project: ${resolvedOverride}`,
					'INVALID_TASKMASTER_PROJECT'
				);
			}
		}

		paths.projectRoot = resolvedOverride;
	} else {
		// In bootstrap mode, use current directory if no project root found
		if (overrides.bootstrap) {
			paths.projectRoot = process.cwd();
		} else {
			const foundRoot = findProjectRoot();
			if (!foundRoot) {
				throw new TaskMasterError(
					'Unable to find project root. No project markers found. Run "init" command first.',
					'PROJECT_ROOT_NOT_FOUND'
				);
			}
			paths.projectRoot = foundRoot;
		}
	}

	// TaskMaster Directory - always provide default path unless explicit override
	if (overrides.taskMasterDir !== undefined) {
		paths.taskMasterDir = resolvePath(
			'taskmaster directory',
			overrides.taskMasterDir,
			[TASKMASTER_DIR],
			paths.projectRoot
		);
	} else {
		paths.taskMasterDir = path.join(paths.projectRoot, TASKMASTER_DIR);
	}

	// Core paths - search for existing files when explicitly requested, otherwise use defaults

	if ('configPath' in overrides) {
		paths.configPath = resolvePath(
			'config file',
			overrides.configPath,
			[TASKMASTER_CONFIG_FILE, LEGACY_CONFIG_FILE],
			paths.projectRoot
		);
	} else {
		paths.configPath = path.join(paths.projectRoot, TASKMASTER_CONFIG_FILE);
	}

	if ('tasksPath' in overrides) {
		paths.tasksPath = resolvePath(
			'tasks file',
			overrides.tasksPath,
			[TASKMASTER_TASKS_FILE, LEGACY_TASKS_FILE],
			paths.projectRoot
		);
	} else {
		paths.tasksPath = path.join(paths.projectRoot, TASKMASTER_TASKS_FILE);
	}

	// Optional paths - only resolve if explicitly requested
	if ('statePath' in overrides) {
		paths.statePath = resolvePath(
			'state file',
			overrides.statePath,
			['state.json'],
			paths.taskMasterDir
		);
	}

	if ('prdPath' in overrides) {
		paths.prdPath = resolvePath(
			'PRD file',
			overrides.prdPath,
			[
				path.join(TASKMASTER_DOCS_DIR, 'PRD.md'),
				path.join(TASKMASTER_DOCS_DIR, 'prd.md'),
				path.join(TASKMASTER_DOCS_DIR, 'PRD.txt'),
				path.join(TASKMASTER_DOCS_DIR, 'prd.txt'),
				path.join('scripts', 'PRD.md'),
				path.join('scripts', 'prd.md'),
				path.join('scripts', 'PRD.txt'),
				path.join('scripts', 'prd.txt'),
				'PRD.md',
				'prd.md',
				'PRD.txt',
				'prd.txt'
			],
			paths.projectRoot
		);
	}

	if ('complexityReportPath' in overrides) {
		paths.complexityReportPath = resolvePath(
			'complexity report',
			overrides.complexityReportPath,
			[
				path.join(TASKMASTER_REPORTS_DIR, 'task-complexity-report.json'),
				path.join(TASKMASTER_REPORTS_DIR, 'complexity-report.json'),
				path.join('scripts', 'task-complexity-report.json'),
				path.join('scripts', 'complexity-report.json'),
				'task-complexity-report.json',
				'complexity-report.json'
			],
			paths.projectRoot,
			false // Don't validate existence for output files
		);
	}

	// Enforce required paths - check that all required paths exist
	required.forEach((requiredPath) => {
		const resolvedPath = paths[requiredPath];

		// Check if required path is set and exists
		if (requiredPath in overrides) {
			// Path was explicitly requested - validate it exists
			if (
				resolvedPath === null ||
				(typeof resolvedPath === 'string' && !fs.existsSync(resolvedPath))
			) {
				// Path was requested but not found - generate specific error with search paths
				let pathType, searchPaths;

				switch (requiredPath) {
					case 'tasksPath':
						pathType = 'tasks file';
						searchPaths = [TASKMASTER_TASKS_FILE, LEGACY_TASKS_FILE];
						break;
					case 'configPath':
						pathType = 'config file';
						searchPaths = [TASKMASTER_CONFIG_FILE, LEGACY_CONFIG_FILE];
						break;
					case 'statePath':
						pathType = 'state file';
						searchPaths = ['state.json'];
						break;
					case 'prdPath':
						pathType = 'PRD file';
						searchPaths = [
							path.join(TASKMASTER_DOCS_DIR, 'PRD.md'),
							path.join(TASKMASTER_DOCS_DIR, 'prd.md'),
							'PRD.md',
							'prd.md'
						];
						break;
					case 'complexityReportPath':
						pathType = 'complexity report';
						searchPaths = [
							path.join(TASKMASTER_REPORTS_DIR, 'task-complexity-report.json'),
							'task-complexity-report.json',
							'complexity-report.json'
						];
						break;
					default:
						pathType = requiredPath
							.replace('Path', '')
							.replace('Dir', ' directory');
						searchPaths = [];
				}

				throw new TaskMasterError(
					`Required ${pathType} not found. Searched: ${searchPaths.join(', ')}`,
					'REQUIRED_PATH_NOT_FOUND'
				);
			}
		}
	});

	return new TaskMaster(paths);
}

/**
 * Higher-order function that wraps MCP tool handlers with TaskMaster initialization.
 * This replaces withNormalizedProjectRoot by providing a TaskMaster instance
 * that contains all resolved paths upfront. Implements the same priority logic
 * as withNormalizedProjectRoot for project root resolution.
 *
 * @param {Object} options - Configuration options
 * @param {Object} [options.paths] - Maps TaskMaster path names to arg names (e.g., {tasksPath: 'file'})
 * @param {string[]} [options.required] - Array of TaskMaster path names that are required
 * @param {boolean} [options.bootstrap] - Bootstrap mode bypasses .taskmaster directory validation
 *
 * @note When using bootstrap mode, avoid marking paths as required, as bootstrap mode is intended
 * for initialization scenarios where .taskmaster directory may not exist yet. Required paths in
 * bootstrap mode may cause failures if dependencies haven't been created.
 * @returns {Function} - Function that takes a handler and returns wrapped handler
 */
export function withTaskMaster({
	paths = {},
	required = [],
	bootstrap = false
} = {}) {
	return (handler) => {
		return async (args, context) => {
			const { log, session } = context;
			let normalizedRoot = null;
			let rootSource = 'unknown';

			try {
				// PRECEDENCE ORDER (same as withNormalizedProjectRoot):
				// 1. TASK_MASTER_PROJECT_ROOT environment variable (from process.env or session)
				// 2. args.projectRoot (explicitly provided)
				// 3. Session-based project root resolution
				// 4. Current directory fallback (handled by initTaskMaster)

				// 1. Check for TASK_MASTER_PROJECT_ROOT environment variable first
				if (process.env.TASK_MASTER_PROJECT_ROOT) {
					const envRoot = process.env.TASK_MASTER_PROJECT_ROOT;
					normalizedRoot = path.isAbsolute(envRoot)
						? envRoot
						: path.resolve(process.cwd(), envRoot);
					rootSource = 'TASK_MASTER_PROJECT_ROOT environment variable';
					log.info(`Using project root from ${rootSource}: ${normalizedRoot}`);
				}
				// Also check session environment variables for TASK_MASTER_PROJECT_ROOT
				else if (session?.env?.TASK_MASTER_PROJECT_ROOT) {
					const envRoot = session.env.TASK_MASTER_PROJECT_ROOT;
					normalizedRoot = path.isAbsolute(envRoot)
						? envRoot
						: path.resolve(process.cwd(), envRoot);
					rootSource = 'TASK_MASTER_PROJECT_ROOT session environment variable';
					log.info(`Using project root from ${rootSource}: ${normalizedRoot}`);
				}
				// 2. If no environment variable, try args.projectRoot
				else if (args.projectRoot) {
					normalizedRoot = normalizeProjectRoot(args.projectRoot, log);
					rootSource = 'args.projectRoot';
					log.info(`Using project root from ${rootSource}: ${normalizedRoot}`);
				}
				// 3. If no args.projectRoot, try session-based resolution
				else {
					const sessionRoot = getProjectRootFromSession(session, log);
					if (sessionRoot) {
						normalizedRoot = sessionRoot; // getProjectRootFromSession already normalizes
						rootSource = 'session';
						log.info(
							`Using project root from ${rootSource}: ${normalizedRoot}`
						);
					}
				}

				const initOptions = {
					projectRoot: normalizedRoot,
					bootstrap,
					paths: {},
					required
				};

				Object.entries(paths).forEach(([taskPath, argKey]) => {
					if (argKey in args && args[argKey] !== undefined) {
						initOptions.paths[taskPath] = args[argKey];
					} else if (required.includes(taskPath)) {
						// Required path not provided via args - set to undefined to trigger search
						initOptions.paths[taskPath] = undefined;
					}
				});

				// Handle required paths that weren't explicitly mapped
				required.forEach((requiredPath) => {
					if (!(requiredPath in initOptions.paths)) {
						initOptions.paths[requiredPath] = undefined;
					}
				});

				const taskMaster = initTaskMaster(initOptions);
				return await handler(taskMaster, args, context);
			} catch (error) {
				log.error(
					`Error within withTaskMaster HOF (Normalized Root: ${normalizedRoot}): ${error.message}`
				);
				// Add stack trace if available and debug enabled
				if (error.stack && log.debug) {
					log.debug(error.stack);
				}
				// Re-throw the error to maintain compatibility with existing error handling
				throw error;
			}
		};
	};
}
