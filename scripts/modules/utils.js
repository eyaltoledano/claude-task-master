/**
 * utils.js
 * Utility functions for the Task Master CLI
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';
// Import specific config getters needed here
import { getLogLevel, getDebugFlag } from './config-manager.js';
import * as gitUtils from './utils/git-utils.js';
import {
	COMPLEXITY_REPORT_FILE,
	LEGACY_COMPLEXITY_REPORT_FILE,
	LEGACY_CONFIG_FILE
} from '../../src/constants/paths.js';

// Global silent mode flag
let silentMode = false;

// --- Environment Variable Resolution Utility ---
/**
 * Resolves an environment variable's value.
 * Precedence:
 * 1. session.env (if session provided)
 * 2. process.env
 * 3. .env file at projectRoot (if projectRoot provided)
 * @param {string} key - The environment variable key.
 * @param {object|null} [session=null] - The MCP session object.
 * @param {string|null} [projectRoot=null] - The project root directory (for .env fallback).
 * @returns {string|undefined} The value of the environment variable or undefined if not found.
 */
function resolveEnvVariable(key, session = null, projectRoot = null) {
	// 1. Check session.env
	if (session?.env?.[key]) {
		return session.env[key];
	}

	// 2. Read .env file at projectRoot
	if (projectRoot) {
		const envPath = path.join(projectRoot, '.env');
		if (fs.existsSync(envPath)) {
			try {
				const envFileContent = fs.readFileSync(envPath, 'utf-8');
				const parsedEnv = dotenv.parse(envFileContent); // Use dotenv to parse
				if (parsedEnv && parsedEnv[key]) {
					// console.log(`DEBUG: Found key ${key} in ${envPath}`); // Optional debug log
					return parsedEnv[key];
				}
			} catch (error) {
				// Log error but don't crash, just proceed as if key wasn't found in file
				log('warn', `Could not read or parse ${envPath}: ${error.message}`);
			}
		}
	}

	// 3. Fallback: Check process.env
	if (process.env[key]) {
		return process.env[key];
	}

	// Not found anywhere
	return undefined;
}

// --- Project Root Finding Utility ---
/**
 * Recursively searches upwards for project root starting from a given directory.
 * @param {string} [startDir=process.cwd()] - The directory to start searching from.
 * @param {string[]} [markers=['package.json', '.git', LEGACY_CONFIG_FILE]] - Marker files/dirs to look for.
 * @returns {string|null} The path to the project root, or null if not found.
 */
function findProjectRoot(
	startDir = process.cwd(),
	markers = ['package.json', '.git', LEGACY_CONFIG_FILE]
) {
	let currentPath = path.resolve(startDir);
	const rootPath = path.parse(currentPath).root;

	while (currentPath !== rootPath) {
		// Check if any marker exists in the current directory
		const hasMarker = markers.some((marker) => {
			const markerPath = path.join(currentPath, marker);
			return fs.existsSync(markerPath);
		});

		if (hasMarker) {
			return currentPath;
		}

		// Move up one directory
		currentPath = path.dirname(currentPath);
	}

	// Check the root directory as well
	const hasMarkerInRoot = markers.some((marker) => {
		const markerPath = path.join(rootPath, marker);
		return fs.existsSync(markerPath);
	});

	return hasMarkerInRoot ? rootPath : null;
}

// --- Dynamic Configuration Function --- (REMOVED)

