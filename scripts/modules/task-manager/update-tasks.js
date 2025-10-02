import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

import {
	log as consoleLog,
	readJSON,
	writeJSON,
	truncate,
	isSilentMode
} from '../utils.js';

import {
	getStatusWithColor,
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';

import { getDebugFlag, hasCodebaseAnalysis } from '../config-manager.js';
import { getPromptManager } from '../prompt-manager.js';
import generateTaskFiles from './generate-task-files.js';
import { generateObjectService } from '../ai-services-unified.js';
import { COMMAND_SCHEMAS } from '../../../src/schemas/registry.js';
import { getModelConfiguration } from './models.js';
import { ContextGatherer } from '../utils/contextGatherer.js';
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';
import { flattenTasksWithSubtasks, findProjectRoot } from '../utils.js';

/**
 * Update tasks based on new context using the unified AI service.
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} fromId - Task ID to start updating from
 * @param {string} prompt - Prompt with new context
 * @param {boolean} [useResearch=false] - Whether to use the research AI role.
 * @param {Object} context - Context object containing session and mcpLog.
 * @param {Object} [context.session] - Session object from MCP server.
 * @param {Object} [context.mcpLog] - MCP logger object.
 * @param {string} [context.tag] - Tag for the task
 * @param {string} [outputFormat='text'] - Output format ('text' or 'json').
 */
async function updateTasks(
	tasksPath,
	fromId,
	prompt,
	useResearch = false,
	context = {},
	outputFormat = 'text' // Default to text for CLI
) {
	const { session, mcpLog, projectRoot: providedProjectRoot, tag } = context;
	// Use mcpLog if available, otherwise use the imported consoleLog function
	const logFn = mcpLog || consoleLog;
	// Flag to easily check which logger type we have
	const isMCP = !!mcpLog;

	if (isMCP)
		logFn.info(`updateTasks called with context: session=${!!session}`);
	else logFn('info', `updateTasks called`); // CLI log

	try {
		if (isMCP) logFn.info(`Updating tasks from ID ${fromId}`);
		else
			logFn(
				'info',
				`Updating tasks from ID ${fromId} with prompt: "${prompt}"`
			);

		// Determine project root
		const projectRoot = providedProjectRoot || findProjectRoot();
		if (!projectRoot) {
			throw new Error('Could not determine project root directory');
		}

		// --- Task Loading/Filtering (Updated to pass projectRoot and tag) ---
		const data = readJSON(tasksPath, projectRoot, tag);
		if (!data || !data.tasks)
			throw new Error(`No valid tasks found in ${tasksPath}`);
		const tasksToUpdate = data.tasks.filter(
			(task) => task.id >= fromId && task.status !== 'done'
		);
		if (tasksToUpdate.length === 0) {
			if (isMCP)
				logFn.info(`No tasks to update (ID >= ${fromId} and not 'done').`);
			else
				logFn('info', `No tasks to update (ID >= ${fromId} and not 'done').`);
			if (outputFormat === 'text') console.log(/* yellow message */);
			return; // Nothing to do
		}
		// --- End Task Loading/Filtering ---

		// --- Context Gathering ---
		let gatheredContext = '';
		try {
			const contextGatherer = new ContextGatherer(projectRoot, tag);
			const allTasksFlat = flattenTasksWithSubtasks(data.tasks);
			const fuzzySearch = new FuzzyTaskSearch(allTasksFlat, 'update');
			const searchResults = fuzzySearch.findRelevantTasks(prompt, {
				maxResults: 5,
				includeSelf: true
			});
			const relevantTaskIds = fuzzySearch.getTaskIds(searchResults);

			const tasksToUpdateIds = tasksToUpdate.map((t) => t.id.toString());
			const finalTaskIds = [
				...new Set([...tasksToUpdateIds, ...relevantTaskIds])
			];

			if (finalTaskIds.length > 0) {
				const contextResult = await contextGatherer.gather({
					tasks: finalTaskIds,
					format: 'research'
				});
				gatheredContext = contextResult.context || '';
			}
		} catch (contextError) {
			logFn(
				'warn',
				`Could not gather additional context: ${contextError.message}`
			);
		}
		// --- End Context Gathering ---

		// --- Display Tasks to Update (CLI Only - Unchanged) ---
		if (outputFormat === 'text') {
			// Show the tasks that will be updated
			const table = new Table({
				head: [
					chalk.cyan.bold('ID'),
					chalk.cyan.bold('Title'),
					chalk.cyan.bold('Status')
				],
				colWidths: [5, 70, 20]
			});

			tasksToUpdate.forEach((task) => {
				table.push([
					task.id,
					truncate(task.title, 57),
					getStatusWithColor(task.status)
				]);
			});

			console.log(
				boxen(chalk.white.bold(`Updating ${tasksToUpdate.length} tasks`), {
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round',
					margin: { top: 1, bottom: 0 }
				})
			);

			console.log(table.toString());

			// Display a message about how completed subtasks are handled
			console.log(
				boxen(
					chalk.cyan.bold('How Completed Subtasks Are Handled:') +
						'\n\n' +
						chalk.white(
							'• Subtasks marked as "done" or "completed" will be preserved\n'
						) +
						chalk.white(
							'• New subtasks will build upon what has already been completed\n'
						) +
						chalk.white(
							'• If completed work needs revision, a new subtask will be created instead of modifying done items\n'
						) +
						chalk.white(
							'• This approach maintains a clear record of completed work and new requirements'
						),
					{
						padding: 1,
						borderColor: 'blue',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					}
				)
			);
		}
		// --- End Display Tasks ---

		// --- Build Prompts (Using PromptManager) ---
		// Load prompts using PromptManager
		const promptManager = getPromptManager();
		const { systemPrompt, userPrompt } = await promptManager.loadPrompt(
			'update-tasks',
			{
				tasks: tasksToUpdate,
				updatePrompt: prompt,
				useResearch,
				projectContext: gatheredContext,
				hasCodebaseAnalysis: hasCodebaseAnalysis(
					useResearch,
					projectRoot,
					session
				),
				projectRoot: projectRoot
			}
		);
		// --- End Build Prompts ---

		// --- AI Call ---
		let loadingIndicator = null;
		let aiServiceResponse = null;

		if (!isMCP && outputFormat === 'text') {
			loadingIndicator = startLoadingIndicator('Updating tasks with AI...\n');
		}

		try {
			// Determine role based on research flag
			const serviceRole = useResearch ? 'research' : 'main';

			// Call the unified AI service with generateObject
			aiServiceResponse = await generateObjectService({
				role: serviceRole,
				session: session,
				projectRoot: projectRoot,
				systemPrompt: systemPrompt,
				prompt: userPrompt,
				schema: COMMAND_SCHEMAS['update-tasks'],
				objectName: 'tasks',
				commandName: 'update-tasks',
				outputType: isMCP ? 'mcp' : 'cli'
			});

			if (loadingIndicator)
				stopLoadingIndicator(loadingIndicator, 'AI update complete.');

			// With generateObject, we get structured data directly
			const parsedUpdatedTasks = aiServiceResponse.mainResult.tasks;

			// --- Update Tasks Data (Updated writeJSON call) ---
			if (!Array.isArray(parsedUpdatedTasks)) {
				// Should be caught by parser, but extra check
				throw new Error(
					'Parsed AI response for updated tasks was not an array.'
				);
			}
			if (isMCP)
				logFn.info(
					`Received ${parsedUpdatedTasks.length} updated tasks from AI.`
				);
			else
				logFn(
					'info',
					`Received ${parsedUpdatedTasks.length} updated tasks from AI.`
				);
			// Create a map for efficient lookup
			const updatedTasksMap = new Map(
				parsedUpdatedTasks.map((task) => [task.id, task])
			);

			let actualUpdateCount = 0;
			data.tasks.forEach((task, index) => {
				if (updatedTasksMap.has(task.id)) {
					// Only update if the task was part of the set sent to AI
					const updatedTask = updatedTasksMap.get(task.id);
					// Merge the updated task with the existing one to preserve fields like subtasks
					data.tasks[index] = {
						...task, // Keep all existing fields
						...updatedTask, // Override with updated fields
						// Ensure subtasks field is preserved if not provided by AI
						subtasks:
							updatedTask.subtasks !== undefined
								? updatedTask.subtasks
								: task.subtasks
					};
					actualUpdateCount++;
				}
			});
			if (isMCP)
				logFn.info(
					`Applied updates to ${actualUpdateCount} tasks in the dataset.`
				);
			else
				logFn(
					'info',
					`Applied updates to ${actualUpdateCount} tasks in the dataset.`
				);

			// Fix: Pass projectRoot and currentTag to writeJSON
			writeJSON(tasksPath, data, projectRoot, tag);
			if (isMCP)
				logFn.info(
					`Successfully updated ${actualUpdateCount} tasks in ${tasksPath}`
				);
			else
				logFn(
					'success',
					`Successfully updated ${actualUpdateCount} tasks in ${tasksPath}`
				);
			// await generateTaskFiles(tasksPath, path.dirname(tasksPath));

			if (outputFormat === 'text' && aiServiceResponse.telemetryData) {
				displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
			}

			return {
				success: true,
				updatedTasks: parsedUpdatedTasks,
				telemetryData: aiServiceResponse.telemetryData,
				tagInfo: aiServiceResponse.tagInfo
			};
		} catch (error) {
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
			if (isMCP) logFn.error(`Error during AI service call: ${error.message}`);
			else logFn('error', `Error during AI service call: ${error.message}`);
			if (error.message.includes('API key')) {
				if (isMCP)
					logFn.error(
						'Please ensure API keys are configured correctly in .env or mcp.json.'
					);
				else
					logFn(
						'error',
						'Please ensure API keys are configured correctly in .env or mcp.json.'
					);
			}
			throw error;
		} finally {
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
		}
	} catch (error) {
		// --- General Error Handling (Unchanged) ---
		if (isMCP) logFn.error(`Error updating tasks: ${error.message}`);
		else logFn('error', `Error updating tasks: ${error.message}`);
		if (outputFormat === 'text') {
			console.error(chalk.red(`Error: ${error.message}`));
			if (getDebugFlag(session)) {
				console.error(error);
			}
			process.exit(1);
		} else {
			throw error; // Re-throw for MCP/programmatic callers
		}
		// --- End General Error Handling ---
	}
}

export default updateTasks;
