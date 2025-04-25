/**
 * parse-prd.js
 * Direct function implementation for parsing PRD documents
 */

import path from 'path';
import fs from 'fs';
import { parsePRD } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import {
	getAnthropicClientForMCP,
	getModelConfig
} from '../utils/ai-client-utils.js';

/**
 * Direct function wrapper for parsing PRD documents and generating tasks.
 *
 * @param {Object} args - Command arguments containing input, numTasks or tasks, and output options.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function parsePRDDirect(args, log, context = {}) {
	const { session } = context; // Only extract session, not reportProgress

	try {
		log.info(`Parsing PRD document with args: ${JSON.stringify(args)}`);

		// --- AGENT-IN-THE-LOOP: PROMPT GENERATION MODE ---
		if (args.mode === 'get_prompt' || (!args.tasks && args.mode !== 'submit_tasks')) {
			// Read PRD content
			const projectRoot = args.projectRoot;
			const inputPath = path.isAbsolute(args.input)
				? args.input
				: path.resolve(projectRoot, args.input);
			if (!fs.existsSync(inputPath)) {
				const errorMessage = `Input file not found: ${inputPath}`;
				log.error(errorMessage);
				return {
					success: false,
					error: {
						code: 'INPUT_FILE_NOT_FOUND',
						message: errorMessage
					},
					fromCache: false
				};
			}
			const prdContent = fs.readFileSync(inputPath, 'utf8');
			const numTasks = args.numTasks ? parseInt(args.numTasks, 10) : 10;
			const prompt = `You are to generate a set of high-level software development tasks from the following Product Requirements Document (PRD). Each task should be actionable, concise, and follow the Task Master task structure. Aim for about ${numTasks} top-level tasks.\n\n--- PRD CONTENT START ---\n${prdContent}\n--- PRD CONTENT END ---\n\nReturn an array of tasks, each with fields: id (number), title (string), description (string), status (string), dependencies (array of numbers), priority (string), details (string), testStrategy (string).`;
			return {
				success: true,
				data: {
					prompt,
					prdContent,
					numTasks
				},
				fromCache: false
			};
		}

		// --- AGENT-IN-THE-LOOP: TASK SUBMISSION MODE ---
		if ((args.mode === 'submit_tasks' || args.tasks) && Array.isArray(args.tasks)) {
			const tasks = args.tasks;
			// Validate tasks structure
			if (!Array.isArray(tasks) || tasks.length === 0) {
				return {
					success: false,
					error: {
						code: 'INVALID_TASKS',
						message: 'No tasks provided or tasks is not an array.'
					},
					fromCache: false
				};
			}
			const errors = [];
			const idSet = new Set();
			const validIds = new Set();
			for (let i = 0; i < tasks.length; i++) {
				const t = tasks[i];
				const idx = i + 1;
				if (typeof t !== 'object' || t === null) {
					errors.push(`Task at index ${i} is not an object.`);
					continue;
				}
				if (typeof t.id !== 'number') {
					errors.push(`Task ${idx}: 'id' must be a number.`);
				} else {
					if (idSet.has(t.id)) {
						errors.push(`Duplicate task id: ${t.id}`);
					} else {
						idSet.add(t.id);
						validIds.add(t.id);
					}
				}
				if (typeof t.title !== 'string' || !t.title.trim()) {
					errors.push(`Task ${t.id}: 'title' is required and must be a string.`);
				}
				if (typeof t.description !== 'string') {
					errors.push(`Task ${t.id}: 'description' must be a string.`);
				}
				if (typeof t.status !== 'string') {
					errors.push(`Task ${t.id}: 'status' must be a string.`);
				}
				if (!Array.isArray(t.dependencies)) {
					errors.push(`Task ${t.id}: 'dependencies' must be an array.`);
				}
				if (typeof t.priority !== 'string') {
					errors.push(`Task ${t.id}: 'priority' must be a string.`);
				}
				if (typeof t.details !== 'string') {
					errors.push(`Task ${t.id}: 'details' must be a string.`);
				}
				if (typeof t.testStrategy !== 'string') {
					errors.push(`Task ${t.id}: 'testStrategy' must be a string.`);
				}
			}
			// Check that dependencies only reference valid task IDs
			for (const t of tasks) {
				if (Array.isArray(t.dependencies)) {
					for (const dep of t.dependencies) {
						if (typeof dep !== 'number' || !validIds.has(dep)) {
							errors.push(`Task ${t.id}: dependency '${dep}' is not a valid task id in this batch.`);
						}
					}
				}
			}
			if (errors.length > 0) {
				return {
					success: false,
					error: {
						code: 'INVALID_TASKS',
						message: 'Task validation failed.',
						details: errors
					},
					fromCache: false
				};
			}
			// Write tasks to output file (overwrite or append)
			const projectRoot = args.projectRoot;
			const outputPath = path.isAbsolute(args.output)
				? args.output
				: path.resolve(projectRoot, args.output);
			const append = Boolean(args.append) === true;
			let allTasks = tasks;
			if (append && fs.existsSync(outputPath)) {
				try {
					const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
					if (Array.isArray(existing.tasks)) {
						allTasks = [...existing.tasks, ...tasks];
					}
				} catch (e) {
					log.warn(`Failed to read/parse existing tasks.json for append: ${e.message}`);
				}
			}
			const tasksData = { tasks: allTasks };
			fs.writeFileSync(outputPath, JSON.stringify(tasksData, null, 2));
			const message = `Successfully wrote ${tasks.length} tasks to ${outputPath}${append ? ' (appended)' : ''}`;
			log.info(message);
			return {
				success: true,
				data: {
					message,
					taskCount: tasks.length,
					outputPath,
					appended: append
				},
				fromCache: false
			};
		}

		// Initialize AI client for PRD parsing
		let aiClient;
		try {
			aiClient = getAnthropicClientForMCP(session, log);
		} catch (error) {
			log.error(`Failed to initialize AI client: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'AI_CLIENT_ERROR',
					message: `Cannot initialize AI client: ${error.message}`
				},
				fromCache: false
			};
		}

		// Validate required parameters
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

		// Resolve input path (expecting absolute path or path relative to project root)
		const projectRoot = args.projectRoot;
		const inputPath = path.isAbsolute(args.input)
			? args.input
			: path.resolve(projectRoot, args.input);

		// Verify input file exists
		if (!fs.existsSync(inputPath)) {
			const errorMessage = `Input file not found: ${inputPath}`;
			log.error(errorMessage);
			return {
				success: false,
				error: {
					code: 'INPUT_FILE_NOT_FOUND',
					message: errorMessage,
					details: `Checked path: ${inputPath}\nProject root: ${projectRoot}\nInput argument: ${args.input}`
				},
				fromCache: false
			};
		}

		// Resolve output path (expecting absolute path or path relative to project root)
		const outputPath = path.isAbsolute(args.output)
			? args.output
			: path.resolve(projectRoot, args.output);

		// Ensure output directory exists
		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			log.info(`Creating output directory: ${outputDir}`);
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Parse number of tasks - handle both string and number values
		let numTasks = 10; // Default
		if (args.numTasks) {
			numTasks =
				typeof args.numTasks === 'string'
					? parseInt(args.numTasks, 10)
					: args.numTasks;
			if (isNaN(numTasks)) {
				numTasks = 10; // Fallback to default if parsing fails
				log.warn(`Invalid numTasks value: ${args.numTasks}. Using default: 10`);
			}
		}

		// Extract the append flag from args
		const append = Boolean(args.append) === true;

		// Log key parameters including append flag
		log.info(
			`Preparing to parse PRD from ${inputPath} and output to ${outputPath} with ${numTasks} tasks, append mode: ${append}`
		);

		// Create the logger wrapper for proper logging in the core function
		const logWrapper = {
			info: (message, ...args) => log.info(message, ...args),
			warn: (message, ...args) => log.warn(message, ...args),
			error: (message, ...args) => log.error(message, ...args),
			debug: (message, ...args) => log.debug && log.debug(message, ...args),
			success: (message, ...args) => log.info(message, ...args) // Map success to info
		};

		// Get model config from session
		const modelConfig = getModelConfig(session);

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();
		try {
			// Make sure the output directory exists
			const outputDir = path.dirname(outputPath);
			if (!fs.existsSync(outputDir)) {
				log.info(`Creating output directory: ${outputDir}`);
				fs.mkdirSync(outputDir, { recursive: true });
			}

			// Execute core parsePRD function with AI client
			await parsePRD(
				inputPath,
				outputPath,
				numTasks,
				{
					mcpLog: logWrapper,
					session,
					append
				},
				aiClient,
				modelConfig
			);

			// Since parsePRD doesn't return a value but writes to a file, we'll read the result
			// to return it to the caller
			if (fs.existsSync(outputPath)) {
				const tasksData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
				const actionVerb = append ? 'appended' : 'generated';
				const message = `Successfully ${actionVerb} ${tasksData.tasks?.length || 0} tasks from PRD`;

				log.info(message);

				return {
					success: true,
					data: {
						message,
						taskCount: tasksData.tasks?.length || 0,
						outputPath,
						appended: append
					},
					fromCache: false // This operation always modifies state and should never be cached
				};
			} else {
				const errorMessage = `Tasks file was not created at ${outputPath}`;
				log.error(errorMessage);
				return {
					success: false,
					error: { code: 'OUTPUT_FILE_NOT_CREATED', message: errorMessage },
					fromCache: false
				};
			}
		} finally {
			// Always restore normal logging
			disableSilentMode();
		}
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error parsing PRD: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'PARSE_PRD_ERROR',
				message: error.message || 'Unknown error parsing PRD'
			},
			fromCache: false
		};
	}
}
