/**
 * utils.js
 * Utility functions for the Task Master CLI
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Global silent mode flag
let silentMode = false;

// Configuration and constants
const CONFIG = {
	model: process.env.MODEL || 'claude-3-7-sonnet-20250219',
	maxTokens: parseInt(process.env.MAX_TOKENS || '4000'),
	temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
	debug: process.env.DEBUG === 'true',
	logLevel: process.env.LOG_LEVEL || 'info',
	defaultSubtasks: parseInt(process.env.DEFAULT_SUBTASKS || '3'),
	defaultPriority: process.env.DEFAULT_PRIORITY || 'medium',
	projectName: process.env.PROJECT_NAME || 'Task Master',
	projectVersion: '1.5.0' // Hardcoded version - ALWAYS use this value, ignore environment variable
};

// Set up logging based on log level
const LOG_LEVELS = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	success: 1 // Treat success like info level
};

/**
 * Returns the task manager module
 * @returns {Promise<Object>} The task manager module object
 */
async function getTaskManager() {
	return import('./task-manager.js');
}

/**
 * Enable silent logging mode
 */
function enableSilentMode() {
	silentMode = true;
}

/**
 * Disable silent logging mode
 */
function disableSilentMode() {
	silentMode = false;
}

/**
 * Check if silent mode is enabled
 * @returns {boolean} True if silent mode is enabled
 */
function isSilentMode() {
	return silentMode;
}

/**
 * Logs a message at the specified level
 * @param {string} level - The log level (debug, info, warn, error)
 * @param  {...any} args - Arguments to log
 */
function log(level, ...args) {
	// Immediately return if silentMode is enabled
	if (isSilentMode()) {
		return;
	}

	// Use text prefixes instead of emojis
	const prefixes = {
		debug: chalk.gray('[DEBUG]'),
		info: chalk.blue('[INFO]'),
		warn: chalk.yellow('[WARN]'),
		error: chalk.red('[ERROR]'),
		success: chalk.green('[SUCCESS]')
	};

	// Ensure level exists, default to info if not
	const currentLevel = LOG_LEVELS.hasOwnProperty(level) ? level : 'info';
	const configLevel = CONFIG.logLevel || 'info'; // Ensure configLevel has a default

	// Check log level configuration
	if (
		LOG_LEVELS[currentLevel] >= (LOG_LEVELS[configLevel] ?? LOG_LEVELS.info)
	) {
		const prefix = prefixes[currentLevel] || '';
		// Use console.log for all levels, let chalk handle coloring
		// Construct the message properly
		const message = args
			.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
			.join(' ');
		console.log(`${prefix} ${message}`);
	}
}

/**
 * Reads and parses a JSON file
 * @param {string} filepath - Path to the JSON file
 * @returns {Object|null} Parsed JSON data or null if error occurs
 */
function readJSON(filepath) {
	try {
		const rawData = fs.readFileSync(filepath, 'utf8');
		return JSON.parse(rawData);
	} catch (error) {
		log('error', `Error reading JSON file ${filepath}:`, error.message);
		if (CONFIG.debug) {
			// Use log utility for debug output too
			log('error', 'Full error details:', error);
		}
		return null;
	}
}

/**
 * Writes data to a JSON file
 * @param {string} filepath - Path to the JSON file
 * @param {Object} data - Data to write
 */
