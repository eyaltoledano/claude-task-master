import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { z } from 'zod'; // Keep Zod for post-parsing validation

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
	stopLoadingIndicator
} from '../ui.js';

import { getDebugFlag } from '../config-manager.js';
import generateTaskFiles from './generate-task-files.js';
import { generateTextService } from '../ai-services-unified.js';
import { getModelConfiguration } from './models.js';

// Zod schema for validating the structure of tasks AFTER parsing
const updatedTaskSchema = z
	.object({
		id: z.number().int(),
		title: z.string(),
		description: z.string(),
		status: z.string(),
		dependencies: z.array(z.union([z.number().int(), z.string()])),
		priority: z.string().optional(),
		details: z.string().optional(),
		testStrategy: z.string().optional(),
		subtasks: z.array(z.any()).optional() // Keep subtasks flexible for now
	})
	.strip(); // Allow potential extra fields during parsing if needed, then validate structure
const updatedTaskArraySchema = z.array(updatedTaskSchema);

/**
 * Parses an array of task objects from AI's text response.
 * @param {string} text - Response text from AI.
 * @param {number} expectedCount - Expected number of tasks.
 * @param {Function | Object} logFn - The logging function or MCP log object.
 * @param {boolean} isMCP - Flag indicating if logFn is MCP logger.
 * @returns {Array} Parsed and validated tasks array.
 * @throws {Error} If parsing or validation fails.
 */
function parseUpdatedTasksFromText(text, expectedCount, logFn, isMCP) {
	const report = (level, ...args) => {
		if (isMCP) {
			if (typeof logFn[level] === 'function') logFn[level](...args);
			else logFn.info(...args);
		} else if (!isSilentMode()) {
			// Check silent mode for consoleLog
			consoleLog(level, ...args);
		}
	};

	report(
		'info',
		'Attempting to parse updated tasks array from text response...'
	);
	if (!text || text.trim() === '')
		throw new Error('AI response text is empty.');

	let cleanedResponse = text.trim();
	const originalResponseForDebug = cleanedResponse;
	let parseMethodUsed = 'raw'; // Track which method worked

	// --- NEW Step 1: Try extracting between [] first ---
	const firstBracketIndex = cleanedResponse.indexOf('[');
	const lastBracketIndex = cleanedResponse.lastIndexOf(']');
	let potentialJsonFromArray = null;

	if (firstBracketIndex !== -1 && lastBracketIndex > firstBracketIndex) {
		potentialJsonFromArray = cleanedResponse.substring(
			firstBracketIndex,
			lastBracketIndex + 1
		);
		// Basic check to ensure it's not just "[]" or malformed
		if (potentialJsonFromArray.length <= 2) {
			potentialJsonFromArray = null; // Ignore empty array
		}
	}

	// If [] extraction yielded something, try parsing it immediately
	if (potentialJsonFromArray) {
		try {
			const testParse = JSON.parse(potentialJsonFromArray);
			// It worked! Use this as the primary cleaned response.
			cleanedResponse = potentialJsonFromArray;
			parseMethodUsed = 'brackets';
			report(
				'info',
				'Successfully parsed JSON content extracted between first [ and last ].'
			);
		} catch (e) {
			report(
				'info',
				'Content between [] looked promising but failed initial parse. Proceeding to other methods.'
			);
			// Reset cleanedResponse to original if bracket parsing failed
			cleanedResponse = originalResponseForDebug;
		}
	}

	// --- Step 2: If bracket parsing didn't work or wasn't applicable, try code block extraction ---
	if (parseMethodUsed === 'raw') {
		// Only look for ```json blocks now
		const codeBlockMatch = cleanedResponse.match(
			/```json\s*([\s\S]*?)\s*```/i // Only match ```json
		);
		if (codeBlockMatch) {
			cleanedResponse = codeBlockMatch[1].trim();
			parseMethodUsed = 'codeblock';
			report('info', 'Extracted JSON content from JSON Markdown code block.');
		} else {
			report('info', 'No JSON code block found.');
			// --- Step 3: If code block failed, try stripping prefixes ---
			const commonPrefixes = [
				'json\n',
				'javascript\n', // Keep checking common prefixes just in case
				'python\n',
				'here are the updated tasks:',
				'here is the updated json:',
				'updated tasks:',
				'updated json:',
				'response:',
				'output:'
			];
			let prefixFound = false;
			for (const prefix of commonPrefixes) {
				if (cleanedResponse.toLowerCase().startsWith(prefix)) {
					cleanedResponse = cleanedResponse.substring(prefix.length).trim();
					parseMethodUsed = 'prefix';
					report('info', `Stripped prefix: "${prefix.trim()}"`);
					prefixFound = true;
					break;
				}
			}
			if (!prefixFound) {
				report(
					'warn',
					'Response does not appear to contain [], JSON code block, or known prefix. Attempting raw parse.'
				);
			}
		}
	}

	// --- Step 4: Attempt final parse ---
	let parsedTasks;
	try {
		parsedTasks = JSON.parse(cleanedResponse);
	} catch (parseError) {
		report('error', `Failed to parse JSON array: ${parseError.message}`);
		report(
			'error',
			`Extraction method used: ${parseMethodUsed}` // Log which method failed
		);
		report(
			'error',
			`Problematic JSON string (first 500 chars): ${cleanedResponse.substring(0, 500)}`
		);
		report(
			'error',
			`Original Raw Response (first 500 chars): ${originalResponseForDebug.substring(0, 500)}`
		);
		throw new Error(
			`Failed to parse JSON response array: ${parseError.message}`
		);
	}

	// --- Step 5 & 6: Validate Array structure and Zod schema ---
	if (!Array.isArray(parsedTasks)) {
		report(
			'error',
			`Parsed content is not an array. Type: ${typeof parsedTasks}`
		);
		report(
			'error',
			`Parsed content sample: ${JSON.stringify(parsedTasks).substring(0, 200)}`
		);
		throw new Error('Parsed AI response is not a valid JSON array.');
	}

	report('info', `Successfully parsed ${parsedTasks.length} potential tasks.`);
	if (expectedCount && parsedTasks.length !== expectedCount) {
		report(
			'warn',
			`Expected ${expectedCount} tasks, but parsed ${parsedTasks.length}.`
		);
	}

	const validationResult = updatedTaskArraySchema.safeParse(parsedTasks);
	if (!validationResult.success) {
		report('error', 'Parsed task array failed Zod validation.');
		validationResult.error.errors.forEach((err) => {
			report('error', `  - Path '${err.path.join('.')}': ${err.message}`);
		});
		throw new Error(
			`AI response failed task structure validation: ${validationResult.error.message}`
		);
	}

	report('info', 'Successfully validated task structure.');
	return validationResult.data.slice(
		0,
		expectedCount || validationResult.data.length
	);
}

