/**
 * tools/utils.js
 * Utility functions for Task Master CLI integration
 */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { contextManager } from '../core/context-manager.js'; // Import the singleton

// Import path utilities to ensure consistent path resolution
import {
	lastFoundProjectRoot,
	PROJECT_MARKERS
} from '../core/utils/path-utils.js';

/**
 * Get normalized project root path
 * @param {string|undefined} projectRootRaw - Raw project root from arguments
 * @param {Object} log - Logger object
 * @returns {string} - Normalized absolute path to project root
 */
function getProjectRoot(projectRootRaw, log) {
	// PRECEDENCE ORDER:
	// 1. Environment variable override
	// 2. Explicitly provided projectRoot in args
	// 3. Previously found/cached project root
	// 4. Current directory if it has project markers
	// 5. Current directory with warning

	// 1. Check for environment variable override
	if (process.env.TASK_MASTER_PROJECT_ROOT) {
		const envRoot = process.env.TASK_MASTER_PROJECT_ROOT;
		const absolutePath = path.isAbsolute(envRoot)
			? envRoot
			: path.resolve(process.cwd(), envRoot);
		log.info(
			`Using project root from TASK_MASTER_PROJECT_ROOT environment variable: ${absolutePath}`
		);
		return absolutePath;
	}

	// 2. If project root is explicitly provided, use it
	if (projectRootRaw) {
		const absolutePath = path.isAbsolute(projectRootRaw)
			? projectRootRaw
			: path.resolve(process.cwd(), projectRootRaw);

		log.info(`Using explicitly provided project root: ${absolutePath}`);
		return absolutePath;
	}

	// 3. If we have a last found project root from a tasks.json search, use that for consistency
	if (lastFoundProjectRoot) {
		log.info(
			`Using last known project root where tasks.json was found: ${lastFoundProjectRoot}`
		);
		return lastFoundProjectRoot;
	}

	// 4. Check if the current directory has any indicators of being a task-master project
	const currentDir = process.cwd();
	if (
		PROJECT_MARKERS.some((marker) => {
			const markerPath = path.join(currentDir, marker);
			return fs.existsSync(markerPath);
		})
	) {
		log.info(
			`Using current directory as project root (found project markers): ${currentDir}`
		);
		return currentDir;
	}

	// 5. Default to current working directory but warn the user
	log.warn(
		`No task-master project detected in current directory. Using ${currentDir} as project root.`
	);
	log.warn(
		'Consider using --project-root to specify the correct project location or set TASK_MASTER_PROJECT_ROOT environment variable.'
	);
	return currentDir;
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
 * Handle API result with standardized error handling and response formatting
 * @param {Object} result - Result object from API call with success, data, and error properties
 * @param {Object} log - Logger object
 * @param {string} errorPrefix - Prefix for error messages
 * @param {Function} processFunction - Optional function to process successful result data
 * @returns {Object} - Standardized MCP response object
 */
function handleApiResult(
	result,
	log,
	errorPrefix = 'API error',
	processFunction = processMCPResponseData
) {
	if (!result.success) {
		const errorMsg = result.error?.message || `Unknown ${errorPrefix}`;
		// Include cache status in error logs
		log.error(`${errorPrefix}: ${errorMsg}. From cache: ${result.fromCache}`); // Keep logging cache status on error
		return createErrorResponse(errorMsg);
	}

	// Process the result data if needed
	const processedData = processFunction
		? processFunction(result.data)
		: result.data;

	// Log success including cache status
	log.info(`Successfully completed operation. From cache: ${result.fromCache}`); // Add success log with cache status

	// Create the response payload including the fromCache flag
	const responsePayload = {
		fromCache: result.fromCache, // Get the flag from the original 'result'
		data: processedData // Nest the processed data under a 'data' key
	};

	// Pass this combined payload to createContentResponse
	return createContentResponse(responsePayload);
}

/**
 * Executes a task-master CLI command synchronously.
 * @param {string} command - The command to execute (e.g., 'add-task')
 * @param {Object} log - Logger instance
 * @param {Array} args - Arguments for the command
 * @param {string|undefined} projectRootRaw - Optional raw project root path (will be normalized internally)
 * @param {Object|null} customEnv - Optional object containing environment variables to pass to the child process
 * @returns {Object} - The result of the command execution
 */
function executeTaskMasterCommand(
	command,
	log,
	args = [],
	projectRootRaw = null,
	customEnv = null // Changed from session to customEnv
) {
	try {
		// Normalize project root internally using the getProjectRoot utility
		const cwd = getProjectRoot(projectRootRaw, log);

		log.info(
			`Executing task-master ${command} with args: ${JSON.stringify(
				args
			)} in directory: ${cwd}`
		);

		// Prepare full arguments array
		const fullArgs = [command, ...args];

		// Common options for spawn
		const spawnOptions = {
			encoding: 'utf8',
			cwd: cwd,
			// Merge process.env with customEnv, giving precedence to customEnv
			env: { ...process.env, ...(customEnv || {}) }
		};

		// Log the environment being passed (optional, for debugging)
		// log.info(`Spawn options env: ${JSON.stringify(spawnOptions.env)}`);

		// Execute the command using the global task-master CLI or local script
		// Try the global CLI first
		let result = spawnSync('task-master', fullArgs, spawnOptions);

		// If global CLI is not available, try fallback to the local script
		if (result.error && result.error.code === 'ENOENT') {
			log.info('Global task-master not found, falling back to local script');
			// Pass the same spawnOptions (including env) to the fallback
			result = spawnSync('node', ['scripts/dev.js', ...fullArgs], spawnOptions);
		}

		if (result.error) {
			throw new Error(`Command execution error: ${result.error.message}`);
		}

		if (result.status !== 0) {
			// Improve error handling by combining stderr and stdout if stderr is empty
			const errorOutput = result.stderr
				? result.stderr.trim()
				: result.stdout
					? result.stdout.trim()
					: 'Unknown error';
			throw new Error(
				`Command failed with exit code ${result.status}: ${errorOutput}`
			);
		}

		return {
			success: true,
			stdout: result.stdout,
			stderr: result.stderr
		};
	} catch (error) {
		log.error(`Error executing task-master command: ${error.message}`);
		return {
			success: false,
			error: error.message
		};
	}
}

/**
 * Checks cache for a result using the provided key. If not found, executes the action function,
 * caches the result upon success, and returns the result.
 *
 * @param {Object} options - Configuration options.
 * @param {string} options.cacheKey - The unique key for caching this operation's result.
 * @param {Function} options.actionFn - The async function to execute if the cache misses.
 *                                      Should return an object like { success: boolean, data?: any, error?: { code: string, message: string } }.
 * @param {Object} options.log - The logger instance.
 * @returns {Promise<Object>} - An object containing the result, indicating if it was from cache.
 *                              Format: { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }
 */
async function getCachedOrExecute({ cacheKey, actionFn, log }) {
	// Check cache first
	const cachedResult = contextManager.getCachedData(cacheKey);

	if (cachedResult !== undefined) {
		log.info(`Cache hit for key: ${cacheKey}`);
		// Return the cached data in the same structure as a fresh result
		return {
			...cachedResult, // Spread the cached result to maintain its structure
			fromCache: true // Just add the fromCache flag
		};
	}

	log.info(`Cache miss for key: ${cacheKey}. Executing action function.`);

	// Execute the action function if cache missed
	const result = await actionFn();

	// If the action was successful, cache the result (but without fromCache flag)
	if (result.success && result.data !== undefined) {
		log.info(`Action successful. Caching result for key: ${cacheKey}`);
		// Cache the entire result structure (minus the fromCache flag)
		const { fromCache, ...resultToCache } = result;
		contextManager.setCachedData(cacheKey, resultToCache);
	} else if (!result.success) {
		log.warn(
			`Action failed for cache key ${cacheKey}. Result not cached. Error: ${result.error?.message}`
		);
	} else {
		log.warn(
			`Action for cache key ${cacheKey} succeeded but returned no data. Result not cached.`
		);
	}

	// Return the fresh result, indicating it wasn't from cache
	return {
		...result,
		fromCache: false
	};
}

/**
 * Recursively removes specified fields from task objects, whether single or in an array.
 * Handles common data structures returned by task commands.
 * @param {Object|Array} taskOrData - A single task object or a data object containing a 'tasks' array.
 * @param {string[]} fieldsToRemove - An array of field names to remove.
 * @returns {Object|Array} - The processed data with specified fields removed.
 */
function processMCPResponseData(
	taskOrData,
	fieldsToRemove = ['details', 'testStrategy']
) {
	if (!taskOrData) {
		return taskOrData;
	}

	// Helper function to process a single task object
	const processSingleTask = (task) => {
		if (typeof task !== 'object' || task === null) {
			return task;
		}

		const processedTask = { ...task };

		// Remove specified fields from the task
		fieldsToRemove.forEach((field) => {
			delete processedTask[field];
		});

		// Recursively process subtasks if they exist and are an array
		if (processedTask.subtasks && Array.isArray(processedTask.subtasks)) {
			// Use processArrayOfTasks to handle the subtasks array
			processedTask.subtasks = processArrayOfTasks(processedTask.subtasks);
		}

		return processedTask;
	};

	// Helper function to process an array of tasks
	const processArrayOfTasks = (tasks) => {
		return tasks.map(processSingleTask);
	};

	// Check if the input is a data structure containing a 'tasks' array (like from listTasks)
	if (
		typeof taskOrData === 'object' &&
		taskOrData !== null &&
		Array.isArray(taskOrData.tasks)
	) {
		return {
			...taskOrData, // Keep other potential fields like 'stats', 'filter'
			tasks: processArrayOfTasks(taskOrData.tasks)
		};
	}
	// Check if the input is likely a single task object (add more checks if needed)
	else if (
		typeof taskOrData === 'object' &&
		taskOrData !== null &&
		'id' in taskOrData &&
		'title' in taskOrData
	) {
		return processSingleTask(taskOrData);
	}
	// Check if the input is an array of tasks directly (less common but possible)
	else if (Array.isArray(taskOrData)) {
		return processArrayOfTasks(taskOrData);
	}

	// If it doesn't match known task structures, return it as is
	return taskOrData;
}

/**
 * Creates standard content response for tools
 * @param {string|Object} content - Content to include in response
 * @returns {Object} - Content response object in FastMCP format
 */
function createContentResponse(content) {
	// FastMCP requires text type, so we format objects as JSON strings
	return {
		content: [
			{
				type: 'text',
				text:
					typeof content === 'object'
						? // Format JSON nicely with indentation
							JSON.stringify(content, null, 2)
						: // Keep other content types as-is
							String(content)
			}
		]
	};
}

/**
 * Creates error response for tools
 * @param {string} errorMessage - Error message to include in response
 * @returns {Object} - Error content response object in FastMCP format
 */
function createErrorResponse(errorMessage) {
	return {
		content: [
			{
				type: 'text',
				text: `Error: ${errorMessage}`
			}
		],
		isError: true
	};
}

/**
 * Creates a logger wrapper object compatible with core function expectations.
 * Adapts the MCP logger to the { info, warn, error, debug, success } structure.
 * @param {Object} log - The MCP logger instance.
 * @returns {Object} - The logger wrapper object.
 */
function createLogWrapper(log) {
	return {
		info: (message, ...args) => log.info(message, ...args),
		warn: (message, ...args) => log.warn(message, ...args),
		error: (message, ...args) => log.error(message, ...args),
		// Handle optional debug method
		debug: (message, ...args) =>
			log.debug ? log.debug(message, ...args) : null,
		// Map success to info as a common fallback
		success: (message, ...args) => log.info(message, ...args)
	};
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
 * Extracts the raw project root path from the session (without normalization).
 * Used as a fallback within the HOF.
 * @param {Object} session - The MCP session object.
 * @param {Object} log - The MCP logger object.
 * @returns {string|null} The raw path string or null.
 */
function getRawProjectRootFromSession(session, log) {
	try {
		// Check primary location
		if (session?.roots?.[0]?.uri) {
			return session.roots[0].uri;
		}
		// Check alternate location
		else if (session?.roots?.roots?.[0]?.uri) {
			return session.roots.roots[0].uri;
		}
		return null; // Not found in expected session locations
	} catch (e) {
		log.error(`Error accessing session roots: ${e.message}`);
		return null;
	}
}

/**
 * Higher-order function to wrap MCP tool execute methods.
 * Ensures args.projectRoot is present and normalized before execution.
 * @param {Function} executeFn - The original async execute(args, context) function.
 * @returns {Function} The wrapped async execute function.
 */
function withNormalizedProjectRoot(executeFn) {
	return async (args, context) => {
		const { log, session } = context;
		let normalizedRoot = null;
		let rootSource = 'unknown';

		try {
			// Determine raw root: prioritize args, then session
			let rawRoot = args.projectRoot;
			if (!rawRoot) {
				rawRoot = getRawProjectRootFromSession(session, log);
				rootSource = 'session';
			} else {
				rootSource = 'args';
			}

			if (!rawRoot) {
				log.error('Could not determine project root from args or session.');
				return createErrorResponse(
					'Could not determine project root. Please provide projectRoot argument or ensure session contains root info.'
				);
			}

			// Normalize the determined raw root
			normalizedRoot = normalizeProjectRoot(rawRoot, log);

			if (!normalizedRoot) {
				log.error(
					`Failed to normalize project root obtained from ${rootSource}: ${rawRoot}`
				);
				return createErrorResponse(
					`Invalid project root provided or derived from ${rootSource}: ${rawRoot}`
				);
			}

			// Inject the normalized root back into args
			const updatedArgs = { ...args, projectRoot: normalizedRoot };

			// Execute the original function with normalized root in args
			return await executeFn(updatedArgs, context);
		} catch (error) {
			log.error(
				`Error within withNormalizedProjectRoot HOF (Normalized Root: ${normalizedRoot}): ${error.message}`
			);
			// Add stack trace if available and debug enabled
			if (error.stack && log.debug) {
				log.debug(error.stack);
			}
			// Return a generic error or re-throw depending on desired behavior
			return createErrorResponse(`Operation failed: ${error.message}`);
		}
	};
}

// Ensure all functions are exported
export {
	getProjectRoot,
	getProjectRootFromSession,
	handleApiResult,
	executeTaskMasterCommand,
	getCachedOrExecute,
	processMCPResponseData,
	createContentResponse,
	createErrorResponse,
	createLogWrapper,
	normalizeProjectRoot,
	getRawProjectRootFromSession,
	withNormalizedProjectRoot
};
