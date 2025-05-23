import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { z } from 'zod';

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
import {
	generateObjectService,
	generateTextService
} from '../ai-services-unified.js';
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
	const { session, mcpLog, projectRoot } = context;
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

		const subtaskSchema = z.object({
			id: z.number().int().positive(),
			title: z.string(),
			description: z.string().optional(),
			status: z.string(),
			dependencies: z.array(z.union([z.string(), z.number()])).optional(),
			priority: z.string().optional(),
			details: z.string().optional(),
			testStrategy: z.string().optional()
		});

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
				useResearch
					? 'Updating subtask with research...'
					: 'Updating subtask...'
			);
		}

		let parsedAIResponse;
		try {
			// --- GET PARENT & SIBLING CONTEXT ---
			const parentContext = {
				id: parentTask.id,
				title: parentTask.title
				// Avoid sending full parent description/details unless necessary
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
`;

			const systemPrompt = `You are an AI assistant updating a parent task's subtask. This subtask will be part of a larger parent task and will be used to direct AI agents to complete the subtask. Your goal is to GENERATE new, relevant information based on the user's request (which may be high-level, mid-level or low-level) and APPEND it to the existing subtask 'details' field, wrapped in specific XML-like tags with an ISO 8601 timestamp. Intelligently determine the level of detail to include based on the user's request. Some requests are meant simply to update the subtask with some mid-implementation details, while others are meant to update the subtask with a detailed plan or strategy.

Context Provided:
- The current subtask object.
- Basic info about the parent task (ID, title).
- Basic info about the immediately preceding subtask (ID, title, status), if it exists.
- Basic info about the immediately succeeding subtask (ID, title, status), if it exists.
- A user request string.

Guidelines:
1. Analyze the user request considering the provided subtask details AND the context of the parent and sibling tasks.
2. GENERATE new, relevant text content that should be added to the 'details' field. Focus *only* on the substance of the update based on the user request and context. Do NOT add timestamps or any special formatting yourself. Avoid over-engineering the details, provide .
3. Update the 'details' field in the subtask object with the GENERATED text content. It's okay if this overwrites previous details in the object you return, as the calling code will handle the final appending.
4. Return the *entire* updated subtask object (with your generated content in the 'details' field) as a valid JSON object conforming to the provided schema. Do NOT return explanations or markdown formatting.`;

			const subtaskDataString = JSON.stringify(subtask, null, 2);
			// Updated user prompt including context
			const userPrompt = `Task Context:\n${contextString}\nCurrent Subtask:\n${subtaskDataString}\n\nUser Request: "${prompt}"\n\nPlease GENERATE new, relevant text content for the 'details' field based on the user request and the provided context. Return the entire updated subtask object as a valid JSON object matching the schema, with the newly generated text placed in the 'details' field.`;
			// --- END UPDATED PROMPTS ---

			// Call Unified AI Service using generateObjectService
			const role = useResearch ? 'research' : 'main';
			report('info', `Using AI object service with role: ${role}`);

			parsedAIResponse = await generateObjectService({
				prompt: userPrompt,
				systemPrompt: systemPrompt,
				schema: subtaskSchema,
				objectName: 'updatedSubtask',
				role,
				session,
				projectRoot,
				maxRetries: 2
			});
			report(
				'success',
				'Successfully received object response from AI service'
			);

			if (outputFormat === 'text' && loadingIndicator) {
				stopLoadingIndicator(loadingIndicator);
				loadingIndicator = null;
			}

			if (!parsedAIResponse || typeof parsedAIResponse !== 'object') {
				throw new Error('AI did not return a valid object.');
			}

			report(
				'success',
				`Successfully generated object using AI role: ${role}.`
			);
		} catch (aiError) {
			report('error', `AI service call failed: ${aiError.message}`);
			if (outputFormat === 'text' && loadingIndicator) {
				stopLoadingIndicator(loadingIndicator); // Ensure stop on error
				loadingIndicator = null;
			}
			throw aiError;
		}

		// --- TIMESTAMP & FORMATTING LOGIC (Handled Locally) ---
		// Extract only the generated content from the AI's response details field.
		const generatedContent = parsedAIResponse.details || ''; // Default to empty string

		if (generatedContent.trim()) {
			// Generate timestamp locally
			const timestamp = new Date().toISOString(); // <<< Local Timestamp

			// Format the content with XML-like tags and timestamp LOCALLY
			const formattedBlock = `<info added on ${timestamp}>\n${generatedContent.trim()}\n</info added on ${timestamp}>`; // <<< Local Formatting

			// Append the formatted block to the *original* subtask details
			subtask.details =
				(subtask.details ? subtask.details + '\n' : '') + formattedBlock; // <<< Local Appending
			report(
				'info',
				'Appended timestamped, formatted block with AI-generated content to subtask.details.'
			);
		} else {
			report(
				'warn',
				'AI response object did not contain generated content in the "details" field. Original details remain unchanged.'
			);
		}
		// --- END TIMESTAMP & FORMATTING LOGIC ---

		// Get a reference to the subtask *after* its details have been updated
		const updatedSubtask = parentTask.subtasks[subtaskIndex]; // subtask === updatedSubtask now

		report('info', 'Updated subtask details locally after AI generation.');
		// --- END UPDATE SUBTASK ---

		// Only show debug info for text output (CLI)
		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.log(
				'>>> DEBUG: Subtask details AFTER AI update:',
				updatedSubtask.details // Use updatedSubtask
			);
		}

		// Description update logic (keeping as is for now)
		if (updatedSubtask.description) {
			// Use updatedSubtask
			if (prompt.length < 100) {
				if (outputFormat === 'text' && getDebugFlag(session)) {
					console.log(
						'>>> DEBUG: Subtask description BEFORE append:',
						updatedSubtask.description // Use updatedSubtask
					);
				}
				updatedSubtask.description += ` [Updated: ${new Date().toLocaleDateString()}]`; // Use updatedSubtask
				if (outputFormat === 'text' && getDebugFlag(session)) {
					console.log(
						'>>> DEBUG: Subtask description AFTER append:',
						updatedSubtask.description // Use updatedSubtask
					);
				}
			}
		}

		// Only show debug info for text output (CLI)
		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.log('>>> DEBUG: About to call writeJSON with updated data...');
		}

		// Write the updated tasks to the file (parentTask already contains the updated subtask)
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
						updatedSubtask.title +
						'\n\n' +
						// Update the display to show the new details field
						chalk.white.bold('Updated Details:') +
						'\n' +
						chalk.white(truncate(updatedSubtask.details || '', 500, true)), // Use updatedSubtask
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);
		}

		return updatedSubtask; // Return the modified subtask object
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
