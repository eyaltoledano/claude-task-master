import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

import {
	getStatusWithColor,
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';
import {
	log as consoleLog,
	readJSON,
	writeJSON,
	truncate,
	isSilentMode,
	findProjectRoot,
	flattenTasksWithSubtasks,
	getCurrentTag
} from '../utils.js';
import { generateTextService } from '../ai-services-unified.js';
import { getDebugFlag } from '../config-manager.js';
import generateTaskFiles from './generate-task-files.js';
import { ContextGatherer } from '../utils/contextGatherer.js';
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';

/**
 * Update a subtask by appending additional timestamped information using the unified AI service.
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} subtaskId - ID of the subtask to update in format "parentId.subtaskId"
 * @param {string} prompt - Prompt for generating additional information
 * @param {boolean} [useResearch=false] - Whether to use the research AI role.
 * @param {Object} context - Context object containing session and mcpLog.
 * @param {Object} [context.session] - Session object from MCP server.
 * @param {Object} [context.mcpLog] - MCP logger object.
 * @param {string} [context.projectRoot] - Project root path (needed for AI service key resolution).
 * @param {string} [outputFormat='text'] - Output format ('text' or 'json'). Automatically 'json' if mcpLog is present.
 * @returns {Promise<Object|null>} - The updated subtask or null if update failed.
 */
async function updateSubtaskById(
	tasksPath,
	subtaskId,
	prompt,
	useResearch = false,
	context = {},
	outputFormat = context.mcpLog ? 'json' : 'text'
) {
	const { session, mcpLog, projectRoot: providedProjectRoot, tag } = context;
	const logFn = mcpLog || consoleLog;
	const isMCP = !!mcpLog;

	// Report helper
	const report = (level, ...args) => {
		if (isMCP) {
			if (typeof logFn[level] === 'function') logFn[level](...args);
			else logFn.info(...args);
		} else if (!isSilentMode()) {
			logFn(level, ...args);
		}
	};

	let loadingIndicator = null;

	try {
		report('info', `Updating subtask ${subtaskId} with prompt: "${prompt}"`);

		if (
			!subtaskId ||
			typeof subtaskId !== 'string' ||
			!subtaskId.includes('.')
		) {
			throw new Error(
				`Invalid subtask ID format: ${subtaskId}. Subtask ID must be in format "parentId.subtaskId"`
			);
		}

		if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
			throw new Error(
				'Prompt cannot be empty. Please provide context for the subtask update.'
			);
		}

		if (!fs.existsSync(tasksPath)) {
			throw new Error(`Tasks file not found at path: ${tasksPath}`);
		}

		const projectRoot = providedProjectRoot || findProjectRoot();
		if (!projectRoot) {
			throw new Error('Could not determine project root directory');
		}

		// Determine the tag to use
		const currentTag = tag || getCurrentTag(projectRoot) || 'master';

		const data = readJSON(tasksPath, projectRoot, currentTag);
		if (!data || !data.tasks) {
			throw new Error(
				`No valid tasks found in ${tasksPath}. The file may be corrupted or have an invalid format.`
			);
		}

		const [parentIdStr, subtaskIdStr] = subtaskId.split('.');
		const parentId = parseInt(parentIdStr, 10);
		const subtaskIdNum = parseInt(subtaskIdStr, 10);

		if (
			Number.isNaN(parentId) ||
			parentId <= 0 ||
			Number.isNaN(subtaskIdNum) ||
			subtaskIdNum <= 0
		) {
			throw new Error(
				`Invalid subtask ID format: ${subtaskId}. Both parent ID and subtask ID must be positive integers.`
			);
		}

		const parentTask = data.tasks.find((task) => task.id === parentId);
		if (!parentTask) {
			throw new Error(
				`Parent task with ID ${parentId} not found. Please verify the task ID and try again.`
			);
		}

		if (!parentTask.subtasks || !Array.isArray(parentTask.subtasks)) {
			throw new Error(`Parent task ${parentId} has no subtasks.`);
		}

		const subtaskIndex = parentTask.subtasks.findIndex(
			(st) => st.id === subtaskIdNum
		);
		if (subtaskIndex === -1) {
			throw new Error(
				`Subtask with ID ${subtaskId} not found. Please verify the subtask ID and try again.`
			);
		}

		const subtask = parentTask.subtasks[subtaskIndex];

		// --- Context Gathering ---
		let gatheredContext = '';
		try {
			const contextGatherer = new ContextGatherer(projectRoot);
			const allTasksFlat = flattenTasksWithSubtasks(data.tasks);
			const fuzzySearch = new FuzzyTaskSearch(allTasksFlat, 'update-subtask');
			const searchQuery = `${parentTask.title} ${subtask.title} ${prompt}`;
			const searchResults = fuzzySearch.findRelevantTasks(searchQuery, {
				maxResults: 5,
				includeSelf: true
			});
			const relevantTaskIds = fuzzySearch.getTaskIds(searchResults);

			const finalTaskIds = [
				...new Set([subtaskId.toString(), ...relevantTaskIds])
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

		if (outputFormat === 'text') {
			const table = new Table({
				head: [
					chalk.cyan.bold('ID'),
					chalk.cyan.bold('Title'),
					chalk.cyan.bold('Status')
				],
				colWidths: [10, 55, 10]
			});
			table.push([
				subtaskId,
				truncate(subtask.title, 52),
				getStatusWithColor(subtask.status)
			]);
			console.log(
				boxen(chalk.white.bold(`Updating Subtask #${subtaskId}`), {
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round',
					margin: { top: 1, bottom: 0 }
				})
			);
			console.log(table.toString());
			loadingIndicator = startLoadingIndicator(
				useResearch
					? 'Updating subtask with research...'
					: 'Updating subtask...'
			);
		}

		let generatedContentString = '';
		let newlyAddedSnippet = '';
		let aiServiceResponse = null;

		try {
			const parentContext = {
				id: parentTask.id,
				title: parentTask.title
			};
			const prevSubtask =
				subtaskIndex > 0
					? {
							id: `${parentTask.id}.${parentTask.subtasks[subtaskIndex - 1].id}`,
							title: parentTask.subtasks[subtaskIndex - 1].title,
							status: parentTask.subtasks[subtaskIndex - 1].status
						}
					: null;
			const nextSubtask =
				subtaskIndex < parentTask.subtasks.length - 1
					? {
							id: `${parentTask.id}.${parentTask.subtasks[subtaskIndex + 1].id}`,
							title: parentTask.subtasks[subtaskIndex + 1].title,
							status: parentTask.subtasks[subtaskIndex + 1].status
						}
					: null;

			const contextString = `
Parent Task: ${JSON.stringify(parentContext)}
${prevSubtask ? `Previous Subtask: ${JSON.stringify(prevSubtask)}` : ''}
${nextSubtask ? `Next Subtask: ${JSON.stringify(nextSubtask)}` : ''}
Current Subtask Details (for context only):\n${subtask.details || '(No existing details)'}
`;

			const systemPrompt = `You are an AI assistant helping to update a subtask. You will be provided with the subtask's existing details, context about its parent and sibling tasks, and a user request string.

Your Goal: Based *only* on the user's request and all the provided context (including existing details if relevant to the request), GENERATE the new text content that should be added to the subtask's details.
Focus *only* on generating the substance of the update.

Output Requirements:
1. Return *only* the newly generated text content as a plain string. Do NOT return a JSON object or any other structured data.
2. Your string response should NOT include any of the subtask's original details, unless the user's request explicitly asks to rephrase, summarize, or directly modify existing text.
3. Do NOT include any timestamps, XML-like tags, markdown, or any other special formatting in your string response.
4. Ensure the generated text is concise yet complete for the update based on the user request. Avoid conversational fillers or explanations about what you are doing (e.g., do not start with "Okay, here's the update...").`;

			// Pass the existing subtask.details in the user prompt for the AI's context.
			let userPrompt = `Task Context:\n${contextString}\n\nUser Request: "${prompt}"\n\nBased on the User Request and all the Task Context (including current subtask details provided above), what is the new information or text that should be appended to this subtask's details? Return ONLY this new text as a plain string.`;

			if (gatheredContext) {
				userPrompt += `\n\n# Additional Project Context\n\n${gatheredContext}`;
			}

			const role = useResearch ? 'research' : 'main';
			report('info', `Using AI text service with role: ${role}`);

			aiServiceResponse = await generateTextService({
				prompt: userPrompt,
				systemPrompt: systemPrompt,
				role,
				session,
				projectRoot,
				maxRetries: 2,
				commandName: 'update-subtask',
				outputType: isMCP ? 'mcp' : 'cli'
			});

			if (
				aiServiceResponse &&
				aiServiceResponse.mainResult &&
				typeof aiServiceResponse.mainResult === 'string'
			) {
				generatedContentString = aiServiceResponse.mainResult;
			} else {
				generatedContentString = '';
				report(
					'warn',
					'AI service response did not contain expected text string.'
				);
			}

			if (outputFormat === 'text' && loadingIndicator) {
				stopLoadingIndicator(loadingIndicator);
				loadingIndicator = null;
			}
		} catch (aiError) {
			report('error', `AI service call failed: ${aiError.message}`);
			if (outputFormat === 'text' && loadingIndicator) {
				stopLoadingIndicator(loadingIndicator);
				loadingIndicator = null;
			}
			throw aiError;
		}

		if (generatedContentString && generatedContentString.trim()) {
			// Check if the string is not empty
			const timestamp = new Date().toISOString();
			const formattedBlock = `<info added on ${timestamp}>\n${generatedContentString.trim()}\n</info added on ${timestamp}>`;
			newlyAddedSnippet = formattedBlock; // <--- ADD THIS LINE: Store for display

			subtask.details =
				(subtask.details ? subtask.details + '\n' : '') + formattedBlock;
		} else {
			report(
				'warn',
				'AI response was empty or whitespace after trimming. Original details remain unchanged.'
			);
			newlyAddedSnippet = 'No new details were added by the AI.';
		}

		const updatedSubtask = parentTask.subtasks[subtaskIndex];

		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.log(
				'>>> DEBUG: Subtask details AFTER AI update:',
				updatedSubtask.details
			);
		}

		if (updatedSubtask.description) {
			if (prompt.length < 100) {
				if (outputFormat === 'text' && getDebugFlag(session)) {
					console.log(
						'>>> DEBUG: Subtask description BEFORE append:',
						updatedSubtask.description
					);
				}
				updatedSubtask.description += ` [Updated: ${new Date().toLocaleDateString()}]`;
				if (outputFormat === 'text' && getDebugFlag(session)) {
					console.log(
						'>>> DEBUG: Subtask description AFTER append:',
						updatedSubtask.description
					);
				}
			}
		}

		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.log('>>> DEBUG: About to call writeJSON with updated data...');
		}
		writeJSON(tasksPath, data, projectRoot, currentTag);
		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.log('>>> DEBUG: writeJSON call completed.');
		}

		report('success', `Successfully updated subtask ${subtaskId}`);
		// await generateTaskFiles(tasksPath, path.dirname(tasksPath));

		if (outputFormat === 'text') {
			if (loadingIndicator) {
				stopLoadingIndicator(loadingIndicator);
				loadingIndicator = null;
			}
			console.log(
				boxen(
					chalk.green(`Successfully updated subtask #${subtaskId}`) +
						'\n\n' +
						chalk.white.bold('Title:') +
						' ' +
						updatedSubtask.title +
						'\n\n' +
						chalk.white.bold('Newly Added Snippet:') +
						'\n' +
						chalk.white(newlyAddedSnippet),
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);
		}

		if (outputFormat === 'text' && aiServiceResponse.telemetryData) {
			displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
		}

		return {
			updatedSubtask: updatedSubtask,
			telemetryData: aiServiceResponse.telemetryData,
			tagInfo: aiServiceResponse.tagInfo
		};
	} catch (error) {
		if (outputFormat === 'text' && loadingIndicator) {
			stopLoadingIndicator(loadingIndicator);
			loadingIndicator = null;
		}
		report('error', `Error updating subtask: ${error.message}`);
		if (outputFormat === 'text') {
			console.error(chalk.red(`Error: ${error.message}`));
			if (error.message?.includes('ANTHROPIC_API_KEY')) {
				console.log(
					chalk.yellow('\nTo fix this issue, set your Anthropic API key:')
				);
				console.log('  export ANTHROPIC_API_KEY=your_api_key_here');
			} else if (error.message?.includes('PERPLEXITY_API_KEY')) {
				console.log(chalk.yellow('\nTo fix this issue:'));
				console.log(
					'  1. Set your Perplexity API key: export PERPLEXITY_API_KEY=your_api_key_here'
				);
				console.log(
					'  2. Or run without the research flag: task-master update-subtask --id=<id> --prompt="..."'
				);
			} else if (error.message?.includes('overloaded')) {
				console.log(
					chalk.yellow(
						'\nAI model overloaded, and fallback failed or was unavailable:'
					)
				);
				console.log('  1. Try again in a few minutes.');
				console.log('  2. Ensure PERPLEXITY_API_KEY is set for fallback.');
			} else if (error.message?.includes('not found')) {
				console.log(chalk.yellow('\nTo fix this issue:'));
				console.log(
					'  1. Run task-master list --with-subtasks to see all available subtask IDs'
				);
				console.log(
					'  2. Use a valid subtask ID with the --id parameter in format "parentId.subtaskId"'
				);
			} else if (
				error.message?.includes('empty stream response') ||
				error.message?.includes('AI did not return a valid text string')
			) {
				console.log(
					chalk.yellow(
						'\nThe AI model returned an empty or invalid response. This might be due to the prompt or API issues. Try rephrasing or trying again later.'
					)
				);
			}
			if (getDebugFlag(session)) {
				console.error(error);
			}
		} else {
			throw error;
		}
		return null;
	}
}

export default updateSubtaskById;
