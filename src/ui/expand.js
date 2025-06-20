import { formatElapsedTime } from '../utils/format.js';
import chalk from 'chalk';
import boxen from 'boxen';
import {
	getMainModelId,
	getMainTemperature,
	getResearchModelId,
	getResearchTemperature
} from '../../scripts/modules/config-manager.js';

/**
 * expand.js
 * UI functions specifically for task expansion operations
 */

/**
 * Format elapsed time in the format 0m 00s
 * @param {number} seconds - Elapsed time in seconds
 * @returns {string} Formatted time string
 */

/**
 * Display the start of task expansion with a boxen announcement
 * @param {Object} options - Options for task expansion start
 * @param {string} [options.taskId] - ID of specific task being expanded (for single task)
 * @param {number} [options.totalPendingTasks] - Total number of pending tasks (for expand-all)
 * @param {string} options.tasksFilePath - Path to the tasks file
 * @param {string|number} [options.numSubtasks] - Number of subtasks to generate per task
 * @param {string} [options.model] - AI model name
 * @param {number} [options.temperature] - AI temperature setting
 * @param {boolean} [options.force=false] - Whether force mode is enabled
 * @param {boolean} [options.research=false] - Whether research mode is enabled
 * @param {string} [options.customPrompt] - Custom prompt provided
 * @param {string} [options.expandType='single'] - Type of expansion: 'single' or 'all'
 */
function displayExpandStart({
	tagName,
	taskId,
	totalPendingTasks,
	tasksFilePath,
	numSubtasks,
	model = 'Default',
	temperature = 0.7,
	force = false,
	research = false,
	customPrompt,
	expandType = 'single'
}) {
	// Determine the operation type and title
	const isExpandAll = expandType === 'all';
	const title = isExpandAll
		? '🚀 Expanding All Pending Tasks'
		: '🚀 Expanding Task';

	// Get actual model and temperature values from config
	const actualModel = research
		? getResearchModelId() || model
		: getMainModelId() || model;
	const actualTemperature = research
		? getResearchTemperature() || temperature
		: getMainTemperature() || temperature;

	// Create the model line with research indicator
	let modelLine = `Model: ${actualModel} | Temperature: ${actualTemperature}`;
	if (research) {
		modelLine += ` | ${chalk.cyan.bold('🔬 Research Mode')}`;
	}

	// Add tag to the model line if provided
	if (tagName) {
		modelLine += `\n🏷️ tag: ${tagName}`;
	}

	// Build the main content based on expansion type
	let content = chalk.blue(`Tasks file: ${tasksFilePath}\n`);

	if (isExpandAll) {
		content += chalk.blue(`Pending tasks to expand: ${totalPendingTasks}\n`);
	} else {
		content += chalk.blue(`Task ID: ${taskId}\n`);
	}

	// Add subtask info if specified
	if (numSubtasks) {
		const subtaskText = isExpandAll
			? 'Subtasks per task'
			: 'Subtasks to generate';
		content += chalk.blue(`${subtaskText}: ${numSubtasks}\n`);
	} else {
		const subtaskText = isExpandAll
			? 'Subtasks per task'
			: 'Subtasks to generate';
		content += chalk.blue(`${subtaskText}: Auto-calculated\n`);
	}

	// Add custom prompt info if provided
	if (customPrompt) {
		const promptPreview =
			customPrompt.length > 50
				? customPrompt.substring(0, 50) + '...'
				: customPrompt;
		content += chalk.blue(`Custom prompt: "${promptPreview}"`);
	}

	// Create the main message
	const message =
		chalk.bold(title) + '\n' + chalk.dim(modelLine) + '\n\n' + content;

	// Display the main boxen
	console.log(
		boxen(message, {
			padding: { top: 1, bottom: 1, left: 2, right: 2 },
			margin: { top: 0, bottom: 0 },
			borderColor: 'green',
			borderStyle: 'round'
		})
	);

	// Display force mode notice if enabled
	if (force) {
		console.log(
			chalk.red.bold('⚠️  Force mode enabled') +
				` - Will regenerate subtasks even if they already exist`
		);
		console.log(); // Add spacing
	}
}