// --- Logging and Utility Functions ---

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

	// GUARD: Prevent circular dependency during config loading
	// Use a simple fallback log level instead of calling getLogLevel()
	let configLevel = 'info'; // Default fallback
	try {
		// Only try to get config level if we're not in the middle of config loading
		configLevel = getLogLevel() || 'info';
	} catch (error) {
		// If getLogLevel() fails (likely due to circular dependency),
		// use default 'info' level and continue
		configLevel = 'info';
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
 * Checks if the data object has a tagged structure (contains tag objects with tasks arrays)
 * @param {Object} data - The data object to check
 * @returns {boolean} True if the data has a tagged structure
 */
function hasTaggedStructure(data) {
	if (!data || typeof data !== 'object') {
		return false;
	}

	// Check if any top-level properties are objects with tasks arrays
	for (const key in data) {
		if (
			data.hasOwnProperty(key) &&
			typeof data[key] === 'object' &&
			Array.isArray(data[key].tasks)
		) {
			return true;
		}
	}
	return false;
}

/**
 * Reads and parses a JSON file
 * @param {string} filepath - Path to the JSON file
 * @param {string} [projectRoot] - Optional project root for tag resolution (used by MCP)
 * @param {string} [tag] - Optional tag to use instead of current tag resolution
 * @returns {Object|null} The parsed JSON data or null if error
 */
function readJSON(filepath, projectRoot = null, tag = null) {
	// GUARD: Prevent circular dependency during config loading
	let isDebug = false; // Default fallback
	try {
		// Only try to get debug flag if we're not in the middle of config loading
		isDebug = getDebugFlag();
	} catch (error) {
		// If getDebugFlag() fails (likely due to circular dependency),
		// use default false and continue
	}

	if (isDebug) {
		console.log(
			`readJSON called with: ${filepath}, projectRoot: ${projectRoot}, tag: ${tag}`
		);
	}

	if (!filepath) {
		return null;
	}

	let data;
	try {
		data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
		if (isDebug) {
			console.log(`Successfully read JSON from ${filepath}`);
		}
	} catch (err) {
		if (isDebug) {
			console.log(`Failed to read JSON from ${filepath}: ${err.message}`);
		}
		return null;
	}

	// If it's not a tasks.json file, return as-is
	if (!filepath.includes('tasks.json') || !data) {
		if (isDebug) {
			console.log(`File is not tasks.json or data is null, returning as-is`);
		}
		return data;
	}

	// Check if this is legacy format that needs migration
	// Only migrate if we have tasks at the ROOT level AND no tag-like structure
	if (
		Array.isArray(data.tasks) &&
		!data._rawTaggedData &&
		!hasTaggedStructure(data)
	) {
		if (isDebug) {
			console.log(`File is in legacy format, performing migration...`);
		}

		// This is legacy format - migrate it to tagged format
		const migratedData = {
			master: {
				tasks: data.tasks,
				metadata: data.metadata || {
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					description: 'Tasks for master context'
				}
			}
		};

		// Write the migrated data back to the file
		try {
			writeJSON(filepath, migratedData);
			if (isDebug) {
				console.log(`Successfully migrated legacy format to tagged format`);
			}

			// Perform complete migration (config.json, state.json)
			performCompleteTagMigration(filepath);

			// Check and auto-switch git tags if enabled (after migration)
			// This needs to run synchronously BEFORE tag resolution
			if (projectRoot) {
				try {
					// Run git integration synchronously
					gitUtils.checkAndAutoSwitchGitTagSync(projectRoot, filepath);
				} catch (error) {
					// Silent fail - don't break normal operations
				}
			}

			// Mark for migration notice
			markMigrationForNotice(filepath);
		} catch (writeError) {
			if (isDebug) {
				console.log(`Error writing migrated data: ${writeError.message}`);
			}
			// If write fails, continue with the original data
		}

		// Continue processing with the migrated data structure
		data = migratedData;
	}

	// If we have tagged data, we need to resolve which tag to use
	if (typeof data === 'object' && !data.tasks) {
		// This is tagged format
		if (isDebug) {
			console.log(`File is in tagged format, resolving tag...`);
		}

		// Ensure all tags have proper metadata before proceeding
		for (const tagName in data) {
			if (
				data.hasOwnProperty(tagName) &&
				typeof data[tagName] === 'object' &&
				data[tagName].tasks
			) {
				try {
					ensureTagMetadata(data[tagName], {
						description: `Tasks for ${tagName} context`,
						skipUpdate: true // Don't update timestamp during read operations
					});
				} catch (error) {
					// If ensureTagMetadata fails, continue without metadata
					if (isDebug) {
						console.log(
							`Failed to ensure metadata for tag ${tagName}: ${error.message}`
						);
					}
				}
			}
		}

		// Store reference to the raw tagged data for functions that need it
		const originalTaggedData = JSON.parse(JSON.stringify(data));

		// Check and auto-switch git tags if enabled (for existing tagged format)
		// This needs to run synchronously BEFORE tag resolution
		if (projectRoot) {
			try {
				// Run git integration synchronously
				gitUtils.checkAndAutoSwitchGitTagSync(projectRoot, filepath);
			} catch (error) {
				// Silent fail - don't break normal operations
			}
		}

		try {
			// Default to master tag if anything goes wrong
			let resolvedTag = 'master';

			// Try to resolve the correct tag, but don't fail if it doesn't work
			try {
				// If tag is provided, use it directly
				if (tag) {
					resolvedTag = tag;
				} else if (projectRoot) {
					// Use provided projectRoot
					resolvedTag = resolveTag({ projectRoot });
				} else {
					// Try to derive projectRoot from filepath
					const derivedProjectRoot = findProjectRoot(path.dirname(filepath));
					if (derivedProjectRoot) {
						resolvedTag = resolveTag({ projectRoot: derivedProjectRoot });
					}
					// If derivedProjectRoot is null, stick with 'master'
				}
			} catch (tagResolveError) {
				if (isDebug) {
					console.log(
						`Tag resolution failed, using master: ${tagResolveError.message}`
					);
				}
				// resolvedTag stays as 'master'
			}

			if (isDebug) {
				console.log(`Resolved tag: ${resolvedTag}`);
			}

			// Get the data for the resolved tag
			const tagData = data[resolvedTag];
			if (tagData && tagData.tasks) {
				// Add the _rawTaggedData property and the resolved tag to the returned data
				const result = {
					...tagData,
					tag: resolvedTag,
					_rawTaggedData: originalTaggedData
				};
				if (isDebug) {
					console.log(
						`Returning data for tag '${resolvedTag}' with ${tagData.tasks.length} tasks`
					);
				}
				return result;
			} else {
				// If the resolved tag doesn't exist, fall back to master
				const masterData = data.master;
				if (masterData && masterData.tasks) {
					if (isDebug) {
						console.log(
							`Tag '${resolvedTag}' not found, falling back to master with ${masterData.tasks.length} tasks`
						);
					}
					return {
						...masterData,
						tag: 'master',
						_rawTaggedData: originalTaggedData
					};
				} else {
					if (isDebug) {
						console.log(`No valid tag data found, returning empty structure`);
					}
					// Return empty structure if no valid data
					return {
						tasks: [],
						tag: 'master',
						_rawTaggedData: originalTaggedData
					};
				}
			}
		} catch (error) {
			if (isDebug) {
				console.log(`Error during tag resolution: ${error.message}`);
			}
			// If anything goes wrong, try to return master or empty
			const masterData = data.master;
			if (masterData && masterData.tasks) {
				return {
					...masterData,
					_rawTaggedData: originalTaggedData
				};
			}
			return {
				tasks: [],
				_rawTaggedData: originalTaggedData
			};
		}
	}

	// If we reach here, it's some other format
	if (isDebug) {
		console.log(`File format not recognized, returning as-is`);
	}
	return data;
}

/**
 * Performs complete tag migration including config.json and state.json updates
 * @param {string} tasksJsonPath - Path to the tasks.json file that was migrated
 */
function performCompleteTagMigration(tasksJsonPath) {
	try {
		// Derive project root from tasks.json path
		const projectRoot =
			findProjectRoot(path.dirname(tasksJsonPath)) ||
			path.dirname(tasksJsonPath);

		// 1. Migrate config.json - add defaultTag and tags section
		const configPath = path.join(projectRoot, '.taskmaster', 'config.json');
		if (fs.existsSync(configPath)) {
			migrateConfigJson(configPath);
		}

		// 2. Create state.json if it doesn't exist
		const statePath = path.join(projectRoot, '.taskmaster', 'state.json');
		if (!fs.existsSync(statePath)) {
			createStateJson(statePath);
		}

		if (getDebugFlag()) {
			log(
				'debug',
				`Complete tag migration performed for project: ${projectRoot}`
			);
		}
	} catch (error) {
		if (getDebugFlag()) {
			log('warn', `Error during complete tag migration: ${error.message}`);
		}
	}
}

/**
 * Migrates config.json to add tagged task system configuration
 * @param {string} configPath - Path to the config.json file
 */
function migrateConfigJson(configPath) {
	try {
		const rawConfig = fs.readFileSync(configPath, 'utf8');
		const config = JSON.parse(rawConfig);
		if (!config) return;

		let modified = false;

		// Add global.defaultTag if missing
		if (!config.global) {
			config.global = {};
		}
		if (!config.global.defaultTag) {
			config.global.defaultTag = 'master';
			modified = true;
		}

		if (modified) {
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
			if (process.env.TASKMASTER_DEBUG === 'true') {
				console.log(
					'[DEBUG] Updated config.json with tagged task system settings'
				);
			}
		}
	} catch (error) {
		if (process.env.TASKMASTER_DEBUG === 'true') {
			console.warn(`[WARN] Error migrating config.json: ${error.message}`);
		}
	}
}

/**
 * Creates initial state.json file for tagged task system
 * @param {string} statePath - Path where state.json should be created
 */
function createStateJson(statePath) {
	try {
		const initialState = {
			currentTag: 'master',
			lastSwitched: new Date().toISOString(),
			branchTagMapping: {},
			migrationNoticeShown: false
		};

		fs.writeFileSync(statePath, JSON.stringify(initialState, null, 2), 'utf8');
		if (process.env.TASKMASTER_DEBUG === 'true') {
			console.log('[DEBUG] Created initial state.json for tagged task system');
		}
	} catch (error) {
		if (process.env.TASKMASTER_DEBUG === 'true') {
			console.warn(`[WARN] Error creating state.json: ${error.message}`);
		}
	}
}

/**
 * Marks in state.json that migration occurred and notice should be shown
 * @param {string} tasksJsonPath - Path to the tasks.json file
 */
function markMigrationForNotice(tasksJsonPath) {
	try {
		const projectRoot = path.dirname(path.dirname(tasksJsonPath));
		const statePath = path.join(projectRoot, '.taskmaster', 'state.json');

		// Ensure state.json exists
		if (!fs.existsSync(statePath)) {
			createStateJson(statePath);
		}

		// Read and update state to mark migration occurred using fs directly
		try {
			const rawState = fs.readFileSync(statePath, 'utf8');
			const stateData = JSON.parse(rawState) || {};
			// Only set to false if it's not already set (i.e., first time migration)
			if (stateData.migrationNoticeShown === undefined) {
				stateData.migrationNoticeShown = false;
				fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2), 'utf8');
			}
		} catch (stateError) {
			if (process.env.TASKMASTER_DEBUG === 'true') {
				console.warn(
					`[WARN] Error updating state for migration notice: ${stateError.message}`
				);
			}
		}
	} catch (error) {
		if (process.env.TASKMASTER_DEBUG === 'true') {
			console.warn(
				`[WARN] Error marking migration for notice: ${error.message}`
			);
		}
	}
}

