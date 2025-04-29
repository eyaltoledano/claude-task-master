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
 * @param {Object} context - Context object containing session data and sampling function.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function parsePRDDirect(args, log, context = {}) {
	// Remove the session destructuring and the check for session.llm.complete
	// const { session } = context;

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
	// Add check for context.sample
	if (!context || typeof context.sample !== 'function') {
		const errorMessage = 'FastMCP sampling function (context.sample) is not available.';
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
	const force = Boolean(args.force) === true; // Make sure force is checked

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

		// 1. Construct the Prompt (Use correct helper)
		const { systemPrompt, userPrompt } = _generateParsePRDPrompt(prdContent, numTasks, path.basename(inputPath));
		if (!userPrompt) { // Check user prompt as it contains the main content
			throw new Error('Failed to generate the prompt for PRD parsing.');
		}
		log.info('Generated PRD parsing prompt for sampling.');

		// 2. Call context.sample
		log.info('Initiating client-side LLM sampling via context.sample...');
		let completion;
		try {
			completion = await context.sample(userPrompt, { system: systemPrompt });
		} catch (sampleError) {
			log.error(`context.sample failed: ${sampleError.message}`);
			throw new Error(`Client-side sampling failed: ${sampleError.message}`);
		}

		// Check if completion content exists
		const completionText = completion?.text; // Adjust based on expected structure from context.sample
		if (!completionText) {
			throw new Error('Received empty completion from client LLM via context.sample.');
		}
		log.info('Received completion from client LLM.');

		// 3. Parse Completion (Use correct helper)
		const newTasksData = parseTasksFromCompletion(completionText);
		if (!newTasksData || !Array.isArray(newTasksData.tasks)) {
			throw new Error('Failed to parse valid tasks JSON from LLM completion.');
		}
		log.info(`Parsed ${newTasksData.tasks.length} new tasks from completion.`);

		// 4. Handle Appending/Overwriting (remains mostly the same, check force)
		let existingTasks = { tasks: [], metadata: {} };
		let lastTaskId = 0;
		const outputExists = fs.existsSync(outputPath);

		if (outputExists && !append && !force) {
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

		// Update new task IDs and dependencies if appending (remains the same logic)
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

		// Merge tasks if appending (remains the same logic)
		const tasksData = append
			? {
				...existingTasks.metadata,
				...newTasksData.metadata,
				tasks: [...(existingTasks.tasks || []), ...newTasksData.tasks]
			}
			: newTasksData;

		// 5. Save Tasks (remains the same)
		if (!fs.existsSync(outputDir)) {
			log.info(`Creating output directory: ${outputDir}`);
			fs.mkdirSync(outputDir, { recursive: true });
		}
		writeJSON(outputPath, tasksData);
		const actionVerb = append ? 'appended' : 'generated';
		log.info(`Tasks ${actionVerb} and saved to: ${outputPath}`);

		// 6. Generate Individual Task Files (use logWrapper)
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
				// Pass outputPath (which is tasksJsonPath) and outputDir
				await generateTaskFiles(outputPath, outputDir, { mcpLog: logWrapper });
				log.info('Generated individual task files.');
			} catch (genError) {
				log.error(`Error generating task files: ${genError.message}`);
				// Don't fail the whole operation, just log the error
			} finally {
				disableSilentMode();
			}
		}

		// 7. Return Result
		const message = `Successfully ${actionVerb} ${newTasksData.tasks.length} tasks from PRD using client LLM sampling.`;
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
		log.error(`Error during MCP parsePRDDirect: ${error.message}`);
		log.error(error.stack);
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