/**
 * Display a summary of the task expansion results
 * @param {Object} summary - Summary of the expansion results
 * @param {string} [summary.taskId] - ID of specific task expanded (for single task)
 * @param {number} [summary.totalTasksProcessed] - Total number of parent tasks processed (for expand-all)
 * @param {number} summary.totalSubtasksCreated - Total number of subtasks created
 * @param {number} [summary.tasksSkipped] - Number of tasks skipped (already had subtasks)
 * @param {number} [summary.tasksWithErrors] - Number of tasks that had errors during expansion
 * @param {string} summary.tasksFilePath - Path to the tasks file
 * @param {number} summary.elapsedTime - Total elapsed time in milliseconds
 * @param {boolean} [summary.force=false] - Whether force mode was used
 * @param {boolean} [summary.research=false] - Whether research mode was used
 * @param {string} [summary.expandType='single'] - Type of expansion: 'single' or 'all'
 * @param {Array} [summary.errors] - Array of error messages if any occurred
 */
function displayExpandSummary(summary) {
	const {
		taskId,
		totalTasksProcessed = 0,
		totalSubtasksCreated = 0,
		tasksSkipped = 0,
		tasksWithErrors = 0,
		tasksFilePath,
		elapsedTime,
		force = false,
		research = false,
		expandType = 'single',
		errors = []
	} = summary;

	// Convert elapsed time from milliseconds to seconds
	const timeDisplay = formatElapsedTime(Math.floor(elapsedTime / 1000));

	// Determine if this was expand-all or single task
	const isExpandAll = expandType === 'all';

	// Build summary content similar to the original style
	let summaryContent;

	if (isExpandAll) {
		// Calculate successful expansions
		const successfulExpansions =
			totalTasksProcessed - tasksWithErrors - tasksSkipped;

		summaryContent =
			`${chalk.white.bold('Expansion Summary:')}\n\n` +
			`${chalk.cyan('-')} Attempted: ${chalk.bold(totalTasksProcessed)} (${timeDisplay})\n` +
			`${chalk.green('-')} Expanded:  ${chalk.bold(successfulExpansions)}\n` +
			`${chalk.gray('-')} Skipped:   ${chalk.bold(tasksSkipped)}\n` +
			`${chalk.red('-')} Failed:    ${chalk.bold(tasksWithErrors)}\n` +
			`${chalk.blue('-')} Subtasks:  ${chalk.bold(totalSubtasksCreated)}`;
	} else {
		summaryContent =
			`${chalk.white.bold('Task Expansion Summary:')}\n\n` +
			`${chalk.cyan('-')} Task ID:   ${chalk.bold(taskId)}\n` +
			`${chalk.green('-')} Subtasks:  ${chalk.bold(totalSubtasksCreated)}\n` +
			`${chalk.blue('-')} Time:      ${chalk.bold(timeDisplay)}`;
	}

	// Determine border color based on failures
	const borderColor = tasksWithErrors > 0 ? 'red' : 'green';

	// Display the summary in a boxed format matching the original style
	console.log(
		boxen(summaryContent, {
			padding: 1,
			margin: { top: 1 },
			borderColor: borderColor,
			borderStyle: 'round'
		})
	);

	// Show errors if any occurred
	if (errors.length > 0) {
		console.log(
			boxen(
				chalk.red.bold('⚠️ Errors Encountered') +
					'\n\n' +
					errors.map((error) => `• ${error}`).join('\n'),
				{
					padding: 1,
					borderColor: 'red',
					borderStyle: 'round',
					margin: { top: 1, bottom: 1 }
				}
			)
		);
	}

	// Show next steps
	const nextSteps = isExpandAll
		? `${chalk.cyan('1.')} Run ${chalk.yellow('task-master list')} to view all expanded tasks\n` +
			`${chalk.cyan('2.')} Run ${chalk.yellow('task-master next-task')} to find the next task to work on\n` +
			`${chalk.cyan('3.')} Run ${chalk.yellow('task-master analyze-complexity')} to analyze remaining complexity`
		: `${chalk.cyan('1.')} Run ${chalk.yellow('task-master get-task --id=' + taskId)} to view the expanded task\n` +
			`${chalk.cyan('2.')} Run ${chalk.yellow('task-master next-task')} to find the next subtask to work on\n` +
			`${chalk.cyan('3.')} Run ${chalk.yellow('task-master expand --all')} to expand other pending tasks`;

	console.log(
		boxen(chalk.white.bold('Suggested Next Steps:') + '\n\n' + nextSteps, {
			padding: 1,
			borderColor: 'cyan',
			borderStyle: 'round',
			margin: { top: 1, right: 0, bottom: 1, left: 0 }
		})
	);
}

export { displayExpandStart, displayExpandSummary, formatElapsedTime };
