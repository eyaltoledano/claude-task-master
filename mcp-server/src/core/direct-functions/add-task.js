/**
 * add-task.js
 * Direct function implementation for adding a new task, using FastMCP sampling for AI generation.
 */

import { addTask } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import {
	// Removed: getAnthropicClientForMCP,
	getModelConfig // Keep for potential non-sampling use?
} from '../utils/ai-client-utils.js';
import {
	_buildAddTaskPrompt,
	parseTaskJsonResponse
	// Removed: _handleAnthropicStream
} from '../utils/ai-client-utils.js';

/**
 * Direct function wrapper for adding a new task with error handling.
 * Uses FastMCP sampling for AI-driven task creation.
 *
 * @param {Object} args - Command arguments
 * @param {string} [args.prompt] - Description of the task to add (required if not using manual fields)
 * @param {string} [args.title] - Task title (for manual task creation)
 * @param {string} [args.description] - Task description (for manual task creation)
 * @param {string} [args.details] - Implementation details (for manual task creation)
 * @param {string} [args.testStrategy] - Test strategy (for manual task creation)
 * @param {string} [args.dependencies] - Comma-separated list of task IDs this task depends on
 * @param {string} [args.priority='medium'] - Task priority (high, medium, low)
 * @param {string} [args.file='tasks/tasks.json'] - Path to the tasks file
 * @param {string} [args.projectRoot] - Project root directory
 * @param {boolean} [args.research=false] - Whether to use research capabilities (Note: Research needs to be handled by the client LLM now)
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context (session for sampling)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function addTaskDirect(args, log, context = {}) {
	// Destructure expected args
	const { tasksJsonPath, prompt, dependencies, priority, research } = args;
	try {
		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('addTaskDirect called without tasksJsonPath');
			disableSilentMode(); // Disable before returning
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}

		// Use provided path
		const tasksPath = tasksJsonPath;

		// Check if this is manual task creation or AI-driven task creation
		const isManualCreation = args.title && args.description;

		// Check required parameters
		if (!args.prompt && !isManualCreation) {
			log.error(
				'Missing required parameters: either prompt or title+description must be provided'
			);
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'MISSING_PARAMETER',
					message:
						'Either the prompt parameter or both title and description parameters are required for adding a task'
				}
			};
		}

		// Extract and prepare parameters
		const taskDependencies = Array.isArray(dependencies)
			? dependencies
			: dependencies
				? String(dependencies)
						.split(',')
						.map((id) => parseInt(id.trim(), 10))
				: [];
		const taskPriority = priority || 'medium';

		// Extract context parameters for advanced functionality
		const { session } = context;

		let manualTaskData = null;
		let taskDataFromAI = null;

		if (isManualCreation) {
			// Create manual task data object
			manualTaskData = {
				title: args.title,
				description: args.description,
				details: args.details || '',
				testStrategy: args.testStrategy || ''
			};

			log.info(
				`Adding new task manually with title: "${args.title}", dependencies: [${taskDependencies.join(', ')}], priority: ${priority}`
			);

		} else {
			// --- Start of Refactored AI Path ---
			log.info(
				`Generating new task via MCP sampling with prompt: "${prompt}", dependencies: [${taskDependencies.join(', ')}], priority: ${priority}`
			);

			// Check if sampling is available via session
			if (!session || typeof session.llm?.complete !== 'function') {
				const errorMessage = 'FastMCP sampling function (session.llm.complete) is not available.';
				log.error(errorMessage);
				disableSilentMode();
				return {
					success: false,
					error: { code: 'SAMPLING_UNAVAILABLE', message: errorMessage },
					fromCache: false
				};
			}

			// Read existing tasks to provide context for the prompt
			let tasksData;
			try {
				const fs = await import('fs');
				tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			} catch (error) {
				log.warn(`Could not read existing tasks for context: ${error.message}`);
				tasksData = { tasks: [] };
			}

			// Build prompts for AI
			const { systemPrompt, userPrompt } = _buildAddTaskPrompt(
				prompt, // Use the original user prompt
				tasksData.tasks
			);

			// Call FastMCP Sampling
			let completionText;
			try {
				log.info('Initiating FastMCP LLM sampling via client...');
				// Pass both system and user prompts if the sampling method supports it
				// Adjust based on actual FastMCP API
				const completion = await session.llm.complete(userPrompt, { system: systemPrompt });
				log.info('Received completion from client LLM.');
				completionText = completion?.content; // Example access
				if (!completionText) {
					throw new Error('Received empty completion from client LLM via sampling.');
				}
			} catch (error) {
				log.error(`LLM sampling failed: ${error.message}`);
				disableSilentMode();
				return {
					success: false,
					error: {
						code: 'SAMPLING_ERROR',
						message: `Failed to get completion via sampling: ${error.message}`
					}
				};
			}

			// Parse the AI response
			try {
				taskDataFromAI = parseTaskJsonResponse(completionText);
				log.info('Parsed task data from LLM completion.');
			} catch (error) {
				log.error(`Failed to parse LLM completion: ${error.message}`);
				disableSilentMode();
				return {
					success: false,
					error: {
						code: 'RESPONSE_PARSING_ERROR',
						message: `Failed to parse LLM completion: ${error.message}`
					}
				};
			}
			// --- End of Refactored AI Path ---
		}

		// Create logger wrapper before calling core function
		const logWrapper = {
			info: (message, ...args) => log.info(message, ...args),
			warn: (message, ...args) => log.warn(message, ...args),
			error: (message, ...args) => log.error(message, ...args),
			debug: (message, ...args) => log.debug && log.debug(message, ...args),
			success: (message, ...args) => log.info(message, ...args) // Map success to info
		};

		// Call the core addTask function with either manual data or AI-generated data
		const newTaskId = await addTask(
			tasksPath,
			prompt, // Pass original prompt for potential logging/context in core function
			taskDependencies,
			taskPriority,
			{
				mcpLog: logWrapper, // Use the wrapper
				session
			},
			'json', // Request JSON output format
			null, // No custom env
			manualTaskData || taskDataFromAI // Pass the appropriate task data
		);

		// Restore normal logging
		disableSilentMode();

		// Return success
		return {
			success: true,
			data: {
				taskId: newTaskId,
				message: `Successfully added new task #${newTaskId}`
			}
		};

	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in addTaskDirect: ${error.message}`);
		log.error(error.stack); // Log stack for debugging
		return {
			success: false,
			error: {
				code: 'ADD_TASK_ERROR',
				message: error.message
			}
		};
	}
}
