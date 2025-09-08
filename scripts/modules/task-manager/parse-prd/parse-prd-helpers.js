/**
 * Helper functions for PRD parsing
 */

import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';
import { ensureTagMetadata, findTaskById } from '../../utils.js';
import { displayParsePrdSummary } from '../../../../src/ui/parse-prd.js';
import { TimeoutManager } from '../../../../src/utils/timeout-manager.js';
import { displayAiUsageSummary } from '../../ui.js';
import { getPromptManager } from '../../prompt-manager.js';
import { getDefaultPriority } from '../../config-manager.js';

/**
 * Estimate token count from text
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
	// Common approximation: ~4 characters per token for English
	return Math.ceil(text.length / 4);
}

/**
 * Read and validate PRD content
 * @param {string} prdPath - Path to PRD file
 * @returns {string} PRD content
 * @throws {Error} If file is empty or cannot be read
 */
export function readPrdContent(prdPath) {
	const prdContent = fs.readFileSync(prdPath, 'utf8');
	if (!prdContent) {
		throw new Error(`Input file ${prdPath} is empty or could not be read.`);
	}
	return prdContent;
}

/**
 * Load existing tasks from file
 * @param {string} tasksPath - Path to tasks file
 * @param {string} targetTag - Target tag to load from
 * @returns {{tasks: Array, nextId: number}} Existing tasks and next ID
 */
export function loadExistingTasks(tasksPath, targetTag) {
	let existingTasks = [];
	let nextId = 1;

	if (!fs.existsSync(tasksPath)) {
		return { existingTasks, nextId };
	}

	try {
		const existingFileContent = fs.readFileSync(tasksPath, 'utf8');
		const allData = JSON.parse(existingFileContent);

		if (allData[targetTag]?.tasks && Array.isArray(allData[targetTag].tasks)) {
			existingTasks = allData[targetTag].tasks;
			if (existingTasks.length > 0) {
				nextId = Math.max(...existingTasks.map((t) => t.id || 0)) + 1;
			}
		}
	} catch (error) {
		// If we can't read the file or parse it, assume no existing tasks
		return { existingTasks: [], nextId: 1 };
	}

	return { existingTasks, nextId };
}

/**
 * Validate overwrite/append operations
 * @param {Object} params
 * @returns {void}
 * @throws {Error} If validation fails
 */
export function validateFileOperations({
	existingTasks,
	targetTag,
	append,
	force,
	isMCP,
	logger
}) {
	const hasExistingTasks = existingTasks.length > 0;

	if (!hasExistingTasks) {
		logger.report(
			`Tag '${targetTag}' is empty or doesn't exist. Creating/updating tag with new tasks.`,
			'info'
		);
		return;
	}

	if (append) {
		logger.report(
			`Append mode enabled. Found ${existingTasks.length} existing tasks in tag '${targetTag}'.`,
			'info'
		);
		return;
	}

	if (!force) {
		const errorMessage = `Tag '${targetTag}' already contains ${existingTasks.length} tasks. Use --force to overwrite or --append to add to existing tasks.`;
		logger.report(errorMessage, 'error');

		if (isMCP) {
			throw new Error(errorMessage);
		} else {
			console.error(chalk.red(errorMessage));
			process.exit(1);
		}
	}

	logger.report(
		`Force flag enabled. Overwriting existing tasks in tag '${targetTag}'.`,
		'debug'
	);
}

/**
 * Process and transform tasks with ID remapping
 * @param {Array} rawTasks - Raw tasks from AI
 * @param {number} startId - Starting ID for new tasks
 * @param {Array} existingTasks - Existing tasks for dependency validation
 * @param {string} defaultPriority - Default priority for tasks
 * @returns {Array} Processed tasks with remapped IDs
 */
export function processTasks(
	rawTasks,
	startId,
	existingTasks,
	defaultPriority
) {
	let currentId = startId;
	const taskMap = new Map();

	// First pass: assign new IDs and create mapping
	const processedTasks = rawTasks.map((task) => {
		const newId = currentId++;
		taskMap.set(task.id, newId);

		return {
			...task,
			id: newId,
			status: task.status || 'pending',
			priority: task.priority || defaultPriority,
			dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
			subtasks: task.subtasks || [],
			// Ensure all required fields have values
			title: task.title || '',
			description: task.description || '',
			details: task.details || '',
			testStrategy: task.testStrategy || ''
		};
	});

	// Second pass: remap dependencies
	processedTasks.forEach((task) => {
		task.dependencies = task.dependencies
			.map((depId) => taskMap.get(depId))
			.filter(
				(newDepId) =>
					newDepId != null &&
					newDepId < task.id &&
					(findTaskById(existingTasks, newDepId) ||
						processedTasks.some((t) => t.id === newDepId))
			);
	});

	return processedTasks;
}

/**
 * Save tasks to file with tag support
 * @param {string} tasksPath - Path to save tasks
 * @param {Array} tasks - Tasks to save
 * @param {string} targetTag - Target tag
 * @param {Object} logger - Logger instance
 */
