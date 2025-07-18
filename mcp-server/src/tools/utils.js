/**
 * tools/utils.js
 * Utility functions for Task Master CLI integration
 */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { contextManager } from '../core/context-manager.js'; // Import the singleton
import { fileURLToPath } from 'url';
import { getCurrentTag } from '../../../scripts/modules/utils.js';

// Import path utilities to ensure consistent path resolution
import {
	lastFoundProjectRoot,
	PROJECT_MARKERS
} from '../core/utils/path-utils.js';

const __filename = fileURLToPath(import.meta.url);

// Cache for version info to avoid repeated file reads
let cachedVersionInfo = null;

/**
 * Get version information from package.json
 * @returns {Object} Version information
 */
function getVersionInfo() {
	// Return cached version if available
	if (cachedVersionInfo) {
		return cachedVersionInfo;
	}

	try {
		// Navigate to the project root from the tools directory
		const packageJsonPath = path.join(
			path.dirname(__filename),
			'../../../package.json'
		);
		if (fs.existsSync(packageJsonPath)) {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
			cachedVersionInfo = {
				version: packageJson.version,
				name: packageJson.name
			};
			return cachedVersionInfo;
		}
		cachedVersionInfo = {
			version: 'unknown',
			name: 'task-master-ai'
		};
		return cachedVersionInfo;
	} catch (error) {
		// Fallback version info if package.json can't be read
		cachedVersionInfo = {
			version: 'unknown',
			name: 'task-master-ai'
		};
		return cachedVersionInfo;
	}
}

/**
 * Get current tag information for MCP responses
 * @param {string} projectRoot - The project root directory
 * @param {Object} log - Logger object
 * @returns {Object} Tag information object
 */
function getTagInfo(projectRoot, log) {
	try {
		if (!projectRoot) {
			log.warn('No project root provided for tag information');
			return { currentTag: 'master', availableTags: ['master'] };
		}

		const currentTag = getCurrentTag(projectRoot);

		// Read available tags from tasks.json
		let availableTags = ['master']; // Default fallback
		try {
			const tasksJsonPath = path.join(
				projectRoot,
				'.taskmaster',
				'tasks',
				'tasks.json'
			);
			if (fs.existsSync(tasksJsonPath)) {
				const tasksData = JSON.parse(fs.readFileSync(tasksJsonPath, 'utf-8'));

				// If it's the new tagged format, extract tag keys
				if (
					tasksData &&
					typeof tasksData === 'object' &&
					!Array.isArray(tasksData.tasks)
				) {
					const tagKeys = Object.keys(tasksData).filter(
						(key) =>
							tasksData[key] &&
							typeof tasksData[key] === 'object' &&
							Array.isArray(tasksData[key].tasks)
					);
					if (tagKeys.length > 0) {
						availableTags = tagKeys;
					}
				}
			}
		} catch (tagError) {
			log.debug(`Could not read available tags: ${tagError.message}`);
		}

		return {
			currentTag: currentTag || 'master',
			availableTags: availableTags
		};
	} catch (error) {
		log.warn(`Error getting tag information: ${error.message}`);
		return { currentTag: 'master', availableTags: ['master'] };
	}
}

/**
 * Handle API result with standardized error handling and response formatting
 * @param {Object} result - Result object from API call with success, data, and error properties
 * @param {Object} log - Logger object
 * @param {string} errorPrefix - Prefix for error messages
 * @param {Function} processFunction - Optional function to process successful result data
 * @param {string} [projectRoot] - Optional project root for tag information
 * @returns {Object} - Standardized MCP response object
 */
async function handleApiResult(
	result,
	log,
	errorPrefix = 'API error',
	processFunction = processMCPResponseData,
	projectRoot = null
) {
	// Get version info for every response
	const versionInfo = getVersionInfo();

	// Get tag info if project root is provided
	const tagInfo = projectRoot ? getTagInfo(projectRoot, log) : null;

	if (!result.success) {
		const errorMsg = result.error?.message || `Unknown ${errorPrefix}`;
		log.error(`${errorPrefix}: ${errorMsg}`);
		return createErrorResponse(errorMsg, versionInfo, tagInfo);
	}

	// Process the result data if needed
	const processedData = processFunction
		? processFunction(result.data)
		: result.data;

	log.info('Successfully completed operation');

	// Create the response payload including version info and tag info
	const responsePayload = {
		data: processedData,
		version: versionInfo
	};

	// Add tag information if available
	if (tagInfo) {
		responsePayload.tag = tagInfo;
	}

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
 * @returns {Promise<Object>} - An object containing the result.
 *                              Format: { success: boolean, data?: any, error?: { code: string, message: string } }
 */
async function getCachedOrExecute({ cacheKey, actionFn, log }) {
	// Check cache first
	const cachedResult = contextManager.getCachedData(cacheKey);

	if (cachedResult !== undefined) {
		log.info(`Cache hit for key: ${cacheKey}`);
		return cachedResult;
	}

	log.info(`Cache miss for key: ${cacheKey}. Executing action function.`);

	// Execute the action function if cache missed
	const result = await actionFn();

	// If the action was successful, cache the result
	if (result.success && result.data !== undefined) {
		log.info(`Action successful. Caching result for key: ${cacheKey}`);
		contextManager.setCachedData(cacheKey, result);
	} else if (!result.success) {
		log.warn(
			`Action failed for cache key ${cacheKey}. Result not cached. Error: ${result.error?.message}`
		);
	} else {
		log.warn(
			`Action for cache key ${cacheKey} succeeded but returned no data. Result not cached.`
		);
	}

	return result;
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
 * @param {Object} [versionInfo] - Optional version information object
 * @param {Object} [tagInfo] - Optional tag information object
 * @returns {Object} - Error content response object in FastMCP format
 */
function createErrorResponse(errorMessage, versionInfo, tagInfo) {
	// Provide fallback version info if not provided
	if (!versionInfo) {
		versionInfo = getVersionInfo();
	}

	let responseText = `Error: ${errorMessage}
Version: ${versionInfo.version}
Name: ${versionInfo.name}`;

	// Add tag information if available
	if (tagInfo) {
		responseText += `
Current Tag: ${tagInfo.currentTag}`;
	}

	return {
		content: [
			{
				type: 'text',
				text: responseText
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

// Ensure all functions are exported
export {
	getTagInfo,
	handleApiResult,
	executeTaskMasterCommand,
	getCachedOrExecute,
	processMCPResponseData,
	createContentResponse,
	createErrorResponse,
	createLogWrapper
};
