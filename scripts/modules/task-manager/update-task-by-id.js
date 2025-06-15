import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { z } from 'zod'; // Keep Zod for post-parse validation

import {
	log as consoleLog,
	readJSON,
	writeJSON,
	truncate,
	isSilentMode,
	flattenTasksWithSubtasks,
	findProjectRoot,
	getCurrentTag
} from '../utils.js';

import {
	getStatusWithColor,
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';

import { generateTextService } from '../ai-services-unified.js';
import { getDebugFlag, isApiKeySet } from '../config-manager.js';
import { ContextGatherer } from '../utils/contextGatherer.js';
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';

// Zod schema for post-parsing validation of the updated task object
const updatedTaskSchema = z
	.object({
		id: z.number().int(),
		title: z.string(), // Title should be preserved, but check it exists
		description: z.string(),
		status: z.string(),
		dependencies: z.array(z.union([z.number().int(), z.string()])),
		priority: z.string().optional(),
		details: z.string().optional(),
		testStrategy: z.string().optional(),
		subtasks: z.array(z.any()).optional()
	})
	.strip(); // Allows parsing even if AI adds extra fields, but validation focuses on schema

/**
 * Parses a single updated task object from AI's text response.
 * @param {string} text - Response text from AI.
 * @param {number} expectedTaskId - The ID of the task expected.
 * @param {Function | Object} logFn - Logging function or MCP logger.
 * @param {boolean} isMCP - Flag indicating MCP context.
 * @returns {Object} Parsed and validated task object.
 * @throws {Error} If parsing or validation fails.
 */
function parseUpdatedTaskFromText(text, expectedTaskId, logFn, isMCP) {
	// Report helper consistent with the established pattern
	const report = (level, ...args) => {
		if (isMCP) {
			if (typeof logFn[level] === 'function') logFn[level](...args);
			else logFn.info(...args);
		} else if (!isSilentMode()) {
			logFn(level, ...args);
		}
	};

	report(
		'info',
		'Attempting to parse updated task object from text response...'
	);
	if (!text || text.trim() === '')
		throw new Error('AI response text is empty.');

	let cleanedResponse = text.trim();
	const originalResponseForDebug = cleanedResponse;
	let parseMethodUsed = 'raw'; // Keep track of which method worked

	// --- NEW Step 1: Try extracting between {} first ---
	const firstBraceIndex = cleanedResponse.indexOf('{');
	const lastBraceIndex = cleanedResponse.lastIndexOf('}');
	let potentialJsonFromBraces = null;

	if (firstBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
		potentialJsonFromBraces = cleanedResponse.substring(
			firstBraceIndex,
			lastBraceIndex + 1
		);
		if (potentialJsonFromBraces.length <= 2) {
			potentialJsonFromBraces = null; // Ignore empty braces {}
		}
	}

	// If {} extraction yielded something, try parsing it immediately
	if (potentialJsonFromBraces) {
		try {
			const testParse = JSON.parse(potentialJsonFromBraces);
			// It worked! Use this as the primary cleaned response.
			cleanedResponse = potentialJsonFromBraces;
			parseMethodUsed = 'braces';
		} catch (e) {
			report(
				'info',
				'Content between {} looked promising but failed initial parse. Proceeding to other methods.'
			);
			// Reset cleanedResponse to original if brace parsing failed
			cleanedResponse = originalResponseForDebug;
		}
	}

	// --- Step 2: If brace parsing didn't work or wasn't applicable, try code block extraction ---
	if (parseMethodUsed === 'raw') {
		const codeBlockMatch = cleanedResponse.match(
			/```(?:json|javascript)?\s*([\s\S]*?)\s*```/i
		);
		if (codeBlockMatch) {
			cleanedResponse = codeBlockMatch[1].trim();
			parseMethodUsed = 'codeblock';
			report('info', 'Extracted JSON content from Markdown code block.');
		} else {
			// --- Step 3: If code block failed, try stripping prefixes ---
			const commonPrefixes = [
				'json\n',
				'javascript\n'
				// ... other prefixes ...
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
					'Response does not appear to contain {}, code block, or known prefix. Attempting raw parse.'
				);
			}
		}
	}

	// --- Step 4: Attempt final parse ---
	let parsedTask;
	try {
		parsedTask = JSON.parse(cleanedResponse);
	} catch (parseError) {
		report('error', `Failed to parse JSON object: ${parseError.message}`);
		report(
			'error',
			`Problematic JSON string (first 500 chars): ${cleanedResponse.substring(0, 500)}`
		);
		report(
			'error',
			`Original Raw Response (first 500 chars): ${originalResponseForDebug.substring(0, 500)}`
		);
		throw new Error(
			`Failed to parse JSON response object: ${parseError.message}`
		);
	}

	if (!parsedTask || typeof parsedTask !== 'object') {
		report(
			'error',
			`Parsed content is not an object. Type: ${typeof parsedTask}`
		);
		report(
			'error',
			`Parsed content sample: ${JSON.stringify(parsedTask).substring(0, 200)}`
		);
		throw new Error('Parsed AI response is not a valid JSON object.');
	}

	// Validate the parsed task object using Zod
	const validationResult = updatedTaskSchema.safeParse(parsedTask);
	if (!validationResult.success) {
		report('error', 'Parsed task object failed Zod validation.');
		validationResult.error.errors.forEach((err) => {
			report('error', `  - Field '${err.path.join('.')}': ${err.message}`);
		});
		throw new Error(
			`AI response failed task structure validation: ${validationResult.error.message}`
		);
	}

	// Final check: ensure ID matches expected ID (AI might hallucinate)
	if (validationResult.data.id !== expectedTaskId) {
		report(
			'warn',
			`AI returned task with ID ${validationResult.data.id}, but expected ${expectedTaskId}. Overwriting ID.`
		);
		validationResult.data.id = expectedTaskId; // Enforce correct ID
	}

	report('info', 'Successfully validated updated task structure.');
	return validationResult.data; // Return the validated task data
}

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

		// --- Input Validations (Keep existing) ---
		if (!Number.isInteger(taskId) || taskId <= 0)
			throw new Error(
				`Invalid task ID: ${taskId}. Task ID must be a positive integer.`
			);
		if (!prompt || typeof prompt !== 'string' || prompt.trim() === '')
			throw new Error('Prompt cannot be empty.');
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

		// Determine project root
		const projectRoot = providedProjectRoot || findProjectRoot();
		if (!projectRoot) {
			throw new Error('Could not determine project root directory');
		}

		// Determine the tag to use
		const currentTag = tag || getCurrentTag(projectRoot) || 'master';

		// --- Task Loading and Status Check (Keep existing) ---
		const data = readJSON(tasksPath, projectRoot, currentTag);
		if (!data || !data.tasks)
			throw new Error(`No valid tasks found in ${tasksPath}.`);
		const taskIndex = data.tasks.findIndex((task) => task.id === taskId);
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
			const contextGatherer = new ContextGatherer(projectRoot);
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
				gatheredContext = contextResult;
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

		// --- Build Prompts (Different for append vs full update) ---
		let systemPrompt;
		let userPrompt;

		if (appendMode) {
			// Append mode: generate new content to add to task details
			systemPrompt = `You are an AI assistant helping to append additional information to a software development task. You will be provided with the task's existing details, context, and a user request string.

Your Goal: Based *only* on the user's request and all the provided context (including existing details if relevant to the request), GENERATE the new text content that should be added to the task's details.
Focus *only* on generating the substance of the update.

Output Requirements:
1. Return *only* the newly generated text content as a plain string. Do NOT return a JSON object or any other structured data.
2. Your string response should NOT include any of the task's original details, unless the user's request explicitly asks to rephrase, summarize, or directly modify existing text.
3. Do NOT include any timestamps, XML-like tags, markdown, or any other special formatting in your string response.
4. Ensure the generated text is concise yet complete for the update based on the user request. Avoid conversational fillers or explanations about what you are doing (e.g., do not start with "Okay, here's the update...").`;

			const taskContext = `
Task: ${JSON.stringify({
				id: taskToUpdate.id,
				title: taskToUpdate.title,
				description: taskToUpdate.description,
				status: taskToUpdate.status
			})}
Current Task Details (for context only):\n${taskToUpdate.details || '(No existing details)'}
`;

			userPrompt = `Task Context:\n${taskContext}\n\nUser Request: "${prompt}"\n\nBased on the User Request and all the Task Context (including current task details provided above), what is the new information or text that should be appended to this task's details? Return ONLY this new text as a plain string.`;

			if (gatheredContext) {
				userPrompt += `\n\n# Additional Project Context\n\n${gatheredContext}`;
			}
		} else {
			// Full update mode: use original prompts
			systemPrompt = `You are an AI assistant helping to update a software development task based on new context.
You will be given a task and a prompt describing changes or new implementation details.
Your job is to update the task to reflect these changes, while preserving its basic structure.

Guidelines:
1. VERY IMPORTANT: NEVER change the title of the task - keep it exactly as is
2. Maintain the same ID, status, and dependencies unless specifically mentioned in the prompt
3. Update the description, details, and test strategy to reflect the new information
4. Do not change anything unnecessarily - just adapt what needs to change based on the prompt
5. Return a complete valid JSON object representing the updated task
6. VERY IMPORTANT: Preserve all subtasks marked as "done" or "completed" - do not modify their content
7. For tasks with completed subtasks, build upon what has already been done rather than rewriting everything
8. If an existing completed subtask needs to be changed/undone based on the new context, DO NOT modify it directly
9. Instead, add a new subtask that clearly indicates what needs to be changed or replaced
10. Use the existence of completed subtasks as an opportunity to make new subtasks more specific and targeted
11. Ensure any new subtasks have unique IDs that don't conflict with existing ones

The changes described in the prompt should be thoughtfully applied to make the task more accurate and actionable.`;

			const taskDataString = JSON.stringify(taskToUpdate, null, 2);
			userPrompt = `Here is the task to update:\n${taskDataString}\n\nPlease update this task based on the following new context:\n${prompt}\n\nIMPORTANT: In the task JSON above, any subtasks with "status": "done" or "status": "completed" should be preserved exactly as is. Build your changes around these completed items.`;

			if (gatheredContext) {
				userPrompt += `\n\n# Project Context\n\n${gatheredContext}`;
			}

			userPrompt += `\n\nReturn only the updated task as a valid JSON object.`;
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
			aiServiceResponse = await generateTextService({
				role: serviceRole,
				session: session,
				projectRoot: projectRoot,
				systemPrompt: systemPrompt,
				prompt: userPrompt,
				commandName: 'update-task',
				outputType: isMCP ? 'mcp' : 'cli'
			});

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
				writeJSON(tasksPath, data, projectRoot, currentTag);
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

			// Full update mode: Use mainResult (text) for parsing
			const updatedTask = parseUpdatedTaskFromText(
				aiServiceResponse.mainResult,
				taskId,
				logFn,
				isMCP
			);

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
			writeJSON(tasksPath, data, projectRoot, currentTag);
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
