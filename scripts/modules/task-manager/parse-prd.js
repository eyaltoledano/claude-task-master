import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import { z } from 'zod';

import {
	log,
	writeJSON,
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	readJSON,
	findTaskById,
	ensureTagMetadata,
	getCurrentTag
} from '../utils.js';

import { generateObjectService } from '../ai-services-unified.js';
import { getDebugFlag } from '../config-manager.js';
import { getPromptManager } from '../prompt-manager.js';
import generateTaskFiles from './generate-task-files.js';
import { displayAiUsageSummary } from '../ui.js';

// Define the Zod schema for a SINGLE task object
const prdSingleTaskSchema = z.object({
	id: z.number().int().positive(),
	title: z.string().min(1),
	description: z.string().min(1),
	details: z.string().nullable(),
	testStrategy: z.string().nullable(),
	priority: z.enum(['high', 'medium', 'low']).nullable(),
	dependencies: z.array(z.number().int().positive()).nullable(),
	status: z.string().nullable()
});

// Define the Zod schema for the ENTIRE expected AI response object
const prdResponseSchema = z.object({
	tasks: z.array(prdSingleTaskSchema),
	metadata: z.object({
		projectName: z.string(),
		totalTasks: z.number(),
		sourceFile: z.string(),
		generatedAt: z.string()
	})
});

/**
 * Parse a PRD file and generate tasks
 * @param {string} prdPath - Path to the PRD file
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} numTasks - Number of tasks to generate
 * @param {Object} options - Additional options
 * @param {boolean} [options.force=false] - Whether to overwrite existing tasks.json.
 * @param {boolean} [options.append=false] - Append to existing tasks file.
 * @param {boolean} [options.research=false] - Use research model for enhanced PRD analysis.
 * @param {Object} [options.reportProgress] - Function to report progress (optional, likely unused).
 * @param {Object} [options.mcpLog] - MCP logger object (optional).
 * @param {Object} [options.session] - Session object from MCP server (optional).
 * @param {string} [options.projectRoot] - Project root path (for MCP/env fallback).
 * @param {string} [options.tag] - Target tag for task generation.
 * @param {string} [outputFormat='text'] - Output format ('text' or 'json').
 */
