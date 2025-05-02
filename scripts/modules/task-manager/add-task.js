import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { z } from 'zod';

import {
	displayBanner,
	getStatusWithColor,
	startLoadingIndicator,
	stopLoadingIndicator
} from '../ui.js';
import { readJSON, writeJSON, log as consoleLog, truncate } from '../utils.js';
import { generateObjectService } from '../ai-services-unified.js';
import { getDefaultPriority } from '../config-manager.js';
import generateTaskFiles from './generate-task-files.js';

// Define Zod schema for the expected AI output object
const AiTaskDataSchema = z.object({
	title: z.string().describe('Clear, concise title for the task'),
	description: z
		.string()
		.describe('A one or two sentence description of the task'),
	details: z
		.string()
		.describe('In-depth implementation details, considerations, and guidance'),
	testStrategy: z
		.string()
		.describe('Detailed approach for verifying task completion')
});

/**
 * Add a new task using AI
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} prompt - Description of the task to add (required for AI-driven creation)
 * @param {Array} dependencies - Task dependencies
 * @param {string} priority - Task priority
 * @param {function} reportProgress - Function to report progress to MCP server (optional)
 * @param {Object} mcpLog - MCP logger object (optional)
 * @param {Object} session - Session object from MCP server (optional)
 * @param {string} outputFormat - Output format (text or json)
 * @param {Object} customEnv - Custom environment variables (optional) - Note: AI params override deprecated
 * @param {Object} manualTaskData - Manual task data (optional, for direct task creation without AI)
 * @param {boolean} useResearch - Whether to use the research model (passed to unified service)
 * @param {Object} context - Context object containing session and potentially projectRoot
 * @param {string} [context.projectRoot] - Project root path (for MCP/env fallback)
 * @returns {number} The new task ID
 */
