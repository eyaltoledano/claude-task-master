import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

import {
	log as consoleLog,
	readJSON,
	writeJSON,
	truncate,
	isSilentMode,
	flattenTasksWithSubtasks,
	findProjectRoot
} from '../utils.js';

import {
	getStatusWithColor,
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';

import {
	generateTextService,
	generateObjectService
} from '../ai-services-unified.js';
import { COMMAND_SCHEMAS } from '../../../src/schemas/registry.js';
import {
	getDebugFlag,
	isApiKeySet,
	hasCodebaseAnalysis
} from '../config-manager.js';
import { getPromptManager } from '../prompt-manager.js';
import { ContextGatherer } from '../utils/contextGatherer.js';
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';
import { createTmCore } from '@tm/core';

/**
 * Update a task by ID with new information using the unified AI service.
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} taskId - ID of the task to update
 * @param {string} prompt - Prompt for generating updated task information
 * @param {boolean} [useResearch=false] - Whether to use the research AI role.
 * @param {Object} context - Context object containing session and mcpLog.
 * @param {Object} [context.session] - Session object from MCP server.
 * @param {Object} [context.mcpLog] - MCP logger object.
 * @param {string} [context.projectRoot] - Project root path.
 * @param {string} [context.tag] - Tag for the task
 * @param {string} [outputFormat='text'] - Output format ('text' or 'json').
 * @param {boolean} [appendMode=false] - If true, append to details instead of full update.
 * @returns {Promise<Object|null>} - The updated task or null if update failed.
 */
async function updateTaskById(
	tasksPath,
	taskId,
	prompt,
	useResearch = false,
	context = {},
	outputFormat = 'text',
	appendMode = false
) {
	const { session, mcpLog, projectRoot: providedProjectRoot, tag } = context;
	const logFn = mcpLog || consoleLog;
	const isMCP = !!mcpLog;

	// Use report helper for logging
	const report = (level, ...args) => {
		if (isMCP) {
			if (typeof logFn[level] === 'function') logFn[level](...args);
			else logFn.info(...args);
		} else if (!isSilentMode()) {
			logFn(level, ...args);
		}
	};

	try {
		report('info', `Updating single task ${taskId} with prompt: "${prompt}"`);

		// --- Input Validations ---
		// Note: taskId can be a number (1), string with dot (1.2), or display ID (HAM-123)
		// So we don't validate it as strictly anymore
		if (taskId === null || taskId === undefined || String(taskId).trim() === '')
			throw new Error('Task ID cannot be empty.');

		if (!prompt || typeof prompt !== 'string' || prompt.trim() === '')
			throw new Error('Prompt cannot be empty.');

		// Determine project root first (needed for API key checks)
		const projectRoot = providedProjectRoot || findProjectRoot();
		if (!projectRoot) {
			throw new Error('Could not determine project root directory');
		}

		if (useResearch && !isApiKeySet('perplexity', session)) {
			report(
				'warn',
				'Perplexity research requested but API key not set. Falling back.'
			);
			if (outputFormat === 'text')
				console.log(
					chalk.yellow('Perplexity AI not available. Falling back to main AI.')
				);
			useResearch = false;
		}

		if (!fs.existsSync(tasksPath))
			throw new Error(`Tasks file not found: ${tasksPath}`);
		// --- End Input Validations ---

		// --- BRIDGE: Check if using API storage and handle via tm-core ---
		try {
			const tmCore = await createTmCore({
				projectPath: projectRoot || process.cwd()
			});

			// Check if we're using API storage (use resolved storage type, not config)
			const storageType = tmCore.tasks.getStorageType();

			if (storageType === 'api') {
				report('info', `Delegating update to Hamster for task ${taskId}`);

				// For API storage, use the new updateTaskWithPrompt method
				// which calls the remote AI service
				const mode = appendMode ? 'append' : 'update';

				if (!isMCP && outputFormat === 'text') {
					console.log(
						boxen(
							chalk.blue.bold(`Updating Task via Hamster`) +
								'\n\n' +
								chalk.white(`Task ID: ${taskId}`) +
								'\n' +
								chalk.white(`Mode: ${mode}`) +
								'\n' +
								chalk.white(
									`Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`
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

				let loadingIndicator = null;
				if (!isMCP && outputFormat === 'text') {
					loadingIndicator = startLoadingIndicator(
						'Updating task on Hamster...\n'
					);
				}

				try {
					// Call the API storage method which handles the remote update
					await tmCore.tasks.updateWithPrompt(taskId, prompt, tag, { mode });

					if (loadingIndicator)
						stopLoadingIndicator(
							loadingIndicator,
							'Task updated successfully.'
						);

					if (outputFormat === 'text') {
						console.log(
							boxen(
								chalk.green(
									`Successfully updated task ${taskId} via remote AI`
								) +
									'\n\n' +
									chalk.white(
										'The task has been updated on the remote server.'
									) +
									'\n' +
									chalk.white(
										`Run ${chalk.yellow(`task-master show ${taskId}`)} to view the updated task.`
									),
								{
									padding: 1,
									borderColor: 'green',
									borderStyle: 'round'
								}
							)
						);
					}

					// Return success result
					return {
						success: true,
						taskId: taskId,
						message: 'Task updated via remote AI service'
					};
				} catch (updateError) {
					if (loadingIndicator) stopLoadingIndicator(loadingIndicator);

					throw new Error(
						`Failed to update task via API: ${updateError.message}`
					);
				}
			}

			// If not API storage, fall through to local file-based update logic below
			report(
				'info',
				`Using file storage - processing update locally for task ${taskId}`
			);
		} catch (tmCoreError) {
			report(
				'warn',
				`TmCore check failed, falling back to legacy file-based update: ${tmCoreError.message}`
			);
			// Fall through to existing logic
		}
		// --- End BRIDGE ---

		// --- Task Loading and Status Check (Keep existing) ---
		const data = readJSON(tasksPath, projectRoot, tag);
		if (!data || !data.tasks)
			throw new Error(`No valid tasks found in ${tasksPath}.`);
		// Convert taskId to number for comparison if it's a numeric string
		const numericTaskId = Number.isInteger(taskId)
			? taskId
			: parseInt(taskId, 10);
		const taskIndex = data.tasks.findIndex((task) => task.id === numericTaskId);
		if (taskIndex === -1) throw new Error(`Task with ID ${taskId} not found.`);
		const taskToUpdate = data.tasks[taskIndex];
		if (taskToUpdate.status === 'done' || taskToUpdate.status === 'completed') {
			report(
				'warn',
				`Task ${taskId} is already marked as done and cannot be updated`
			);

			// Only show warning box for text output (CLI)
			if (outputFormat === 'text') {
				console.log(
					boxen(
						chalk.yellow(
							`Task ${taskId} is already marked as ${taskToUpdate.status} and cannot be updated.`
						) +
							'\n\n' +
							chalk.white(
								'Completed tasks are locked to maintain consistency. To modify a completed task, you must first:'
							) +
							'\n' +
							chalk.white(
								'1. Change its status to "pending" or "in-progress"'
							) +
							'\n' +
							chalk.white('2. Then run the update-task command'),
						{ padding: 1, borderColor: 'yellow', borderStyle: 'round' }
					)
				);
			}
			return null;
		}
		// --- End Task Loading ---

		// --- Context Gathering ---
		let gatheredContext = '';
		try {
			const contextGatherer = new ContextGatherer(projectRoot, tag);
			const allTasksFlat = flattenTasksWithSubtasks(data.tasks);
			const fuzzySearch = new FuzzyTaskSearch(allTasksFlat, 'update-task');
			const searchQuery = `${taskToUpdate.title} ${taskToUpdate.description} ${prompt}`;
			const searchResults = fuzzySearch.findRelevantTasks(searchQuery, {
				maxResults: 5,
				includeSelf: true
			});
			const relevantTaskIds = fuzzySearch.getTaskIds(searchResults);

			const finalTaskIds = [
				...new Set([taskId.toString(), ...relevantTaskIds])
			];

			if (finalTaskIds.length > 0) {
				const contextResult = await contextGatherer.gather({
					tasks: finalTaskIds,
					format: 'research'
				});
				gatheredContext = contextResult.context || '';
			}
		} catch (contextError) {
			report('warn', `Could not gather context: ${contextError.message}`);
		}
		// --- End Context Gathering ---

		// --- Display Task Info (CLI Only - Keep existing) ---
		if (outputFormat === 'text') {
			// Show the task that will be updated
			const table = new Table({
				head: [
					chalk.cyan.bold('ID'),
					chalk.cyan.bold('Title'),
					chalk.cyan.bold('Status')
				],
				colWidths: [5, 60, 10]
			});

			table.push([
				taskToUpdate.id,
				truncate(taskToUpdate.title, 57),
				getStatusWithColor(taskToUpdate.status)
			]);

			console.log(
				boxen(chalk.white.bold(`Updating Task #${taskId}`), {
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

		// --- Build Prompts using PromptManager ---
		const promptManager = getPromptManager();

		const promptParams = {
			task: taskToUpdate,
			taskJson: JSON.stringify(taskToUpdate, null, 2),
			updatePrompt: prompt,
			appendMode: appendMode,
			useResearch: useResearch,
			currentDetails: taskToUpdate.details || '(No existing details)',
			gatheredContext: gatheredContext || '',
			hasCodebaseAnalysis: hasCodebaseAnalysis(
				useResearch,
				projectRoot,
				session
			),
			projectRoot: projectRoot
		};

		const variantKey = appendMode
			? 'append'
			: useResearch
				? 'research'
				: 'default';

		report(
			'info',
			`Loading prompt template with variant: ${variantKey}, appendMode: ${appendMode}, useResearch: ${useResearch}`
		);

		let systemPrompt;
		let userPrompt;
		try {
			const promptResult = await promptManager.loadPrompt(
				'update-task',
				promptParams,
				variantKey
			);
			report(
				'info',
				`Prompt result type: ${typeof promptResult}, keys: ${promptResult ? Object.keys(promptResult).join(', ') : 'null'}`
			);

			// Extract prompts - loadPrompt returns { systemPrompt, userPrompt, metadata }
			systemPrompt = promptResult.systemPrompt;
			userPrompt = promptResult.userPrompt;

			report(
				'info',
				`Loaded prompts - systemPrompt length: ${systemPrompt?.length}, userPrompt length: ${userPrompt?.length}`
			);
		} catch (error) {
			report('error', `Failed to load prompt template: ${error.message}`);
			throw new Error(`Failed to load prompt template: ${error.message}`);
		}

		// If prompts are still not set, throw an error
		if (!systemPrompt || !userPrompt) {
			throw new Error(
				`Failed to load prompts: systemPrompt=${!!systemPrompt}, userPrompt=${!!userPrompt}`
			);
		}
		// --- End Build Prompts ---

		let loadingIndicator = null;
		let aiServiceResponse = null;

		if (!isMCP && outputFormat === 'text') {
			loadingIndicator = startLoadingIndicator(
				useResearch ? 'Updating task with research...\n' : 'Updating task...\n'
			);
		}

		try {
			const serviceRole = useResearch ? 'research' : 'main';

			if (appendMode) {
				// Append mode still uses generateTextService since it returns plain text
				aiServiceResponse = await generateTextService({
					role: serviceRole,
					session: session,
					projectRoot: projectRoot,
					systemPrompt: systemPrompt,
					prompt: userPrompt,
					commandName: 'update-task',
					outputType: isMCP ? 'mcp' : 'cli'
				});
			} else {
				// Full update mode uses generateObjectService for structured output
				aiServiceResponse = await generateObjectService({
					role: serviceRole,
					session: session,
					projectRoot: projectRoot,
					systemPrompt: systemPrompt,
					prompt: userPrompt,
					schema: COMMAND_SCHEMAS['update-task-by-id'],
					objectName: 'task',
					commandName: 'update-task',
					outputType: isMCP ? 'mcp' : 'cli'
				});
			}

			if (loadingIndicator)
				stopLoadingIndicator(loadingIndicator, 'AI update complete.');

			if (appendMode) {
				// Append mode: handle as plain text
				const generatedContentString = aiServiceResponse.mainResult;
				let newlyAddedSnippet = '';

				if (generatedContentString && generatedContentString.trim()) {
					const timestamp = new Date().toISOString();
					const formattedBlock = `<info added on ${timestamp}>\n${generatedContentString.trim()}\n</info added on ${timestamp}>`;
					newlyAddedSnippet = formattedBlock;

					// Append to task details
					taskToUpdate.details =
						(taskToUpdate.details ? taskToUpdate.details + '\n' : '') +
						formattedBlock;
				} else {
					report(
						'warn',
						'AI response was empty or whitespace after trimming. Original details remain unchanged.'
					);
					newlyAddedSnippet = 'No new details were added by the AI.';
				}

				// Update description with timestamp if prompt is short
				if (prompt.length < 100) {
					if (taskToUpdate.description) {
						taskToUpdate.description += ` [Updated: ${new Date().toLocaleDateString()}]`;
					}
				}

				// Write the updated task back to file
				data.tasks[taskIndex] = taskToUpdate;
				writeJSON(tasksPath, data, projectRoot, tag);
				report('success', `Successfully appended to task ${taskId}`);

				// Display success message for CLI
				if (outputFormat === 'text') {
					console.log(
						boxen(
							chalk.green(`Successfully appended to task #${taskId}`) +
								'\n\n' +
								chalk.white.bold('Title:') +
								' ' +
								taskToUpdate.title +
								'\n\n' +
								chalk.white.bold('Newly Added Content:') +
								'\n' +
								chalk.white(newlyAddedSnippet),
							{ padding: 1, borderColor: 'green', borderStyle: 'round' }
						)
					);
				}

				// Display AI usage telemetry for CLI users
				if (outputFormat === 'text' && aiServiceResponse.telemetryData) {
					displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
				}

				// Return the updated task
				return {
					updatedTask: taskToUpdate,
					telemetryData: aiServiceResponse.telemetryData,
					tagInfo: aiServiceResponse.tagInfo
				};
			}

			// Full update mode: Use structured data directly
			const updatedTask = aiServiceResponse.mainResult.task;

			// --- Task Validation/Correction (Keep existing logic) ---
			if (!updatedTask || typeof updatedTask !== 'object')
				throw new Error('Received invalid task object from AI.');
			if (!updatedTask.title || !updatedTask.description)
				throw new Error('Updated task missing required fields.');
			// Preserve ID if AI changed it
			if (updatedTask.id !== taskId) {
				report('warn', `AI changed task ID. Restoring original ID ${taskId}.`);
				updatedTask.id = taskId;
			}
			// Preserve status if AI changed it
			if (
				updatedTask.status !== taskToUpdate.status &&
				!prompt.toLowerCase().includes('status')
			) {
				report(
					'warn',
					`AI changed task status. Restoring original status '${taskToUpdate.status}'.`
				);
				updatedTask.status = taskToUpdate.status;
			}
			// Fix subtask IDs if they exist (ensure they are numeric and sequential)
			if (updatedTask.subtasks && Array.isArray(updatedTask.subtasks)) {
				let currentSubtaskId = 1;
				updatedTask.subtasks = updatedTask.subtasks.map((subtask) => {
					// Fix AI-generated subtask IDs that might be strings or use parent ID as prefix
					const correctedSubtask = {
						...subtask,
						id: currentSubtaskId, // Override AI-generated ID with correct sequential ID
						dependencies: Array.isArray(subtask.dependencies)
							? subtask.dependencies
									.map((dep) =>
										typeof dep === 'string' ? parseInt(dep, 10) : dep
									)
									.filter(
										(depId) =>
											!Number.isNaN(depId) &&
											depId >= 1 &&
											depId < currentSubtaskId
									)
							: [],
						status: subtask.status || 'pending'
					};
					currentSubtaskId++;
					return correctedSubtask;
				});
				report(
					'info',
					`Fixed ${updatedTask.subtasks.length} subtask IDs to be sequential numeric IDs.`
				);
			}

			// Preserve completed subtasks (Keep existing logic)
			if (taskToUpdate.subtasks?.length > 0) {
				if (!updatedTask.subtasks) {
					report(
						'warn',
						'Subtasks removed by AI. Restoring original subtasks.'
					);
					updatedTask.subtasks = taskToUpdate.subtasks;
				} else {
					const completedOriginal = taskToUpdate.subtasks.filter(
						(st) => st.status === 'done' || st.status === 'completed'
					);
					completedOriginal.forEach((compSub) => {
						const updatedSub = updatedTask.subtasks.find(
							(st) => st.id === compSub.id
						);
						if (
							!updatedSub ||
							JSON.stringify(updatedSub) !== JSON.stringify(compSub)
						) {
							report(
								'warn',
								`Completed subtask ${compSub.id} was modified or removed. Restoring.`
							);
							// Remove potentially modified version
							updatedTask.subtasks = updatedTask.subtasks.filter(
								(st) => st.id !== compSub.id
							);
							// Add back original
							updatedTask.subtasks.push(compSub);
						}
					});
					// Deduplicate just in case
					const subtaskIds = new Set();
					updatedTask.subtasks = updatedTask.subtasks.filter((st) => {
						if (!subtaskIds.has(st.id)) {
							subtaskIds.add(st.id);
							return true;
						}
						report('warn', `Duplicate subtask ID ${st.id} removed.`);
						return false;
					});
				}
			}
			// --- End Task Validation/Correction ---

			// --- Update Task Data (Keep existing) ---
			data.tasks[taskIndex] = updatedTask;
			// --- End Update Task Data ---

			// --- Write File and Generate (Unchanged) ---
			writeJSON(tasksPath, data, projectRoot, tag);
			report('success', `Successfully updated task ${taskId}`);
			// await generateTaskFiles(tasksPath, path.dirname(tasksPath));
			// --- End Write File ---

			// --- Display CLI Telemetry ---
			if (outputFormat === 'text' && aiServiceResponse.telemetryData) {
				displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli'); // <<< ADD display
			}

			// --- Return Success with Telemetry ---
			return {
				updatedTask: updatedTask, // Return the updated task object
				telemetryData: aiServiceResponse.telemetryData, // <<< ADD telemetryData
				tagInfo: aiServiceResponse.tagInfo
			};
		} catch (error) {
			// Catch errors from generateTextService
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
			report('error', `Error during AI service call: ${error.message}`);
			if (error.message.includes('API key')) {
				report('error', 'Please ensure API keys are configured correctly.');
			}
			throw error; // Re-throw error
		}
	} catch (error) {
		// General error catch
		// --- General Error Handling (Keep existing) ---
		report('error', `Error updating task: ${error.message}`);
		if (outputFormat === 'text') {
			console.error(chalk.red(`Error: ${error.message}`));
			// ... helpful hints ...
			if (getDebugFlag(session)) console.error(error);
			process.exit(1);
		} else {
			throw error; // Re-throw for MCP
		}
		return null; // Indicate failure in CLI case if process doesn't exit
		// --- End General Error Handling ---
	}
}

export default updateTaskById;
