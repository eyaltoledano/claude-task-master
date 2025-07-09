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

		// 1. Decode URI Encoding
		// Use try-catch for decoding as malformed URIs can throw
		try {
			pathString = decodeURIComponent(pathString);
		} catch (decodeError) {
			if (log)
				log.warn(
					`Could not decode URI component for path "${rawPath}": ${decodeError.message}. Proceeding with raw string.`
				);
			// Proceed with the original string if decoding fails
			pathString = Array.isArray(rawPath) ? rawPath[0] : String(rawPath);
		}

		// 2. Strip file:// prefix (handle 2 or 3 slashes)
		if (pathString.startsWith('file:///')) {
			pathString = pathString.slice(7); // Slice 7 for file:///, may leave leading / on Windows
		} else if (pathString.startsWith('file://')) {
			pathString = pathString.slice(7); // Slice 7 for file://
		}

		// 3. Handle potential Windows leading slash after stripping prefix (e.g., /C:/...)
		// This checks if it starts with / followed by a drive letter C: D: etc.
		if (
			pathString.startsWith('/') &&
			/[A-Za-z]:/.test(pathString.substring(1, 3))
		) {
			pathString = pathString.substring(1); // Remove the leading slash
		}

		// 4. Normalize backslashes to forward slashes
		pathString = pathString.replace(/\\/g, '/');

		// 5. Resolve to absolute path using server's OS convention
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
		// Add detailed logging of session structure
		log.info(
			`Session object: ${JSON.stringify({
				hasSession: !!session,
				hasRoots: !!session?.roots,
				rootsType: typeof session?.roots,
				isRootsArray: Array.isArray(session?.roots),
				rootsLength: session?.roots?.length,
				firstRoot: session?.roots?.[0],
				hasRootsRoots: !!session?.roots?.roots,
				rootsRootsType: typeof session?.roots?.roots,
				isRootsRootsArray: Array.isArray(session?.roots?.roots),
				rootsRootsLength: session?.roots?.roots?.length,
				firstRootsRoot: session?.roots?.roots?.[0]
			})}`
		);

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
			// Decode URI and strip file:// protocol
			decodedPath = rawRootPath.startsWith('file://')
				? decodeURIComponent(rawRootPath.slice(7))
				: rawRootPath; // Assume non-file URI is already decoded? Or decode anyway? Let's decode.
			if (!rawRootPath.startsWith('file://')) {
				decodedPath = decodeURIComponent(rawRootPath); // Decode even if no file://
			}

			// Handle potential Windows drive prefix after stripping protocol (e.g., /C:/...)
			if (
				decodedPath.startsWith('/') &&
				/[A-Za-z]:/.test(decodedPath.substring(1, 3))
			) {
				decodedPath = decodedPath.substring(1); // Remove leading slash if it's like /C:/...
			}

			log.info(`Decoded path: ${decodedPath}`);

			// Normalize slashes and resolve
			const normalizedSlashes = decodedPath.replace(/\\/g, '/');
			finalPath = path.resolve(normalizedSlashes); // Resolve to absolute path for current OS

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
		return this.#paths.taskMasterDir;
	}

	/**
	 * @returns {string|null} The absolute path to the tasks.json file.
	 */
	getTasksPath() {
		return this.#paths.tasksPath;
	}

	/**
	 * @returns {string|null} The absolute path to the PRD file.
	 */
	getPrdPath() {
		return this.#paths.prdPath;
	}

	/**
	 * @returns {string|null} The absolute path to the complexity report.
	 */
	getComplexityReportPath() {
		return this.#paths.complexityReportPath;
	}

	/**
	 * @returns {string|null} The absolute path to the config.json file.
	 */
	getConfigPath() {
		return this.#paths.configPath;
	}

	/**
	 * @returns {string|null} The absolute path to the state.json file.
	 */
	getStatePath() {
		return this.#paths.statePath;
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
 * @param {object} [overrides={}] - An object with possible path overrides.
 * @param {string} [overrides.projectRoot]
 * @param {string} [overrides.tasksPath]
 * @param {string} [overrides.prdPath]
 * @param {string} [overrides.complexityReportPath]
 * @param {string} [overrides.configPath]
 * @param {string} [overrides.statePath]
 * @returns {TaskMaster} An initialized TaskMaster instance.
 */
export function initTaskMaster(overrides = {}) {
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
		basePath = null
	) => {
		if (typeof override === 'string') {
			const resolvedPath = path.isAbsolute(override)
				? override
				: path.resolve(basePath || process.cwd(), override);

			if (!fs.existsSync(resolvedPath)) {
				throw new Error(
					`${pathType} override path does not exist: ${resolvedPath}`
				);
			}
			return resolvedPath;
		}

		if (override === true) {
			// Required path - search defaults and fail if not found
			for (const defaultPath of defaultPaths) {
				const fullPath = path.isAbsolute(defaultPath)
					? defaultPath
					: path.join(basePath || process.cwd(), defaultPath);
				if (fs.existsSync(fullPath)) {
					return fullPath;
				}
			}
			throw new Error(
				`Required ${pathType} not found. Searched: ${defaultPaths.join(', ')}`
			);
		}

		// Optional path (override === false/undefined) - search defaults, return null if not found
		for (const defaultPath of defaultPaths) {
			const fullPath = path.isAbsolute(defaultPath)
				? defaultPath
				: path.join(basePath || process.cwd(), defaultPath);
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
			throw new Error(
				`Project root override path does not exist: ${resolvedOverride}`
			);
		}

		const hasTaskmasterDir = fs.existsSync(
			path.join(resolvedOverride, TASKMASTER_DIR)
		);
		const hasLegacyConfig = fs.existsSync(
			path.join(resolvedOverride, LEGACY_CONFIG_FILE)
		);

		if (!hasTaskmasterDir && !hasLegacyConfig) {
			throw new Error(
				`Project root override is not a valid taskmaster project: ${resolvedOverride}`
			);
		}

		paths.projectRoot = resolvedOverride;
	} else {
		const foundRoot = findProjectRoot();
		if (!foundRoot) {
			throw new Error(
				'Unable to find project root. No project markers found. Run "init" command first.'
			);
		}
		paths.projectRoot = foundRoot;
	}

	// TaskMaster Directory
	if ('taskMasterDir' in overrides) {
		paths.taskMasterDir = resolvePath(
			'taskmaster directory',
			overrides.taskMasterDir,
			[TASKMASTER_DIR],
			paths.projectRoot
		);
	} else {
		paths.taskMasterDir = resolvePath(
			'taskmaster directory',
			false,
			[TASKMASTER_DIR],
			paths.projectRoot
		);
	}

	// Always set default paths first
	// These can be overridden below if needed
	paths.configPath = path.join(paths.projectRoot, TASKMASTER_CONFIG_FILE);
	paths.statePath = path.join(
		paths.taskMasterDir || path.join(paths.projectRoot, TASKMASTER_DIR),
		'state.json'
	);
	paths.tasksPath = path.join(paths.projectRoot, TASKMASTER_TASKS_FILE);

	// Handle overrides - only validate/resolve if explicitly provided
	if ('configPath' in overrides) {
		paths.configPath = resolvePath(
			'config file',
			overrides.configPath,
			[TASKMASTER_CONFIG_FILE, LEGACY_CONFIG_FILE],
			paths.projectRoot
		);
	}

	if ('statePath' in overrides) {
		paths.statePath = resolvePath(
			'state file',
			overrides.statePath,
			['state.json'],
			paths.taskMasterDir
		);
	}

	if ('tasksPath' in overrides) {
		paths.tasksPath = resolvePath(
			'tasks file',
			overrides.tasksPath,
			[TASKMASTER_TASKS_FILE, LEGACY_TASKS_FILE],
			paths.projectRoot
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
			paths.projectRoot
		);
	}

	return new TaskMaster(paths);
}

