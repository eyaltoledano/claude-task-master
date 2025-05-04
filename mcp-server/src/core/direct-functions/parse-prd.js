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

/**
 * Direct function wrapper for parsing PRD documents and generating tasks.
 *
 * @param {Object} args - Command arguments containing projectRoot, input, output, numTasks options.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function parsePRDDirect(args, log, context = {}) {
	const { session } = context;
	// Extract projectRoot from args
	const {
		input: inputArg,
		output: outputArg,
		numTasks: numTasksArg,
		force,
		append,
		projectRoot
	} = args;

	// Create the standard logger wrapper
	const logWrapper = createLogWrapper(log);

	// --- Input Validation and Path Resolution ---
	if (!projectRoot) {
		logWrapper.error('parsePRDDirect requires a projectRoot argument.');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'projectRoot is required.'
			}
		};
	}
	if (!inputArg) {
		logWrapper.error('parsePRDDirect called without input path');
		return {
			success: false,
			error: { code: 'MISSING_ARGUMENT', message: 'Input path is required' }
		};
	}

	// Resolve input and output paths relative to projectRoot
	const inputPath = path.resolve(projectRoot, inputArg);
	const outputPath = outputArg
		? path.resolve(projectRoot, outputArg)
		: path.resolve(projectRoot, 'tasks', 'tasks.json'); // Default output path

	// Check if input file exists
	if (!fs.existsSync(inputPath)) {
		const errorMsg = `Input PRD file not found at resolved path: ${inputPath}`;
		logWrapper.error(errorMsg);
		return {
			success: false,
			error: { code: 'FILE_NOT_FOUND', message: errorMsg }
		};
	}

	const outputDir = path.dirname(outputPath);
	try {
		if (!fs.existsSync(outputDir)) {
			logWrapper.info(`Creating output directory: ${outputDir}`);
			fs.mkdirSync(outputDir, { recursive: true });
		}
	} catch (dirError) {
		logWrapper.error(
			`Failed to create output directory ${outputDir}: ${dirError.message}`
		);
		// Return an error response immediately if dir creation fails
		return {
			success: false,
			error: {
				code: 'DIRECTORY_CREATION_ERROR',
				message: `Failed to create output directory: ${dirError.message}`
			}
		};
	}

	let numTasks = getDefaultNumTasks(projectRoot);
	if (numTasksArg) {
		numTasks =
			typeof numTasksArg === 'string' ? parseInt(numTasksArg, 10) : numTasksArg;
		if (isNaN(numTasks) || numTasks <= 0) {
			// Ensure positive number
			numTasks = getDefaultNumTasks(projectRoot); // Fallback to default if parsing fails or invalid
			logWrapper.warn(
				`Invalid numTasks value: ${numTasksArg}. Using default: ${numTasks}`
			);
		}
	}

	const useForce = force === true;
	const useAppend = append === true;
	if (useAppend) {
		logWrapper.info('Append mode enabled.');
		if (useForce) {
			logWrapper.warn(
				'Both --force and --append flags were provided. --force takes precedence; append mode will be ignored.'
			);
		}
	}

	logWrapper.info(
		`Parsing PRD via direct function. Input: ${inputPath}, Output: ${outputPath}, NumTasks: ${numTasks}, Force: ${useForce}, Append: ${useAppend}, ProjectRoot: ${projectRoot}`
	);

	const wasSilent = isSilentMode();
	if (!wasSilent) {
		enableSilentMode();
	}

	try {
		// Call the core parsePRD function
		const result = await parsePRD(
			inputPath,
			outputPath,
			numTasks,
			{ session, mcpLog: logWrapper, projectRoot, useForce, useAppend },
			'json'
		);

		// parsePRD returns { success: true, tasks: processedTasks } on success
		if (result && result.success && Array.isArray(result.tasks)) {
			logWrapper.success(
				`Successfully parsed PRD. Generated ${result.tasks.length} tasks.`
			);
			return {
				success: true,
				data: {
					message: `Successfully parsed PRD and generated ${result.tasks.length} tasks.`,
					outputPath: outputPath,
					taskCount: result.tasks.length
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