async function addTask(
	tasksPath,
	prompt,
	dependencies = [],
	priority = null,
	context = {},
	outputFormat = 'text', // Default to text for CLI
	manualTaskData = null,
	useResearch = false
) {
	const { session, mcpLog, projectRoot } = context;
	const isMCP = !!mcpLog;

	// Create a consistent logFn object regardless of context
	const logFn = isMCP
		? mcpLog // Use MCP logger if provided
		: {
				// Create a wrapper around consoleLog for CLI
				info: (...args) => consoleLog('info', ...args),
				warn: (...args) => consoleLog('warn', ...args),
				error: (...args) => consoleLog('error', ...args),
				debug: (...args) => consoleLog('debug', ...args),
				success: (...args) => consoleLog('success', ...args)
			};

	const effectivePriority = priority || getDefaultPriority(projectRoot);

	logFn.info(
		`Adding new task with prompt: "${prompt}", Priority: ${effectivePriority}, Dependencies: ${dependencies.join(', ') || 'None'}, Research: ${useResearch}, ProjectRoot: ${projectRoot}`
	);

	let loadingIndicator = null;

	// Create custom reporter that checks for MCP log
	const report = (message, level = 'info') => {
		if (mcpLog) {
			mcpLog[level](message);
		} else if (outputFormat === 'text') {
			consoleLog(level, message);
		}
	};

	try {
		// Only display banner and UI elements for text output (CLI)
		if (outputFormat === 'text') {
			displayBanner();

			console.log(
				boxen(chalk.white.bold(`Creating New Task`), {
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round',
					margin: { top: 1, bottom: 1 }
				})
			);
		}

		// Read the existing tasks
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			report('Invalid or missing tasks.json.', 'error');
			throw new Error('Invalid or missing tasks.json.');
		}

		// Find the highest task ID to determine the next ID
		const highestId =
			data.tasks.length > 0 ? Math.max(...data.tasks.map((t) => t.id)) : 0;
		const newTaskId = highestId + 1;

		// Only show UI box for CLI mode
		if (outputFormat === 'text') {
			console.log(
				boxen(chalk.white.bold(`Creating New Task #${newTaskId}`), {
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round',
					margin: { top: 1, bottom: 1 }
				})
			);
		}

		// Validate dependencies before proceeding
		const invalidDeps = dependencies.filter((depId) => {
			// Ensure depId is parsed as a number for comparison
			const numDepId = parseInt(depId, 10);
			return isNaN(numDepId) || !data.tasks.some((t) => t.id === numDepId);
		});

		if (invalidDeps.length > 0) {
			report(
				`The following dependencies do not exist or are invalid: ${invalidDeps.join(', ')}`,
				'warn'
			);
			report('Removing invalid dependencies...', 'info');
			dependencies = dependencies.filter(
				(depId) => !invalidDeps.includes(depId)
			);
		}
		// Ensure dependencies are numbers
		const numericDependencies = dependencies.map((dep) => parseInt(dep, 10));

		let taskData;

		// Check if manual task data is provided
		if (manualTaskData) {
			report('Using manually provided task data', 'info');
			taskData = manualTaskData;
			report('DEBUG: Taking MANUAL task data path.', 'debug');

			// Basic validation for manual data
			if (
				!taskData.title ||
				typeof taskData.title !== 'string' ||
				!taskData.description ||
				typeof taskData.description !== 'string'
			) {
				throw new Error(
					'Manual task data must include at least a title and description.'
				);
			}
		} else {
			report('DEBUG: Taking AI task generation path.', 'debug');
			// --- Refactored AI Interaction ---
			report('Generating task data with AI...', 'info');

			// Create context string for task creation prompt
			let contextTasks = '';
			if (numericDependencies.length > 0) {
				const dependentTasks = data.tasks.filter((t) =>
					numericDependencies.includes(t.id)
				);
				contextTasks = `\nThis task depends on the following tasks:\n${dependentTasks
					.map((t) => `- Task ${t.id}: ${t.title} - ${t.description}`)
					.join('\n')}`;
			} else {
				const recentTasks = [...data.tasks]
					.sort((a, b) => b.id - a.id)
					.slice(0, 3);
				if (recentTasks.length > 0) {
					contextTasks = `\nRecent tasks in the project:\n${recentTasks
						.map((t) => `- Task ${t.id}: ${t.title} - ${t.description}`)
						.join('\n')}`;
				}
			}

			// System Prompt
			const systemPrompt =
				"You are a helpful assistant that creates well-structured tasks for a software development project. Generate a single new task based on the user's description, adhering strictly to the provided JSON schema.";

			// Task Structure Description (for user prompt)
			const taskStructureDesc = `
      {
        "title": "Task title goes here",
        "description": "A concise one or two sentence description of what the task involves",
        "details": "In-depth implementation details, considerations, and guidance.",
        "testStrategy": "Detailed approach for verifying task completion."
      }`;

			// Add any manually provided details to the prompt for context
			let contextFromArgs = '';
			if (manualTaskData?.title)
				contextFromArgs += `\n- Suggested Title: "${manualTaskData.title}"`;
			if (manualTaskData?.description)
				contextFromArgs += `\n- Suggested Description: "${manualTaskData.description}"`;
			if (manualTaskData?.details)
				contextFromArgs += `\n- Additional Details Context: "${manualTaskData.details}"`;
			if (manualTaskData?.testStrategy)
				contextFromArgs += `\n- Additional Test Strategy Context: "${manualTaskData.testStrategy}"`;

			// User Prompt
			const userPrompt = `Create a comprehensive new task (Task #${newTaskId}) for a software development project based on this description: "${prompt}"
      
      ${contextTasks}
      ${contextFromArgs ? `\nConsider these additional details provided by the user:${contextFromArgs}` : ''}
      
      Return your answer as a single JSON object matching the schema precisely:
      ${taskStructureDesc}
      
      Make sure the details and test strategy are thorough and specific.`;

			// Start the loading indicator - only for text mode
			if (outputFormat === 'text') {
				loadingIndicator = startLoadingIndicator(
					`Generating new task with ${useResearch ? 'Research' : 'Main'} AI...`
				);
			}

			try {
				// Determine the service role based on the useResearch flag
				const serviceRole = useResearch ? 'research' : 'main';

				report('DEBUG: Calling generateObjectService...', 'debug');
				// Call the unified AI service
				const aiGeneratedTaskData = await generateObjectService({
					role: serviceRole, // <-- Use the determined role
					session: session, // Pass session for API key resolution
					projectRoot: projectRoot, // <<< Pass projectRoot here
					schema: AiTaskDataSchema, // Pass the Zod schema
					objectName: 'newTaskData', // Name for the object
					systemPrompt: systemPrompt,
					prompt: userPrompt
				});
				report('DEBUG: generateObjectService returned successfully.', 'debug');

				report('Successfully generated task data from AI.', 'success');
				taskData = aiGeneratedTaskData; // Assign the validated object
			} catch (error) {
				report(
					`DEBUG: generateObjectService caught error: ${error.message}`,
					'debug'
				);
				report(`Error generating task with AI: ${error.message}`, 'error');
				if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
				throw error; // Re-throw error after logging
			} finally {
				report('DEBUG: generateObjectService finally block reached.', 'debug');
				if (loadingIndicator) stopLoadingIndicator(loadingIndicator); // Ensure indicator stops
			}
			// --- End Refactored AI Interaction ---
		}

		// Create the new task object
		const newTask = {
			id: newTaskId,
			title: taskData.title,
			description: taskData.description,
			details: taskData.details || '',
			testStrategy: taskData.testStrategy || '',
			status: 'pending',
			dependencies: numericDependencies, // Use validated numeric dependencies
			priority: effectivePriority,
			subtasks: [] // Initialize with empty subtasks array
		};

		// Add the task to the tasks array
		data.tasks.push(newTask);

		report('DEBUG: Writing tasks.json...', 'debug');
		// Write the updated tasks to the file
		writeJSON(tasksPath, data);
		report('DEBUG: tasks.json written.', 'debug');

		// Generate markdown task files
		report('Generating task files...', 'info');
		report('DEBUG: Calling generateTaskFiles...', 'debug');
		// Pass mcpLog if available to generateTaskFiles
		await generateTaskFiles(tasksPath, path.dirname(tasksPath), { mcpLog });
		report('DEBUG: generateTaskFiles finished.', 'debug');

		// Show success message - only for text output (CLI)
		if (outputFormat === 'text') {
			const table = new Table({
				head: [
					chalk.cyan.bold('ID'),
					chalk.cyan.bold('Title'),
					chalk.cyan.bold('Description')
				],
				colWidths: [5, 30, 50] // Adjust widths as needed
			});

			table.push([
				newTask.id,
				truncate(newTask.title, 27),
				truncate(newTask.description, 47)
			]);

			console.log(chalk.green('✅ New task created successfully:'));
			console.log(table.toString());

			// Helper to get priority color
			const getPriorityColor = (p) => {
				switch (p?.toLowerCase()) {
					case 'high':
						return 'red';
					case 'low':
						return 'gray';
					case 'medium':
					default:
						return 'yellow';
				}
			};

			// Show success message box
			console.log(
				boxen(
					chalk.white.bold(`Task ${newTaskId} Created Successfully`) +
						'\n\n' +
						chalk.white(`Title: ${newTask.title}`) +
						'\n' +
						chalk.white(`Status: ${getStatusWithColor(newTask.status)}`) +
						'\n' +
						chalk.white(
							`Priority: ${chalk[getPriorityColor(newTask.priority)](newTask.priority)}`
						) +
						'\n' +
						(numericDependencies.length > 0
							? chalk.white(`Dependencies: ${numericDependencies.join(', ')}`) +
								'\n'
							: '') +
						'\n' +
						chalk.white.bold('Next Steps:') +
						'\n' +
						chalk.cyan(
							`1. Run ${chalk.yellow(`task-master show ${newTaskId}`)} to see complete task details`
						) +
						'\n' +
						chalk.cyan(
							`2. Run ${chalk.yellow(`task-master set-status --id=${newTaskId} --status=in-progress`)} to start working on it`
						) +
						'\n' +
						chalk.cyan(
							`3. Run ${chalk.yellow(`task-master expand --id=${newTaskId}`)} to break it down into subtasks`
						),
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);
		}

		// Return the new task ID
		report(`DEBUG: Returning new task ID: ${newTaskId}`, 'debug');
		return newTaskId;
	} catch (error) {
		// Stop any loading indicator on error
		if (loadingIndicator) {
			stopLoadingIndicator(loadingIndicator);
		}

		report(`Error adding task: ${error.message}`, 'error');
		if (outputFormat === 'text') {
			console.error(chalk.red(`Error: ${error.message}`));
		}
		// In MCP mode, we let the direct function handler catch and format
		throw error;
	}
}

export default addTask;