/**
 * Higher-order function that wraps MCP tool handlers with TaskMaster initialization.
 * This replaces withNormalizedProjectRoot by providing a TaskMaster instance
 * that contains all resolved paths upfront. Implements the same priority logic
 * as withNormalizedProjectRoot for project root resolution.
 *
 * @param {Object} pathConfig - Configuration object for path mapping
 * @param {Object} pathConfig.parameterMap - Maps arg names to TaskMaster path names
 * @param {string[]} pathConfig.required - Array of TaskMaster path names that are required
 * @returns {Function} - Function that takes a handler and returns wrapped handler
 */
export function withTaskMaster(pathConfig = {}) {
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

				// Set up overrides for initTaskMaster
				const overrides = {
					projectRoot: normalizedRoot
				};

				// Apply path configuration mappings
				Object.entries(pathConfig).forEach(([taskMasterPath, argName]) => {
					if (argName in args) {
						const isRequired = pathConfig.required?.includes(taskMasterPath);
						overrides[taskMasterPath] =
							args[argName] || (isRequired ? true : false);
					}
				});

				// Handle required paths that weren't explicitly mapped
				if (pathConfig.required) {
					pathConfig.required.forEach((requiredPath) => {
						if (!(requiredPath in overrides)) {
							overrides[requiredPath] = true;
						}
					});
				}

				const taskMaster = initTaskMaster(overrides);
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
