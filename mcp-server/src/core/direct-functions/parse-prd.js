/**
 * parse-prd.js
 * Direct function implementation for parsing PRD documents using FastMCP sampling
 */

import path from 'path';
import fs from 'fs';
// Removed: import { parsePRD } from '../../../../scripts/modules/task-manager.js';
import { generateTaskFiles } from '../../../../scripts/modules/task-manager.js'; // Keep for generating files
import {
	enableSilentMode,
	disableSilentMode,
	readJSON, // Need readJSON for append mode
	writeJSON // Need writeJSON to save result
} from '../../../../scripts/modules/utils.js';
// Removed: import {
// 	getModelConfig,
// 	_generateParsePRDPrompt,
// 	parseTasksFromCompletion
// } from '../utils/ai-client-utils.js';

/**
 * Direct function responsible for saving parsed/merged task data and generating task files.
 *
 * @param {Object} saveArgs - Arguments containing task data and file operation details.
 * @param {string} saveArgs.tasksJsonPath - Absolute path to the tasks.json file.
 * @param {string} saveArgs.projectRoot - Absolute path to the project root.
 * @param {Object} saveArgs.newTasksData - The parsed { tasks: [], metadata: {} } object from AI.
 * @param {boolean} saveArgs.append - Whether to append to existing file.
 * @param {boolean} saveArgs.force - Whether to force overwrite.
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function saveTasksAndGenerateFilesDirect(saveArgs, log) {
	// Destructure args
	const { tasksJsonPath, projectRoot, newTasksData, append, force } = saveArgs;

	// Validate required parameters first (already validated in tool, but good practice)
	if (!projectRoot) {
		const errorMessage = 'Project root is required';
		log.error(errorMessage);
		return {
			success: false,
			error: { code: 'MISSING_PROJECT_ROOT', message: errorMessage },
			fromCache: false
		};
	}
	if (!tasksJsonPath) {
		const errorMessage = 'Tasks JSON path is required';
		log.error(errorMessage);
		return { success: false, error: { code: 'MISSING_OUTPUT_PATH', message: errorMessage }, fromCache: false };
	}
	if (!newTasksData || !Array.isArray(newTasksData.tasks)) {
		const errorMessage = 'Valid newTasksData object with tasks array is required';
		log.error(errorMessage);
		return { success: false, error: { code: 'INVALID_TASK_DATA', message: errorMessage }, fromCache: false };
	}

	const outputPath = tasksJsonPath; // Use consistent naming
	const outputDir = path.dirname(outputPath);

	log.info(
		`Saving tasks: Output=${outputPath}, Append=${append}, Force=${force}`
	);

	try {
		// Handle Appending/Overwriting (Keep this logic)
		let existingTasks = { tasks: [], metadata: {} };
		let lastTaskId = 0;
		const outputExists = fs.existsSync(outputPath);

		if (outputExists && !append && !force) {
			// This check is now primarily handled in the tool, but keep as safeguard
			throw new Error(`Output file ${outputPath} already exists. Use --force to overwrite or --append.`);
		}

		if (append && outputExists) {
			try {
				existingTasks = readJSON(outputPath) || { tasks: [], metadata: {} };
				if (existingTasks.tasks?.length) {
					lastTaskId = existingTasks.tasks.reduce((maxId, task) => {
						const mainId = parseInt(task.id.toString().split('.')[0], 10) || 0;
						return Math.max(maxId, mainId);
					}, 0);
					log.info(`Appending mode: Found existing tasks. Last ID: ${lastTaskId}`);
				} else {
					existingTasks.tasks = [];
				}
			} catch (readError) {
				log.warn(`Could not read existing tasks file for append: ${readError.message}. Starting fresh.`);
				existingTasks = { tasks: [], metadata: {} };
			}
		}

		// Update new task IDs and dependencies if appending (Keep this logic)
		if (append && lastTaskId > 0) {
			log.info(`Updating new task IDs and dependencies to continue from ID ${lastTaskId}`);
			const idMapping = {};
			newTasksData.tasks.forEach((task, index) => {
				const oldId = task.id;
				const newId = lastTaskId + index + 1;
				idMapping[oldId] = newId;
				task.id = newId;
			});
			newTasksData.tasks.forEach(task => {
				task.dependencies = (task.dependencies || [])
					.map(depId => idMapping[depId] || 0)
					.filter(depId => depId !== 0);
			});
		}

		// Merge tasks if appending (Keep this logic)
		const tasksData = append
			? {
				...existingTasks.metadata,
				...newTasksData.metadata,
				tasks: [...(existingTasks.tasks || []), ...newTasksData.tasks]
			}
			: newTasksData;

		// Save Tasks (Keep this logic)
		if (!fs.existsSync(outputDir)) {
			log.info(`Creating output directory: ${outputDir}`);
			fs.mkdirSync(outputDir, { recursive: true });
		}
		writeJSON(outputPath, tasksData);
		const actionVerb = append ? 'appended' : 'generated';
		log.info(`Tasks ${actionVerb} and saved to: ${outputPath}`);

		// Generate Individual Task Files (Keep this logic)
		if (tasksData.tasks.length > 0) {
			const logWrapper = {
				info: (message, ...args) => log.info(message, ...args),
				warn: (message, ...args) => log.warn(message, ...args),
				error: (message, ...args) => log.error(message, ...args),
				debug: (message, ...args) => log.debug && log.debug(message, ...args),
				success: (message, ...args) => log.info(message, ...args)
			};
			enableSilentMode();
			try {
				await generateTaskFiles(outputPath, outputDir, { mcpLog: logWrapper });
				log.info('Generated individual task files.');
			} catch (genError) {
				log.error(`Error generating task files: ${genError.message}`);
				// Don't fail the whole operation, just log the error
			} finally {
				disableSilentMode();
			}
		}

		// Return Result
		const message = `Successfully saved ${tasksData.tasks?.length || 0} tasks (${actionVerb}).`;
		log.info(message);
		return {
			success: true,
			data: {
				message,
				taskCount: tasksData.tasks?.length || 0,
				outputPath,
				appended: append
			},
			fromCache: false
		};

	} catch (error) {
		log.error(`Error during saveTasksAndGenerateFilesDirect: ${error.message}`);
		log.error(error.stack);
		return {
			success: false,
			error: {
				code: 'SAVE_TASKS_ERROR',
				message: error.message || 'Unknown error during saving tasks or generating files'
			},
			fromCache: false
		};
	}
}
