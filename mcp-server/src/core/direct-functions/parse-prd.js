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
import {
	// Removed: getAnthropicClientForMCP,
	getModelConfig,
	_generateParsePRDPrompt, // Assuming this helper exists or can be created/imported
	parseTasksFromCompletion // Assuming this helper exists
} from '../utils/ai-client-utils.js';

/**
 * Direct function wrapper for parsing PRD documents and generating tasks using FastMCP sampling.
 *
 * @param {Object} args - Command arguments containing input, numTasks or tasks, and output options.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data for sampling.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function parsePRDDirect(args, log, context = {}) {
	const { session } = context; // Session is needed for sampling

	// Validate required parameters first
	if (!args.projectRoot) {
		const errorMessage = 'Project root is required for parsePRDDirect';
		log.error(errorMessage);
		return {
			success: false,
			error: { code: 'MISSING_PROJECT_ROOT', message: errorMessage },
			fromCache: false
		};
	}
	if (!args.input) {
		const errorMessage = 'Input file path is required for parsePRDDirect';
		log.error(errorMessage);
		return {
			success: false,
			error: { code: 'MISSING_INPUT_PATH', message: errorMessage },
			fromCache: false
		};
	}
	if (!args.output) {
		const errorMessage = 'Output file path is required for parsePRDDirect';
		log.error(errorMessage);
		return {
			success: false,
			error: { code: 'MISSING_OUTPUT_PATH', message: errorMessage },
			fromCache: false
		};
	}
	if (!session || typeof session.llm?.complete !== 'function') {
		const errorMessage = 'FastMCP sampling function (session.llm.complete) is not available.';
		log.error(errorMessage);
		return {
			success: false,
			error: { code: 'SAMPLING_UNAVAILABLE', message: errorMessage },
			fromCache: false
		};
	}


	// Resolve paths
	const projectRoot = args.projectRoot;
	const inputPath = path.isAbsolute(args.input)
		? args.input
		: path.resolve(projectRoot, args.input);
	const outputPath = path.isAbsolute(args.output)
		? args.output
		: path.resolve(projectRoot, args.output);
	const outputDir = path.dirname(outputPath);

	// Parse numTasks
	let numTasks = 10; // Default
	if (args.numTasks) {
		numTasks =
			typeof args.numTasks === 'string'
				? parseInt(args.numTasks, 10)
				: args.numTasks;
		if (isNaN(numTasks)) {
			numTasks = 10; // Fallback
			log.warn(`Invalid numTasks value: ${args.numTasks}. Using default: 10`);
		}
	}

	const append = Boolean(args.append) === true;

	log.info(
		`Parsing PRD via MCP sampling: Input=${inputPath}, Output=${outputPath}, NumTasks=${numTasks}, Append=${append}`
	);


	try {
		// Verify input file exists
		if (!fs.existsSync(inputPath)) {
			const errorMessage = `Input file not found: ${inputPath}`;
			log.error(errorMessage);
			return {
				success: false,
				error: {
					code: 'INPUT_FILE_NOT_FOUND',
					message: errorMessage,
					details: `Checked path: ${inputPath}\\nProject root: ${projectRoot}\\nInput argument: ${args.input}`
				},
				fromCache: false
			};
		}

		// Read PRD content
		const prdContent = fs.readFileSync(inputPath, 'utf8');

		// --- Start of Refactored Logic ---

		// 1. Construct the Prompt
		// Assuming a helper function _generateParsePRDPrompt exists and returns the correct prompt string
		const parsePrompt = _generateParsePRDPrompt(prdContent, numTasks);
		if (!parsePrompt) {
			throw new Error('Failed to generate the prompt for PRD parsing.');
		}
		log.info('Generated PRD parsing prompt for sampling.');

		// 2. Call FastMCP Sampling
		log.info('Initiating FastMCP LLM sampling via client...');
		const completion = await session.llm.complete(parsePrompt); // Use session for sampling
		log.info('Received completion from client LLM.');

		// Check if completion content exists (adjust based on actual FastMCP response structure)
		const completionText = completion?.content; // Example access, adjust as needed
		if (!completionText) {
			throw new Error('Received empty completion from client LLM via sampling.');
		}

		// 3. Parse Completion
		// Assuming parseTasksFromCompletion extracts the { tasks: [...] } structure
		const newTasksData = parseTasksFromCompletion(completionText);
		if (!newTasksData || !Array.isArray(newTasksData.tasks)) {
			throw new Error('Failed to parse valid tasks JSON from LLM completion.');
		}
		log.info(`Parsed ${newTasksData.tasks.length} new tasks from completion.`);


		// 4. Handle Appending
		let existingTasks = { tasks: [] };
		let lastTaskId = 0;
		if (append && fs.existsSync(outputPath)) {
			try {
				existingTasks = readJSON(outputPath) || { tasks: [] }; // Use readJSON util
				if (existingTasks.tasks?.length) {
					lastTaskId = existingTasks.tasks.reduce((maxId, task) => {
						const mainId = parseInt(task.id.toString().split('.')[0], 10) || 0;
						return Math.max(maxId, mainId);
					}, 0);
					log.info(`Appending mode: Found existing tasks. Last ID: ${lastTaskId}`);
				}
			} catch (error) {
				log.warn(`Could not read existing tasks file for append: ${error.message}`);
				existingTasks = { tasks: [] };
			}
		}

		// Update new task IDs if appending
		if (append && lastTaskId > 0) {
			log.info(`Updating new task IDs to continue from ID ${lastTaskId}`);
			newTasksData.tasks.forEach((task, index) => {
				task.id = lastTaskId + index + 1;
			});
		}

		// Merge tasks if appending
		const tasksData = append
			? {
					...existingTasks, // Preserve existing metadata if any
					tasks: [...(existingTasks.tasks || []), ...newTasksData.tasks]
				}
			: newTasksData; // Assume newTasksData contains the full { tasks: [...] } structure

		// 5. Save Tasks
		// Ensure output directory exists before writing
		if (!fs.existsSync(outputDir)) {
			log.info(`Creating output directory: ${outputDir}`);
			fs.mkdirSync(outputDir, { recursive: true });
		}
		writeJSON(outputPath, tasksData); // Use writeJSON util
		const actionVerb = append ? 'appended' : 'generated';
		log.info(`Tasks saved to: ${outputPath}`);


		// 6. Generate Individual Task Files (in silent mode)
		enableSilentMode();
		try {
			await generateTaskFiles(outputPath, outputDir, { mcpLog: log }); // Pass log for potential internal reporting
			log.info('Generated individual task files.');
		} finally {
			disableSilentMode();
		}

		// --- End of Refactored Logic ---

		// 7. Return Result
		const message = `Successfully ${actionVerb} ${newTasksData.tasks.length} tasks from PRD using client LLM sampling.`;
		log.info(message);
		return {
			success: true,
			data: {
				message,
				taskCount: tasksData.tasks?.length || 0, // Count total tasks after potential merge
				outputPath,
				appended: append
			},
			fromCache: false // This operation always modifies state
		};

	} catch (error) {
		log.error(`Error during MCP parsePRDDirect: ${error.message}`);
		log.error(error.stack); // Log stack for debugging
		return {
			success: false,
			error: {
				code: 'PARSE_PRD_SAMPLING_ERROR',
				message: error.message || 'Unknown error during PRD parsing via sampling'
			},
			fromCache: false
		};
	}
}