async function parsePRD(prdPath, tasksPath, numTasks, options = {}) {
	const {
		reportProgress,
		mcpLog,
		session,
		projectRoot,
		force = false,
		append = false,
		research = false,
		tag
	} = options;
	const isMCP = !!mcpLog;
	const outputFormat = isMCP ? 'json' : 'text';

	// Use the provided tag, or the current active tag, or default to 'master'
	const targetTag = tag;

	const logFn = mcpLog
		? mcpLog
		: {
				// Wrapper for CLI
				info: (...args) => log('info', ...args),
				warn: (...args) => log('warn', ...args),
				error: (...args) => log('error', ...args),
				debug: (...args) => log('debug', ...args),
				success: (...args) => log('success', ...args)
			};

	// Create custom reporter using logFn
	const report = (message, level = 'info') => {
		// Check logFn directly
		if (logFn && typeof logFn[level] === 'function') {
			logFn[level](message);
		} else if (!isSilentMode() && outputFormat === 'text') {
			// Fallback to original log only if necessary and in CLI text mode
			log(level, message);
		}
	};

	report(
		`Parsing PRD file: ${prdPath}, Force: ${force}, Append: ${append}, Research: ${research}`
	);

	let existingTasks = [];
	let nextId = 1;
	let aiServiceResponse = null;

	try {
		// Check if there are existing tasks in the target tag
		let hasExistingTasksInTag = false;
		if (fs.existsSync(tasksPath)) {
			try {
				// Read the entire file to check if the tag exists
				const existingFileContent = fs.readFileSync(tasksPath, 'utf8');
				const allData = JSON.parse(existingFileContent);

				// Check if the target tag exists and has tasks
				if (
					allData[targetTag] &&
					Array.isArray(allData[targetTag].tasks) &&
					allData[targetTag].tasks.length > 0
				) {
					hasExistingTasksInTag = true;
					existingTasks = allData[targetTag].tasks;
					nextId = Math.max(...existingTasks.map((t) => t.id || 0)) + 1;
				}
			} catch (error) {
				// If we can't read the file or parse it, assume no existing tasks in this tag
				hasExistingTasksInTag = false;
			}
		}

		// Handle file existence and overwrite/append logic based on target tag
		if (hasExistingTasksInTag) {
			if (append) {
				report(
					`Append mode enabled. Found ${existingTasks.length} existing tasks in tag '${targetTag}'. Next ID will be ${nextId}.`,
					'info'
				);
			} else if (!force) {
				// Not appending and not forcing overwrite, and there are existing tasks in the target tag
				const overwriteError = new Error(
					`Tag '${targetTag}' already contains ${existingTasks.length} tasks. Use --force to overwrite or --append to add to existing tasks.`
				);
				report(overwriteError.message, 'error');
				if (outputFormat === 'text') {
					console.error(chalk.red(overwriteError.message));
				}
				throw overwriteError;
			} else {
				// Force overwrite is true
				report(
					`Force flag enabled. Overwriting existing tasks in tag '${targetTag}'.`,
					'info'
				);
			}
		} else {
			// No existing tasks in target tag, proceed without confirmation
			report(
				`Tag '${targetTag}' is empty or doesn't exist. Creating/updating tag with new tasks.`,
				'info'
			);
		}

		report(`Reading PRD content from ${prdPath}`, 'info');
		const prdContent = fs.readFileSync(prdPath, 'utf8');
		if (!prdContent) {
			throw new Error(`Input file ${prdPath} is empty or could not be read.`);
		}

		// Load prompts using PromptManager
		const promptManager = getPromptManager();

		// Get defaultTaskPriority from config
		const { getDefaultPriority } = await import('../config-manager.js');
		const defaultTaskPriority = getDefaultPriority(projectRoot) || 'medium';

		const { systemPrompt, userPrompt } = await promptManager.loadPrompt(
			'parse-prd',
			{
				research,
				numTasks,
				nextId,
				prdContent,
				prdPath,
				defaultTaskPriority
			}
		);

		// Call the unified AI service
		report(
			`Calling AI service to generate tasks from PRD${research ? ' with research-backed analysis' : ''}...`,
			'info'
		);

		// Call generateObjectService with the CORRECT schema and additional telemetry params
		aiServiceResponse = await generateObjectService({
			role: research ? 'research' : 'main', // Use research role if flag is set
			session: session,
			projectRoot: projectRoot,
			schema: prdResponseSchema,
			objectName: 'tasks_data',
			systemPrompt: systemPrompt,
			prompt: userPrompt,
			commandName: 'parse-prd',
			outputType: isMCP ? 'mcp' : 'cli'
		});

		// Create the directory if it doesn't exist
		const tasksDir = path.dirname(tasksPath);
		if (!fs.existsSync(tasksDir)) {
			fs.mkdirSync(tasksDir, { recursive: true });
		}
		logFn.success(
			`Successfully parsed PRD via AI service${research ? ' with research-backed analysis' : ''}.`
		);

		// Validate and Process Tasks
		// const generatedData = aiServiceResponse?.mainResult?.object;

		// Robustly get the actual AI-generated object
		let generatedData = null;
		if (aiServiceResponse?.mainResult) {
			if (
				typeof aiServiceResponse.mainResult === 'object' &&
				aiServiceResponse.mainResult !== null &&
				'tasks' in aiServiceResponse.mainResult
			) {
				// If mainResult itself is the object with a 'tasks' property
				generatedData = aiServiceResponse.mainResult;
			} else if (
				typeof aiServiceResponse.mainResult.object === 'object' &&
				aiServiceResponse.mainResult.object !== null &&
				'tasks' in aiServiceResponse.mainResult.object
			) {
				// If mainResult.object is the object with a 'tasks' property
				generatedData = aiServiceResponse.mainResult.object;
			}
		}

		if (!generatedData || !Array.isArray(generatedData.tasks)) {
			logFn.error(
				`Internal Error: generateObjectService returned unexpected data structure: ${JSON.stringify(generatedData)}`
			);
			throw new Error(
				'AI service returned unexpected data structure after validation.'
			);
		}

		let currentId = nextId;
		const taskMap = new Map();
		const processedNewTasks = generatedData.tasks.map((task) => {
			const newId = currentId++;
			taskMap.set(task.id, newId);
			return {
				...task,
				id: newId,
				status: 'pending',
				priority: task.priority || 'medium',
				dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
				subtasks: []
			};
		});

		// Remap dependencies for the NEWLY processed tasks
		processedNewTasks.forEach((task) => {
			task.dependencies = task.dependencies
				.map((depId) => taskMap.get(depId)) // Map old AI ID to new sequential ID
				.filter(
					(newDepId) =>
						newDepId != null && // Must exist
						newDepId < task.id && // Must be a lower ID (could be existing or newly generated)
						(findTaskById(existingTasks, newDepId) || // Check if it exists in old tasks OR
							processedNewTasks.some((t) => t.id === newDepId)) // check if it exists in new tasks
				);
		});

		const finalTasks = append
			? [...existingTasks, ...processedNewTasks]
			: processedNewTasks;

		// Read the existing file to preserve other tags
		let outputData = {};
		if (fs.existsSync(tasksPath)) {
			try {
				const existingFileContent = fs.readFileSync(tasksPath, 'utf8');
				outputData = JSON.parse(existingFileContent);
			} catch (error) {
				// If we can't read the existing file, start with empty object
				outputData = {};
			}
		}

		// Update only the target tag, preserving other tags
		outputData[targetTag] = {
			tasks: finalTasks,
			metadata: {
				created:
					outputData[targetTag]?.metadata?.created || new Date().toISOString(),
				updated: new Date().toISOString(),
				description: `Tasks for ${targetTag} context`
			}
		};

		// Ensure the target tag has proper metadata
		ensureTagMetadata(outputData[targetTag], {
			description: `Tasks for ${targetTag} context`
		});

		// Write the complete data structure back to the file
		fs.writeFileSync(tasksPath, JSON.stringify(outputData, null, 2));
		report(
			`Successfully ${append ? 'appended' : 'generated'} ${processedNewTasks.length} tasks in ${tasksPath}${research ? ' with research-backed analysis' : ''}`,
			'success'
		);

		// Generate markdown task files after writing tasks.json
		// await generateTaskFiles(tasksPath, path.dirname(tasksPath), { mcpLog });

		// Handle CLI output (e.g., success message)
		if (outputFormat === 'text') {
			console.log(
				boxen(
					chalk.green(
						`Successfully generated ${processedNewTasks.length} new tasks${research ? ' with research-backed analysis' : ''}. Total tasks in ${tasksPath}: ${finalTasks.length}`
					),
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);

			console.log(
				boxen(
					chalk.white.bold('Next Steps:') +
						'\n\n' +
						`${chalk.cyan('1.')} Run ${chalk.yellow('task-master list')} to view all tasks\n` +
						`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down a task into subtasks`,
					{
						padding: 1,
						borderColor: 'cyan',
						borderStyle: 'round',
						margin: { top: 1 }
					}
				)
			);

			if (aiServiceResponse && aiServiceResponse.telemetryData) {
				displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
			}
		}

		// Return telemetry data
		return {
			success: true,
			tasksPath,
			telemetryData: aiServiceResponse?.telemetryData,
			tagInfo: aiServiceResponse?.tagInfo
		};
	} catch (error) {
		report(`Error parsing PRD: ${error.message}`, 'error');

		// Only show error UI for text output (CLI)
		if (outputFormat === 'text') {
			console.error(chalk.red(`Error: ${error.message}`));

			if (getDebugFlag(projectRoot)) {
				// Use projectRoot for debug flag check
				console.error(error);
			}
		}

		throw error; // Always re-throw for proper error handling
	}
}

export default parsePRD;
