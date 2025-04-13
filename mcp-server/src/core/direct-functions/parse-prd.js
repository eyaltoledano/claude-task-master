/**
 * parse-prd.js
 * Direct function implementation for parsing PRD documents
 */

import path from 'path';
import fs from 'fs';
import { parsePRD } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import {
	enableSilentMode,
	disableSilentMode,
	archiveTasksBeforeOverwrite
} from '../../../../scripts/modules/utils.js';
import {
	getAnthropicClientForMCP,
	getModelConfig
} from '../utils/ai-client-utils.js';
import { createErrorResponse } from '../../tools/utils.js';
import { ApiClient } from '../api-client/client.js';

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

		// Parameter validation and path resolution
		if (!args.input) {
			const errorMessage =
				'No input file specified. Please provide an input PRD document path.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_INPUT_FILE', message: errorMessage },
				fromCache: false
			};
		}

		// Resolve input path (relative to project root if provided)
		const projectRoot = args.projectRoot || process.cwd();
		const inputPath = path.isAbsolute(args.input)
			? args.input
			: path.resolve(projectRoot, args.input);

		// Determine output path
		let outputPath;
		if (args.output) {
			outputPath = path.isAbsolute(args.output)
				? args.output
				: path.resolve(projectRoot, args.output);
		} else {
			// Default to tasks/tasks.json in the project root
			outputPath = path.resolve(projectRoot, 'tasks', 'tasks.json');
		}

		// Check if output file exists and archive it if needed and force flag is used
		if (fs.existsSync(outputPath)) {
			// If force is not explicitly true, exit with error
			if (args.force !== true) {
				const errorMessage = `Output file already exists at ${outputPath}. Use force=true to overwrite.`;
				log.warn(errorMessage);
				return {
					success: false,
					error: { code: 'OUTPUT_FILE_EXISTS', message: errorMessage },
					fromCache: false
				};
			}
			
			// Archive the existing tasks file before overwriting
			const archiveResult = archiveTasksBeforeOverwrite(outputPath);
			if (!archiveResult.success) {
				log.warn(`Could not archive existing tasks file: ${archiveResult.error}. Proceeding with overwrite.`);
			} else if (archiveResult.archived) {
				log.info(`Existing tasks file has been archived to ${archiveResult.archivePath}`);
			}
		}

		// Verify input file exists
		if (!fs.existsSync(inputPath)) {
			const errorMessage = `Input file not found: ${inputPath}`;
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'INPUT_FILE_NOT_FOUND', message: errorMessage },
				fromCache: false
			};
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

		log.info(
			`Preparing to parse PRD from ${inputPath} and output to ${outputPath} with ${numTasks} tasks`
		);

		// Prepare model config from args if provided
		const modelConfig = {
			model: args.model,
			maxTokens: args.maxTokens ? parseInt(args.maxTokens, 10) : undefined,
			temperature: args.temperature ? parseFloat(args.temperature) : undefined,
		};

		// Create a log wrapper that uses our logger
		const logWrapper = {
			debug: (msg) => log.debug(msg),
			info: (msg) => log.info(msg),
			warn: (msg) => log.warn(msg),
			error: (msg) => log.error(msg),
		};

		// Enable silent mode to prevent logs from interfering with the response
		enableSilentMode();
		try {
			// Execute core parsePRD function with AI client
			await parsePRD(
				inputPath,
				outputPath,
				numTasks,
				{
					mcpLog: logWrapper,
					session,
					force: args.force
				},
				aiClient,
				modelConfig
			);

			// Since parsePRD doesn't return a value but writes to a file, we'll read the result
			// to return it to the caller
			if (fs.existsSync(outputPath)) {
				const tasksData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
				log.info(
					`Successfully parsed PRD and generated ${tasksData.tasks?.length || 0} tasks`
				);

				return {
					success: true,
					data: {
						message: `Successfully generated ${tasksData.tasks?.length || 0} tasks from PRD`,
						taskCount: tasksData.tasks?.length || 0,
						outputPath
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