export function saveTasksToFile(tasksPath, tasks, targetTag, logger) {
	// Create directory if it doesn't exist
	const tasksDir = path.dirname(tasksPath);
	if (!fs.existsSync(tasksDir)) {
		fs.mkdirSync(tasksDir, { recursive: true });
	}

	// Read existing file to preserve other tags
	let outputData = {};
	if (fs.existsSync(tasksPath)) {
		try {
			const existingFileContent = fs.readFileSync(tasksPath, 'utf8');
			outputData = JSON.parse(existingFileContent);
		} catch (error) {
			outputData = {};
		}
	}

	// Update only the target tag
	outputData[targetTag] = {
		tasks: tasks,
		metadata: {
			created:
				outputData[targetTag]?.metadata?.created || new Date().toISOString(),
			updated: new Date().toISOString(),
			description: `Tasks for ${targetTag} context`
		}
	};

	// Ensure proper metadata
	ensureTagMetadata(outputData[targetTag], {
		description: `Tasks for ${targetTag} context`
	});

	// Write back to file
	fs.writeFileSync(tasksPath, JSON.stringify(outputData, null, 2));

	logger.report(
		`Successfully saved ${tasks.length} tasks to ${tasksPath}`,
		'debug'
	);
}

/**
 * Build prompts for AI service
 * @param {Object} config - Configuration object
 * @param {string} prdContent - PRD content
 * @param {number} nextId - Next task ID
 * @returns {Promise<{systemPrompt: string, userPrompt: string}>}
 */
export async function buildPrompts(config, prdContent, nextId) {
	const promptManager = getPromptManager();
	const defaultTaskPriority =
		getDefaultPriority(config.projectRoot) || 'medium';

	return promptManager.loadPrompt('parse-prd', {
		research: config.research,
		numTasks: config.numTasks,
		nextId,
		prdContent,
		prdPath: config.prdPath,
		defaultTaskPriority,
		hasCodebaseAnalysis: config.hasCodebaseAnalysis(),
		projectRoot: config.projectRoot || ''
	});
}

/**
 * Handle progress reporting for both CLI and MCP
 * @param {Object} params
 */
export async function reportTaskProgress({
	task,
	currentCount,
	totalTasks,
	estimatedTokens,
	progressTracker,
	reportProgress,
	priorityMap,
	defaultPriority,
	estimatedInputTokens
}) {
	const priority = task.priority || defaultPriority;
	const priorityIndicator = priorityMap[priority] || priorityMap.medium;

	// CLI progress tracker
	if (progressTracker) {
		progressTracker.addTaskLine(currentCount, task.title, priority);
		if (estimatedTokens) {
			progressTracker.updateTokens(estimatedInputTokens, estimatedTokens);
		}
	}

	// MCP progress reporting
	if (reportProgress) {
		try {
			const outputTokens = estimatedTokens
				? Math.floor(estimatedTokens / totalTasks)
				: 0;

			await reportProgress({
				progress: currentCount,
				total: totalTasks,
				message: `${priorityIndicator} Task ${currentCount}/${totalTasks} - ${task.title} | ~Output: ${outputTokens} tokens`
			});
		} catch (error) {
			// Ignore progress reporting errors
		}
	}
}

/**
 * Display completion summary for CLI
 * @param {Object} params
 */
export async function displayCliSummary({
	processedTasks,
	nextId,
	summary,
	prdPath,
	tasksPath,
	usedFallback,
	aiServiceResponse
}) {
	// Generate task file names
	const taskFilesGenerated = (() => {
		if (!Array.isArray(processedTasks) || processedTasks.length === 0) {
			return `task_${String(nextId).padStart(3, '0')}.txt`;
		}
		const firstNewTaskId = processedTasks[0].id;
		const lastNewTaskId = processedTasks[processedTasks.length - 1].id;
		if (processedTasks.length === 1) {
			return `task_${String(firstNewTaskId).padStart(3, '0')}.txt`;
		}
		return `task_${String(firstNewTaskId).padStart(3, '0')}.txt -> task_${String(lastNewTaskId).padStart(3, '0')}.txt`;
	})();

	displayParsePrdSummary({
		totalTasks: processedTasks.length,
		taskPriorities: summary.taskPriorities,
		prdFilePath: prdPath,
		outputPath: tasksPath,
		elapsedTime: summary.elapsedTime,
		usedFallback,
		taskFilesGenerated,
		actionVerb: summary.actionVerb
	});

	// Display telemetry
	if (aiServiceResponse?.telemetryData) {
		// For streaming, wait briefly to allow usage data to be captured
		if (aiServiceResponse.mainResult?.usage) {
			// Give the usage promise a short time to resolve
			await TimeoutManager.withSoftTimeout(
				aiServiceResponse.mainResult.usage,
				1000,
				undefined
			);
		}
		displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
	}
}

/**
 * Display non-streaming CLI output
 * @param {Object} params
 */
export function displayNonStreamingCliOutput({
	processedTasks,
	research,
	finalTasks,
	tasksPath,
	aiServiceResponse
}) {
	console.log(
		boxen(
			chalk.green(
				`Successfully generated ${processedTasks.length} new tasks${research ? ' with research-backed analysis' : ''}. Total tasks in ${tasksPath}: ${finalTasks.length}`
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

	if (aiServiceResponse?.telemetryData) {
		displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
	}
}