function writeJSON(filepath, data) {
	try {
		const dir = path.dirname(filepath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
	} catch (error) {
		log('error', `Error writing JSON file ${filepath}:`, error.message);
		if (CONFIG.debug) {
			// Use log utility for debug output too
			log('error', 'Full error details:', error);
		}
	}
}

/**
 * Sanitizes a prompt string for use in a shell command
 * @param {string} prompt The prompt to sanitize
 * @returns {string} Sanitized prompt
 */
function sanitizePrompt(prompt) {
	// Replace double quotes with escaped double quotes
	return prompt.replace(/"/g, '\\"');
}

/**
 * Reads and parses the complexity report if it exists
 * @param {string} customPath - Optional custom path to the report
 * @returns {Object|null} The parsed complexity report or null if not found
 */
function readComplexityReport(customPath = null) {
	try {
		const reportPath =
			customPath ||
			path.join(process.cwd(), 'scripts', 'task-complexity-report.json');
		if (!fs.existsSync(reportPath)) {
			return null;
		}

		const reportData = fs.readFileSync(reportPath, 'utf8');
		return JSON.parse(reportData);
	} catch (error) {
		log('warn', `Could not read complexity report: ${error.message}`);
		return null;
	}
}

/**
 * Finds a task analysis in the complexity report
 * @param {Object} report - The complexity report
 * @param {number} taskId - The task ID to find
 * @returns {Object|null} The task analysis or null if not found
 */
function findTaskInComplexityReport(report, taskId) {
	if (
		!report ||
		!report.complexityAnalysis ||
		!Array.isArray(report.complexityAnalysis)
	) {
		return null;
	}

	return report.complexityAnalysis.find((task) => task.taskId === taskId);
}

/**
 * Checks if a task exists in the tasks array
 * @param {Array} tasks - The tasks array
 * @param {string|number} taskId - The task ID to check
 * @returns {boolean} True if the task exists, false otherwise
 */
function taskExists(tasks, taskId) {
	if (!taskId || !tasks || !Array.isArray(tasks)) {
		return false;
	}

	// Handle both regular task IDs and subtask IDs (e.g., "1.2")
	if (typeof taskId === 'string' && taskId.includes('.')) {
		const [parentId, subtaskId] = taskId
			.split('.')
			.map((id) => parseInt(id, 10));
		const parentTask = tasks.find((t) => t.id === parentId);

		if (!parentTask || !parentTask.subtasks) {
			return false;
		}

		return parentTask.subtasks.some((st) => st.id === subtaskId);
	}

	const id = parseInt(taskId, 10);
	return tasks.some((t) => t.id === id);
}

/**
 * Formats a task ID as a string
 * @param {string|number} id - The task ID to format
 * @returns {string} The formatted task ID
 */
function formatTaskId(id) {
	if (typeof id === 'string' && id.includes('.')) {
		return id; // Already formatted as a string with a dot (e.g., "1.2")
	}

	if (typeof id === 'number') {
		return id.toString();
	}

	return id;
}

/**
 * Finds a task by ID in the tasks array
 * @param {Array} tasks - The tasks array
 * @param {string|number} taskId - The task ID to find
 * @returns {Object|null} The task object or null if not found
 */
function findTaskById(tasks, taskId) {
	if (!taskId || !tasks || !Array.isArray(tasks)) {
		return null;
	}

	// Check if it's a subtask ID (e.g., "1.2")
	if (typeof taskId === 'string' && taskId.includes('.')) {
		const [parentId, subtaskId] = taskId
			.split('.')
			.map((id) => parseInt(id, 10));
		const parentTask = tasks.find((t) => t.id === parentId);

		if (!parentTask || !parentTask.subtasks) {
			return null;
		}

		const subtask = parentTask.subtasks.find((st) => st.id === subtaskId);
		if (subtask) {
			// Add reference to parent task for context
			subtask.parentTask = {
				id: parentTask.id,
				title: parentTask.title,
				status: parentTask.status
			};
			subtask.isSubtask = true;
		}

		return subtask || null;
	}

	const id = parseInt(taskId, 10);
	return tasks.find((t) => t.id === id) || null;
}

/**
 * Truncates text to a specified length
 * @param {string} text - The text to truncate
 * @param {number} maxLength - The maximum length
 * @returns {string} The truncated text
 */
function truncate(text, maxLength) {
	if (!text || text.length <= maxLength) {
		return text;
	}

	return text.slice(0, maxLength - 3) + '...';
}

/**
 * Find cycles in a dependency graph using DFS
 * @param {string} subtaskId - Current subtask ID
 * @param {Map} dependencyMap - Map of subtask IDs to their dependencies
 * @param {Set} visited - Set of visited nodes
 * @param {Set} recursionStack - Set of nodes in current recursion stack
 * @returns {Array} - List of dependency edges that need to be removed to break cycles
 */
function findCycles(
	subtaskId,
	dependencyMap,
	visited = new Set(),
	recursionStack = new Set(),
	path = []
) {
	// Mark the current node as visited and part of recursion stack
	visited.add(subtaskId);
	recursionStack.add(subtaskId);
	path.push(subtaskId);

	const cyclesToBreak = [];

	// Get all dependencies of the current subtask
	const dependencies = dependencyMap.get(subtaskId) || [];

	// For each dependency
	for (const depId of dependencies) {
		// If not visited, recursively check for cycles
		if (!visited.has(depId)) {
			const cycles = findCycles(depId, dependencyMap, visited, recursionStack, [
				...path
			]);
			cyclesToBreak.push(...cycles);
		}
		// If the dependency is in the recursion stack, we found a cycle
		else if (recursionStack.has(depId)) {
			// Find the position of the dependency in the path
			const cycleStartIndex = path.indexOf(depId);
			// The last edge in the cycle is what we want to remove
			const cycleEdges = path.slice(cycleStartIndex);
			// We'll remove the last edge in the cycle (the one that points back)
			cyclesToBreak.push(depId);
		}
	}

	// Remove the node from recursion stack before returning
	recursionStack.delete(subtaskId);

	return cyclesToBreak;
}

/**
 * Convert a string from camelCase to kebab-case
 * @param {string} str - The string to convert
 * @returns {string} The kebab-case version of the string
 */
const toKebabCase = (str) => {
	// Special handling for common acronyms
	const withReplacedAcronyms = str
		.replace(/ID/g, 'Id')
		.replace(/API/g, 'Api')
		.replace(/UI/g, 'Ui')
		.replace(/URL/g, 'Url')
		.replace(/URI/g, 'Uri')
		.replace(/JSON/g, 'Json')
		.replace(/XML/g, 'Xml')
		.replace(/HTML/g, 'Html')
		.replace(/CSS/g, 'Css');

	// Insert hyphens before capital letters and convert to lowercase
	return withReplacedAcronyms
		.replace(/([A-Z])/g, '-$1')
		.toLowerCase()
		.replace(/^-/, ''); // Remove leading hyphen if present
};

/**
 * Detect camelCase flags in command arguments
 * @param {string[]} args - Command line arguments to check
 * @returns {Array<{original: string, kebabCase: string}>} - List of flags that should be converted
 */
function detectCamelCaseFlags(args) {
	const camelCaseFlags = [];
	for (const arg of args) {
		if (arg.startsWith('--')) {
			const flagName = arg.split('=')[0].slice(2); // Remove -- and anything after =

			// Skip single-word flags - they can't be camelCase
			if (!flagName.includes('-') && !/[A-Z]/.test(flagName)) {
				continue;
			}

			// Check for camelCase pattern (lowercase followed by uppercase)
			if (/[a-z][A-Z]/.test(flagName)) {
				const kebabVersion = toKebabCase(flagName);
				if (kebabVersion !== flagName) {
					camelCaseFlags.push({
						original: flagName,
						kebabCase: kebabVersion
					});
				}
			}
		}
	}
	return camelCaseFlags;
}

// Export all utility functions and configuration
export {
	CONFIG,
	LOG_LEVELS,
	log,
	readJSON,
	writeJSON,
	sanitizePrompt,
	readComplexityReport,
	findTaskInComplexityReport,
	taskExists,
	formatTaskId,
	findTaskById,
	truncate,
	findCycles,
	toKebabCase,
	detectCamelCaseFlags,
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	getTaskManager
};
