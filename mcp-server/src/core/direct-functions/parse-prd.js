/**
 * parse-prd.js
 * Direct function implementation for parsing PRD documents
 */

import path from 'path';
import fs from 'fs';
import { parsePRD } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';
import { getDefaultNumTasks } from '../../../../scripts/modules/config-manager.js';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';

/**
 * Direct function wrapper for parsing PRD documents and generating tasks.
 *
 * @param {Object} taskMaster - TaskMaster instance with path resolution
 * @param {Object} args - Command arguments containing taskMaster.getProjectRoot(), input, output, numTasks options.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function parsePRDDirect(taskMaster, args, log, context = {}) {
	const { session } = context;
	// Extract taskMaster.getProjectRoot() from args
	const {
		output: outputArg,
		numTasks: numTasksArg,
		force,
		append,
		research
	} = args;

	// Create the standard logger wrapper
	const logWrapper = createLogWrapper(log);

	// Resolve output path - use taskMaster or default
	const outputPath = outputArg
		? path.isAbsolute(outputArg)
			? outputArg
			: path.resolve(taskMaster.getProjectRoot(), outputArg)
		: taskMaster.getTasksPath() ||
			path.resolve(taskMaster.getProjectRoot(), TASKMASTER_TASKS_FILE);

	let numTasks = getDefaultNumTasks(taskMaster.getProjectRoot());
	if (numTasksArg) {
		numTasks =
			typeof numTasksArg === 'string' ? parseInt(numTasksArg, 10) : numTasksArg;
		if (Number.isNaN(numTasks) || numTasks < 0) {
			// Ensure positive number
			numTasks = getDefaultNumTasks(taskMaster.getProjectRoot()); // Fallback to default if parsing fails or invalid
			logWrapper.warn(
				`Invalid numTasks value: ${numTasksArg}. Using default: ${numTasks}`
			);
		}
	}

	if (append) {
		logWrapper.info('Append mode enabled.');
		if (force) {
			logWrapper.warn(
				'Both --force and --append flags were provided. --force takes precedence; append mode will be ignored.'
			);
		}
	}

	if (research) {
		logWrapper.info(
			'Research mode enabled. Using Perplexity AI for enhanced PRD analysis.'
		);
	}

	logWrapper.info(
		`Parsing PRD via direct function. Input: ${taskMaster.getPrdPath()}, Output: ${outputPath}, NumTasks: ${numTasks}, Force: ${force}, Append: ${append}, Research: ${research}, ProjectRoot: ${taskMaster.getProjectRoot()}`
	);

	const wasSilent = isSilentMode();
	if (!wasSilent) {
		enableSilentMode();
	}

	try {
		// Call the core parsePRD function
		const result = await parsePRD(
			taskMaster.getPrdPath(),
			outputPath,
			numTasks,
			{
				session,
				mcpLog: logWrapper,
				projectRoot: taskMaster.getProjectRoot(),
				force,
				append,
				research,
				commandName: 'parse-prd',
				outputType: 'mcp'
			},
			'json'
		);

		// Adjust check for the new return structure
		if (result && result.success) {
			const successMsg = `Successfully parsed PRD and generated tasks in ${result.tasksPath}`;
			logWrapper.success(successMsg);
			return {
				success: true,
				data: {
					message: successMsg,
					outputPath: result.tasksPath,
					telemetryData: result.telemetryData,
					tagInfo: result.tagInfo
				}
			};
		} else {
			// Handle case where core function didn't return expected success structure
			logWrapper.error(
				'Core parsePRD function did not return a successful structure.'
			);
			return {
				success: false,
				error: {
					code: 'CORE_FUNCTION_ERROR',
					message:
						result?.message ||
						'Core function failed to parse PRD or returned unexpected result.'
				}
			};
		}
	} catch (error) {
		logWrapper.error(`Error executing core parsePRD: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'PARSE_PRD_CORE_ERROR',
				message: error.message || 'Unknown error parsing PRD'
			}
		};
	} finally {
		if (!wasSilent && isSilentMode()) {
			disableSilentMode();
		}
	}
}