/**
 * Writes and saves a JSON file. Handles tagged task lists properly.
 * @param {string} filepath - Path to the JSON file
 * @param {Object} data - Data to write (can be resolved tag data or raw tagged data)
 * @param {string} projectRoot - Optional project root for tag context
 * @param {string} tag - Optional tag for tag context
 */
function writeJSON(filepath, data, projectRoot = null, tag = null) {
	const isDebug = process.env.TASKMASTER_DEBUG === 'true';

	try {
		let finalData = data;

		// If data represents resolved tag data but lost _rawTaggedData (edge-case observed in MCP path)
		if (
			!data._rawTaggedData &&
			projectRoot &&
			Array.isArray(data.tasks) &&
			!hasTaggedStructure(data)
		) {
			const resolvedTag = tag || getCurrentTag(projectRoot);

			if (isDebug) {
				console.log(
					`writeJSON: Detected resolved tag data missing _rawTaggedData. Re-reading raw data to prevent data loss for tag '${resolvedTag}'.`
				);
			}

			// Re-read the full file to get the complete tagged structure
			const rawFullData = JSON.parse(fs.readFileSync(filepath, 'utf8'));

			// Merge the updated data into the full structure
			finalData = {
				...rawFullData,
				[resolvedTag]: {
					// Preserve existing tag metadata if it exists, otherwise use what's passed
					...(rawFullData[resolvedTag]?.metadata || {}),
					...(data.metadata ? { metadata: data.metadata } : {}),
					tasks: data.tasks // The updated tasks array is the source of truth here
				}
			};
		}
		// If we have _rawTaggedData, this means we're working with resolved tag data
		// and need to merge it back into the full tagged structure
		else if (data && data._rawTaggedData && projectRoot) {
			const resolvedTag = tag || getCurrentTag(projectRoot);

			// Get the original tagged data
			const originalTaggedData = data._rawTaggedData;

			// Create a clean copy of the current resolved data (without internal properties)
			const { _rawTaggedData, tag: _, ...cleanResolvedData } = data;

			// Update the specific tag with the resolved data
			finalData = {
				...originalTaggedData,
				[resolvedTag]: cleanResolvedData
			};

			if (isDebug) {
				console.log(
					`writeJSON: Merging resolved data back into tag '${resolvedTag}'`
				);
			}
		}

		// Clean up any internal properties that shouldn't be persisted
		let cleanData = finalData;
		if (cleanData && typeof cleanData === 'object') {
			// Remove any _rawTaggedData or tag properties from root level
			const { _rawTaggedData, tag: tagProp, ...rootCleanData } = cleanData;
			cleanData = rootCleanData;

			// Additional cleanup for tag objects
			if (typeof cleanData === 'object' && !Array.isArray(cleanData)) {
				const finalCleanData = {};
				for (const [key, value] of Object.entries(cleanData)) {
					if (
						value &&
						typeof value === 'object' &&
						Array.isArray(value.tasks)
					) {
						// This is a tag object - clean up any rogue root-level properties
						const { created, description, ...cleanTagData } = value;

						// Only keep the description if there's no metadata.description
						if (
							description &&
							(!cleanTagData.metadata || !cleanTagData.metadata.description)
						) {
							cleanTagData.description = description;
						}

						finalCleanData[key] = cleanTagData;
					} else {
						finalCleanData[key] = value;
					}
				}
				cleanData = finalCleanData;
			}
		}

		fs.writeFileSync(filepath, JSON.stringify(cleanData, null, 2), 'utf8');

		if (isDebug) {
			console.log(`writeJSON: Successfully wrote to ${filepath}`);
		}
	} catch (error) {
		log('error', `Error writing JSON file ${filepath}:`, error.message);
		if (isDebug) {
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
 * Reads the complexity report from file
 * @param {string} customPath - Optional custom path to the report
 * @returns {Object|null} The parsed complexity report or null if not found
 */
function readComplexityReport(customPath = null) {
	// GUARD: Prevent circular dependency during config loading
	let isDebug = false; // Default fallback
	try {
		// Only try to get debug flag if we're not in the middle of config loading
		isDebug = getDebugFlag();
	} catch (error) {
		// If getDebugFlag() fails (likely due to circular dependency),
		// use default false and continue
		isDebug = false;
	}

	try {
		let reportPath;
		if (customPath) {
			reportPath = customPath;
		} else {
			// Try new location first, then fall back to legacy
			const newPath = path.join(process.cwd(), COMPLEXITY_REPORT_FILE);
			const legacyPath = path.join(
				process.cwd(),
				LEGACY_COMPLEXITY_REPORT_FILE
			);

			reportPath = fs.existsSync(newPath) ? newPath : legacyPath;
		}

		if (!fs.existsSync(reportPath)) {
			if (isDebug) {
				log('debug', `Complexity report not found at ${reportPath}`);
			}
			return null;
		}

		const reportData = readJSON(reportPath);
		if (isDebug) {
			log('debug', `Successfully read complexity report from ${reportPath}`);
		}
		return reportData;
	} catch (error) {
		if (isDebug) {
			log('error', `Error reading complexity report: ${error.message}`);
		}
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

function addComplexityToTask(task, complexityReport) {
	let taskId;
	if (task.isSubtask) {
		taskId = task.parentTask.id;
	} else if (task.parentId) {
		taskId = task.parentId;
	} else {
		taskId = task.id;
	}

	const taskAnalysis = findTaskInComplexityReport(complexityReport, taskId);
	if (taskAnalysis) {
		task.complexityScore = taskAnalysis.complexityScore;
	}
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
 * Finds a task by ID in the tasks array. Optionally filters subtasks by status.
 * @param {Array} tasks - The tasks array
 * @param {string|number} taskId - The task ID to find
 * @param {Object|null} complexityReport - Optional pre-loaded complexity report
 * @param {string} [statusFilter] - Optional status to filter subtasks by
 * @returns {{task: Object|null, originalSubtaskCount: number|null, originalSubtasks: Array|null}} The task object (potentially with filtered subtasks), the original subtask count, and original subtasks array if filtered, or nulls if not found.
 */
function findTaskById(
	tasks,
	taskId,
	complexityReport = null,
	statusFilter = null
) {
	if (!taskId || !tasks || !Array.isArray(tasks)) {
		return { task: null, originalSubtaskCount: null };
	}

	// Check if it's a subtask ID (e.g., "1.2")
	if (typeof taskId === 'string' && taskId.includes('.')) {
		// If looking for a subtask, statusFilter doesn't apply directly here.
		const [parentId, subtaskId] = taskId
			.split('.')
			.map((id) => parseInt(id, 10));
		const parentTask = tasks.find((t) => t.id === parentId);

		if (!parentTask || !parentTask.subtasks) {
			return { task: null, originalSubtaskCount: null, originalSubtasks: null };
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

		// If we found a task, check for complexity data
		if (subtask && complexityReport) {
			addComplexityToTask(subtask, complexityReport);
		}

		return {
			task: subtask || null,
			originalSubtaskCount: null,
			originalSubtasks: null
		};
	}

	let taskResult = null;
	let originalSubtaskCount = null;
	let originalSubtasks = null;

	// Find the main task
	const id = parseInt(taskId, 10);
	const task = tasks.find((t) => t.id === id) || null;

	// If task not found, return nulls
	if (!task) {
		return { task: null, originalSubtaskCount: null, originalSubtasks: null };
	}

	taskResult = task;

	// If task found and statusFilter provided, filter its subtasks
	if (statusFilter && task.subtasks && Array.isArray(task.subtasks)) {
		// Store original subtasks and count before filtering
		originalSubtasks = [...task.subtasks]; // Clone the original subtasks array
		originalSubtaskCount = task.subtasks.length;

		// Clone the task to avoid modifying the original array
		const filteredTask = { ...task };
		filteredTask.subtasks = task.subtasks.filter(
			(subtask) =>
				subtask.status &&
				subtask.status.toLowerCase() === statusFilter.toLowerCase()
		);

		taskResult = filteredTask;
	}

	// If task found and complexityReport provided, add complexity data
	if (taskResult && complexityReport) {
		addComplexityToTask(taskResult, complexityReport);
	}

	// Return the found task, original subtask count, and original subtasks
	return { task: taskResult, originalSubtaskCount, originalSubtasks };
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

	return `${text.slice(0, maxLength - 3)}...`;
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

/**
 * Aggregates an array of telemetry objects into a single summary object.
 * @param {Array<Object>} telemetryArray - Array of telemetryData objects.
 * @param {string} overallCommandName - The name for the aggregated command.
 * @returns {Object|null} Aggregated telemetry object or null if input is empty.
 */
function aggregateTelemetry(telemetryArray, overallCommandName) {
	if (!telemetryArray || telemetryArray.length === 0) {
		return null;
	}

	const aggregated = {
		timestamp: new Date().toISOString(), // Use current time for aggregation time
		userId: telemetryArray[0].userId, // Assume userId is consistent
		commandName: overallCommandName,
		modelUsed: 'Multiple', // Default if models vary
		providerName: 'Multiple', // Default if providers vary
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		totalCost: 0,
		currency: telemetryArray[0].currency || 'USD' // Assume consistent currency or default
	};

	const uniqueModels = new Set();
	const uniqueProviders = new Set();
	const uniqueCurrencies = new Set();

	telemetryArray.forEach((item) => {
		aggregated.inputTokens += item.inputTokens || 0;
		aggregated.outputTokens += item.outputTokens || 0;
		aggregated.totalCost += item.totalCost || 0;
		uniqueModels.add(item.modelUsed);
		uniqueProviders.add(item.providerName);
		uniqueCurrencies.add(item.currency || 'USD');
	});

	aggregated.totalTokens = aggregated.inputTokens + aggregated.outputTokens;
	aggregated.totalCost = parseFloat(aggregated.totalCost.toFixed(6)); // Fix precision

	if (uniqueModels.size === 1) {
		aggregated.modelUsed = [...uniqueModels][0];
	}
	if (uniqueProviders.size === 1) {
		aggregated.providerName = [...uniqueProviders][0];
	}
	if (uniqueCurrencies.size > 1) {
		aggregated.currency = 'Multiple'; // Mark if currencies actually differ
	} else if (uniqueCurrencies.size === 1) {
		aggregated.currency = [...uniqueCurrencies][0];
	}

	return aggregated;
}

/**
 * Gets the current tag from state.json or falls back to defaultTag from config
 * @param {string} projectRoot - The project root directory (required)
 * @returns {string} The current tag name
 */
function getCurrentTag(projectRoot) {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getCurrentTag');
	}

	try {
		// Try to read current tag from state.json using fs directly
		const statePath = path.join(projectRoot, '.taskmaster', 'state.json');
		if (fs.existsSync(statePath)) {
			const rawState = fs.readFileSync(statePath, 'utf8');
			const stateData = JSON.parse(rawState);
			if (stateData && stateData.currentTag) {
				return stateData.currentTag;
			}
		}
	} catch (error) {
		// Ignore errors, fall back to default
	}

	// Fall back to defaultTag from config using fs directly
	try {
		const configPath = path.join(projectRoot, '.taskmaster', 'config.json');
		if (fs.existsSync(configPath)) {
			const rawConfig = fs.readFileSync(configPath, 'utf8');
			const configData = JSON.parse(rawConfig);
			if (configData && configData.global && configData.global.defaultTag) {
				return configData.global.defaultTag;
			}
		}
	} catch (error) {
		// Ignore errors, use hardcoded default
	}

	// Final fallback
	return 'master';
}

/**
 * Resolves the tag to use based on options
 * @param {Object} options - Options object
 * @param {string} options.projectRoot - The project root directory (required)
 * @param {string} [options.tag] - Explicit tag to use
 * @returns {string} The resolved tag name
 */
function resolveTag(options = {}) {
	const { projectRoot, tag } = options;

	if (!projectRoot) {
		throw new Error('projectRoot is required for resolveTag');
	}

	// If explicit tag provided, use it
	if (tag) {
		return tag;
	}

	// Otherwise get current tag from state/config
	return getCurrentTag(projectRoot);
}

/**
 * Gets the tasks array for a specific tag from tagged tasks.json data
 * @param {Object} data - The parsed tasks.json data (after migration)
 * @param {string} tagName - The tag name to get tasks for
 * @returns {Array} The tasks array for the specified tag, or empty array if not found
 */
function getTasksForTag(data, tagName) {
	if (!data || !tagName) {
		return [];
	}

	// Handle migrated format: { "master": { "tasks": [...] }, "otherTag": { "tasks": [...] } }
	if (
		data[tagName] &&
		data[tagName].tasks &&
		Array.isArray(data[tagName].tasks)
	) {
		return data[tagName].tasks;
	}

	return [];
}

/**
 * Sets the tasks array for a specific tag in the data structure
 * @param {Object} data - The tasks.json data object
 * @param {string} tagName - The tag name to set tasks for
 * @param {Array} tasks - The tasks array to set
 * @returns {Object} The updated data object
 */
function setTasksForTag(data, tagName, tasks) {
	if (!data) {
		data = {};
	}

	if (!data[tagName]) {
		data[tagName] = {};
	}

	data[tagName].tasks = tasks || [];
	return data;
}

/**
 * Flatten tasks array to include subtasks as individual searchable items
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Flattened array including both tasks and subtasks
 */
function flattenTasksWithSubtasks(tasks) {
	const flattened = [];

	for (const task of tasks) {
		// Add the main task
		flattened.push({
			...task,
			searchableId: task.id.toString(), // For consistent ID handling
			isSubtask: false
		});

		// Add subtasks if they exist
		if (task.subtasks && task.subtasks.length > 0) {
			for (const subtask of task.subtasks) {
				flattened.push({
					...subtask,
					searchableId: `${task.id}.${subtask.id}`, // Format: "15.2"
					isSubtask: true,
					parentId: task.id,
					parentTitle: task.title,
					// Enhance subtask context with parent information
					title: `${subtask.title} (subtask of: ${task.title})`,
					description: `${subtask.description} [Parent: ${task.description}]`
				});
			}
		}
	}

	return flattened;
}

/**
 * Ensures the tag object has a metadata object with created/updated timestamps.
 * @param {Object} tagObj - The tag object (e.g., data['master'])
 * @param {Object} [opts] - Optional fields (e.g., description, skipUpdate)
 * @param {string} [opts.description] - Description for the tag
 * @param {boolean} [opts.skipUpdate] - If true, don't update the 'updated' timestamp
 * @returns {Object} The updated tag object (for chaining)
 */
function ensureTagMetadata(tagObj, opts = {}) {
	if (!tagObj || typeof tagObj !== 'object') {
		throw new Error('tagObj must be a valid object');
	}

	const now = new Date().toISOString();

	if (!tagObj.metadata) {
		// Create new metadata object
		tagObj.metadata = {
			created: now,
			updated: now,
			...(opts.description ? { description: opts.description } : {})
		};
	} else {
		// Ensure existing metadata has required fields
		if (!tagObj.metadata.created) {
			tagObj.metadata.created = now;
		}

		// Update timestamp unless explicitly skipped
		if (!opts.skipUpdate) {
			tagObj.metadata.updated = now;
		}

		// Add description if provided and not already present
		if (opts.description && !tagObj.metadata.description) {
			tagObj.metadata.description = opts.description;
		}
	}

	return tagObj;
}

// Export all utility functions and configuration
export {
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
	disableSilentMode,
	enableSilentMode,
	getTaskManager,
	isSilentMode,
	addComplexityToTask,
	resolveEnvVariable,
	findProjectRoot,
	aggregateTelemetry,
	getCurrentTag,
	resolveTag,
	getTasksForTag,
	setTasksForTag,
	performCompleteTagMigration,
	migrateConfigJson,
	createStateJson,
	markMigrationForNotice,
	flattenTasksWithSubtasks,
	ensureTagMetadata
};