/**
 * Update tasks based on new context using the unified AI service.
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} fromId - Task ID to start updating from
 * @param {string} prompt - Prompt with new context
 * @param {boolean} [useResearch=false] - Whether to use the research AI role.
 * @param {Object} context - Context object containing session and mcpLog.
 * @param {Object} [context.session] - Session object from MCP server.
 * @param {Object} [context.mcpLog] - MCP logger object.
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
	const { session, mcpLog, projectRoot } = context;
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

		// --- Task Loading/Filtering (Unchanged) ---
		const data = readJSON(tasksPath);
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

		// --- Build Prompts (Unchanged Core Logic) ---
		// Keep the original system prompt logic
		const systemPrompt = `You are an AI assistant helping to update software development tasks based on new context.
You will be given a set of tasks and a prompt describing changes or new implementation details.
Your job is to update the tasks to reflect these changes, while preserving their basic structure.

Guidelines:
1. Maintain the same IDs, statuses, and dependencies unless specifically mentioned in the prompt
2. Update titles, descriptions, details, and test strategies to reflect the new information
3. Do not change anything unnecessarily - just adapt what needs to change based on the prompt
4. You should return ALL the tasks in order, not just the modified ones
5. Return a complete valid JSON object with the updated tasks array
6. VERY IMPORTANT: Preserve all subtasks marked as "done" or "completed" - do not modify their content
7. For tasks with completed subtasks, build upon what has already been done rather than rewriting everything
8. If an existing completed subtask needs to be changed/undone based on the new context, DO NOT modify it directly
9. Instead, add a new subtask that clearly indicates what needs to be changed or replaced
10. Use the existence of completed subtasks as an opportunity to make new subtasks more specific and targeted

The changes described in the prompt should be applied to ALL tasks in the list.`;

		// Keep the original user prompt logic
		const taskDataString = JSON.stringify(tasksToUpdate, null, 2);
		const userPrompt = `Here are the tasks to update:\n${taskDataString}\n\nPlease update these tasks based on the following new context:\n${prompt}\n\nIMPORTANT: In the tasks JSON above, any subtasks with "status": "done" or "status": "completed" should be preserved exactly as is. Build your changes around these completed items.\n\nReturn only the updated tasks as a valid JSON array.`;
		// --- End Build Prompts ---

		let loadingIndicator = null;
		if (outputFormat === 'text') {
			loadingIndicator = startLoadingIndicator('Updating tasks...\n');
		}

		let responseText = '';
		let updatedTasks;

		try {
			// --- Call Unified AI Service ---
			const role = useResearch ? 'research' : 'main';
			if (isMCP) logFn.info(`Using AI service with role: ${role}`);
			else logFn('info', `Using AI service with role: ${role}`);

			responseText = await generateTextService({
				prompt: userPrompt,
				systemPrompt: systemPrompt,
				role,
				session,
				projectRoot
			});
			if (isMCP) logFn.info('Successfully received text response');
			else
				logFn('success', 'Successfully received text response via AI service');
			// --- End AI Service Call ---
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
			throw error; // Re-throw error
		} finally {
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
		}

		// --- Parse and Validate Response ---
		try {
			updatedTasks = parseUpdatedTasksFromText(
				responseText,
				tasksToUpdate.length,
				logFn,
				isMCP
			);
		} catch (parseError) {
			if (isMCP)
				logFn.error(
					`Failed to parse updated tasks from AI response: ${parseError.message}`
				);
			else
				logFn(
					'error',
					`Failed to parse updated tasks from AI response: ${parseError.message}`
				);
			if (getDebugFlag(session)) {
				if (isMCP) logFn.error(`Raw AI Response:\n${responseText}`);
				else logFn('error', `Raw AI Response:\n${responseText}`);
			}
			throw new Error(
				`Failed to parse valid updated tasks from AI response: ${parseError.message}`
			);
		}
		// --- End Parse/Validate ---

		// --- Update Tasks Data (Unchanged) ---
		if (!Array.isArray(updatedTasks)) {
			// Should be caught by parser, but extra check
			throw new Error('Parsed AI response for updated tasks was not an array.');
		}
		if (isMCP)
			logFn.info(`Received ${updatedTasks.length} updated tasks from AI.`);
		else
			logFn('info', `Received ${updatedTasks.length} updated tasks from AI.`);
		// Create a map for efficient lookup
		const updatedTasksMap = new Map(
			updatedTasks.map((task) => [task.id, task])
		);

		// Iterate through the original data and update based on the map
		let actualUpdateCount = 0;
		data.tasks.forEach((task, index) => {
			if (updatedTasksMap.has(task.id)) {
				// Only update if the task was part of the set sent to AI
				data.tasks[index] = updatedTasksMap.get(task.id);
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
		// --- End Update Tasks Data ---

		// --- Write File and Generate (Unchanged) ---
		writeJSON(tasksPath, data);
		if (isMCP)
			logFn.info(
				`Successfully updated ${actualUpdateCount} tasks in ${tasksPath}`
			);
		else
			logFn(
				'success',
				`Successfully updated ${actualUpdateCount} tasks in ${tasksPath}`
			);
		await generateTaskFiles(tasksPath, path.dirname(tasksPath));
		// --- End Write File ---

		// --- Final CLI Output (Unchanged) ---
		if (outputFormat === 'text') {
			console.log(
				boxen(chalk.green(`Successfully updated ${actualUpdateCount} tasks`), {
					padding: 1,
					borderColor: 'green',
					borderStyle: 'round'
				})
			);
		}
		// --- End Final CLI Output ---
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
