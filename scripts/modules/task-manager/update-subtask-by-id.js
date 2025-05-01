import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

import {
	getStatusWithColor,
	startLoadingIndicator,
	stopLoadingIndicator
} from '../ui.js';
import {
	log as consoleLog,
	readJSON,
	writeJSON,
	truncate,
	isSilentMode
} from '../utils.js';
import { generateTextService } from '../ai-services-unified.js';
import { getDebugFlag } from '../config-manager.js';
import generateTaskFiles from './generate-task-files.js';

/**
 * Update a subtask by appending additional timestamped information using the unified AI service.
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} subtaskId - ID of the subtask to update in format "parentId.subtaskId"
 * @param {string} prompt - Prompt for generating additional information
 * @param {boolean} [useResearch=false] - Whether to use the research AI role.
 * @param {Object} context - Context object containing session and mcpLog.
 * @param {Object} [context.session] - Session object from MCP server.
 * @param {Object} [context.mcpLog] - MCP logger object.
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
	const { session, mcpLog } = context;
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

		// Validate subtask ID format
		if (
			!subtaskId ||
			typeof subtaskId !== 'string' ||
			!subtaskId.includes('.')
		) {
			throw new Error(
				`Invalid subtask ID format: ${subtaskId}. Subtask ID must be in format "parentId.subtaskId"`
			);
		}

		// Validate prompt
		if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
			throw new Error(
				'Prompt cannot be empty. Please provide context for the subtask update.'
			);
		}

		// Validate tasks file exists
		if (!fs.existsSync(tasksPath)) {
			throw new Error(`Tasks file not found at path: ${tasksPath}`);
		}

		// Read the tasks file
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(
				`No valid tasks found in ${tasksPath}. The file may be corrupted or have an invalid format.`
			);
		}

		// Parse parent and subtask IDs
		const [parentIdStr, subtaskIdStr] = subtaskId.split('.');
		const parentId = parseInt(parentIdStr, 10);
		const subtaskIdNum = parseInt(subtaskIdStr, 10);

		if (
			isNaN(parentId) ||
			parentId <= 0 ||
			isNaN(subtaskIdNum) ||
			subtaskIdNum <= 0
		) {
			throw new Error(
				`Invalid subtask ID format: ${subtaskId}. Both parent ID and subtask ID must be positive integers.`
			);
		}

		// Find the parent task
		const parentTask = data.tasks.find((task) => task.id === parentId);
		if (!parentTask) {
			throw new Error(
				`Parent task with ID ${parentId} not found. Please verify the task ID and try again.`
			);
		}

		// Find the subtask
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

		// Check if subtask is already completed
		if (subtask.status === 'done' || subtask.status === 'completed') {
			report(
				'warn',
				`Subtask ${subtaskId} is already marked as done and cannot be updated`
			);

			// Only show UI elements for text output (CLI)
			if (outputFormat === 'text') {
				console.log(
					boxen(
						chalk.yellow(
							`Subtask ${subtaskId} is already marked as ${subtask.status} and cannot be updated.`
						) +
							'\n\n' +
							chalk.white(
								'Completed subtasks are locked to maintain consistency. To modify a completed subtask, you must first:'
							) +
							'\n' +
							chalk.white(
								'1. Change its status to "pending" or "in-progress"'
							) +
							'\n' +
							chalk.white('2. Then run the update-subtask command'),
						{ padding: 1, borderColor: 'yellow', borderStyle: 'round' }
					)
				);
			}
			return null;
		}

		// Only show UI elements for text output (CLI)
		if (outputFormat === 'text') {
			// Show the subtask that will be updated
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

			// Start the loading indicator - only for text output
			loadingIndicator = startLoadingIndicator(
				'Generating additional information with AI...'
			);
		}

		let additionalInformation = '';
		try {
			// Reverted: Keep the original system prompt
			const systemPrompt = `You are an AI assistant helping to update software development subtasks with additional information.
Given a subtask, you will provide additional details, implementation notes, or technical insights based on user request.
Focus only on adding content that enhances the subtask - don't repeat existing information.
Be technical, specific, and implementation-focused rather than general.
Provide concrete examples, code snippets, or implementation details when relevant.`;

			// Reverted: Use the full JSON stringification for the user message
			const subtaskData = JSON.stringify(subtask, null, 2);
			const userMessageContent = `Here is the subtask to enhance:\n${subtaskData}\n\nPlease provide additional information addressing this request:\n${prompt}\n\nReturn ONLY the new information to add - do not repeat existing content.`;

			const serviceRole = useResearch ? 'research' : 'main';
			report('info', `Calling AI text service with role: ${serviceRole}`);

			const streamResult = await generateTextService({
				role: serviceRole,
				session: session,
				systemPrompt: systemPrompt,
				prompt: userMessageContent
			});

			if (outputFormat === 'text' && loadingIndicator) {
				// Stop indicator immediately since generateText is blocking
				stopLoadingIndicator(loadingIndicator);
				loadingIndicator = null;
			}

			// Assign the result directly (generateTextService returns the text string)
			additionalInformation = streamResult ? streamResult.trim() : '';

			if (!additionalInformation) {
				throw new Error('AI returned empty response.'); // Changed error message slightly
			}
			report(
				// Corrected log message to reflect generateText
				'success',
				`Successfully generated text using AI role: ${serviceRole}.`
			);
		} catch (aiError) {
			report('error', `AI service call failed: ${aiError.message}`);
			throw aiError;
		} // Removed the inner finally block as streamingInterval is gone

		const currentDate = new Date();

		// Format the additional information with timestamp
		const formattedInformation = `\n\n<info added on ${currentDate.toISOString()}>\n${additionalInformation}\n</info added on ${currentDate.toISOString()}>`;

		// Only show debug info for text output (CLI)
		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.log(
				'>>> DEBUG: formattedInformation:',
				formattedInformation.substring(0, 70) + '...'
			);
		}

		// Append to subtask details and description
		// Only show debug info for text output (CLI)
		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.log('>>> DEBUG: Subtask details BEFORE append:', subtask.details);
		}

		if (subtask.details) {
			subtask.details += formattedInformation;
		} else {
			subtask.details = `${formattedInformation}`;
		}

		// Only show debug info for text output (CLI)
		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.log('>>> DEBUG: Subtask details AFTER append:', subtask.details);
		}

		if (subtask.description) {
			// Only append to description if it makes sense (for shorter updates)
			if (additionalInformation.length < 200) {
				// Only show debug info for text output (CLI)
				if (outputFormat === 'text' && getDebugFlag(session)) {
					console.log(
						'>>> DEBUG: Subtask description BEFORE append:',
						subtask.description
					);
				}
				subtask.description += ` [Updated: ${currentDate.toLocaleDateString()}]`;
				// Only show debug info for text output (CLI)
				if (outputFormat === 'text' && getDebugFlag(session)) {
					console.log(
						'>>> DEBUG: Subtask description AFTER append:',
						subtask.description
					);
				}
			}
		}

		// Only show debug info for text output (CLI)
		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.log('>>> DEBUG: About to call writeJSON with updated data...');
		}

		// Update the subtask in the parent task's array
		parentTask.subtasks[subtaskIndex] = subtask;

		// Write the updated tasks to the file
		writeJSON(tasksPath, data);

		// Only show debug info for text output (CLI)
		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.log('>>> DEBUG: writeJSON call completed.');
		}

		report('success', `Successfully updated subtask ${subtaskId}`);

		// Generate individual task files
		await generateTaskFiles(tasksPath, path.dirname(tasksPath));

		// Stop indicator before final console output - only for text output (CLI)
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
						subtask.title +
						'\n\n' +
						chalk.white.bold('Information Added:') +
						'\n' +
						chalk.white(truncate(additionalInformation, 300, true)),
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);
		}

		return subtask;
	} catch (error) {
		// Outer catch block handles final errors after loop/attempts
		// Stop indicator on error - only for text output (CLI)
		if (outputFormat === 'text' && loadingIndicator) {
			stopLoadingIndicator(loadingIndicator);
			loadingIndicator = null;
		}

		report('error', `Error updating subtask: ${error.message}`);

		// Only show error UI for text output (CLI)
		if (outputFormat === 'text') {
			console.error(chalk.red(`Error: ${error.message}`));

			// Provide helpful error messages based on error type
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
				// Catch final overload error
				console.log(
					chalk.yellow(
						'\nAI model overloaded, and fallback failed or was unavailable:'
					)
				);
				console.log('  1. Try again in a few minutes.');
				console.log('  2. Ensure PERPLEXITY_API_KEY is set for fallback.');
				console.log('  3. Consider breaking your prompt into smaller updates.');
			} else if (error.message?.includes('not found')) {
				console.log(chalk.yellow('\nTo fix this issue:'));
				console.log(
					'  1. Run task-master list --with-subtasks to see all available subtask IDs'
				);
				console.log(
					'  2. Use a valid subtask ID with the --id parameter in format "parentId.subtaskId"'
				);
			} else if (error.message?.includes('empty stream response')) {
				console.log(
					chalk.yellow(
						'\nThe AI model returned an empty response. This might be due to the prompt or API issues. Try rephrasing or trying again later.'
					)
				);
			}

			if (getDebugFlag(session)) {
				// Use getter
				console.error(error);
			}
		} else {
			throw error; // Re-throw for JSON output
		}

		return null;
	}
}

export default updateSubtaskById;
