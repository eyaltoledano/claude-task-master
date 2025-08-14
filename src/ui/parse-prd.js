/**
 * parse-prd.js
 * UI functions specifically for PRD parsing operations
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { formatElapsedTime } from '../utils/format.js';

// Constants
const CONSTANTS = {
	BAR_WIDTH: 40,
	TABLE_COL_WIDTHS: [28, 50],
	DEFAULT_MODEL: 'Default',
	DEFAULT_TEMPERATURE: 0.7
};

const PRIORITIES = {
	HIGH: 'high',
	MEDIUM: 'medium',
	LOW: 'low'
};

const PRIORITY_COLORS = {
	[PRIORITIES.HIGH]: '#CC0000',
	[PRIORITIES.MEDIUM]: '#FF8800',
	[PRIORITIES.LOW]: '#FFCC00'
};

// Reusable box styles
const BOX_STYLES = {
	main: {
		padding: { top: 1, bottom: 1, left: 2, right: 2 },
		margin: { top: 0, bottom: 0 },
		borderColor: 'blue',
		borderStyle: 'round'
	},
	summary: {
		padding: { top: 1, right: 1, bottom: 1, left: 1 },
		borderColor: 'blue',
		borderStyle: 'round',
		margin: { top: 1, right: 1, bottom: 1, left: 0 }
	},
	warning: {
		padding: 1,
		borderColor: 'yellow',
		borderStyle: 'round',
		margin: { top: 1, bottom: 1 }
	},
	nextSteps: {
		padding: 1,
		borderColor: 'cyan',
		borderStyle: 'round',
		margin: { top: 1, right: 0, bottom: 1, left: 0 }
	}
};

/**
 * Helper function for building main message content
 * @param {Object} params - Message parameters
 * @param {string} params.prdFilePath - Path to the PRD file
 * @param {string} params.outputPath - Path where tasks will be saved
 * @param {number} params.numTasks - Number of tasks to generate
 * @param {string} params.model - AI model name
 * @param {number} params.temperature - AI temperature setting
 * @param {boolean} params.append - Whether appending to existing tasks
 * @param {boolean} params.research - Whether research mode is enabled
 * @returns {string} The formatted message content
 */
function buildMainMessage({
	prdFilePath,
	outputPath,
	numTasks,
	model,
	temperature,
	append,
	research
}) {
	const actionVerb = append ? 'Appending' : 'Generating';

	let modelLine = `Model: ${model} | Temperature: ${temperature}`;
	if (research) {
		modelLine += ` | ${chalk.cyan.bold('🔬 Research Mode')}`;
	}

	return (
		chalk.bold(`🤖 Parsing PRD and ${actionVerb} Tasks`) +
		'\n' +
		chalk.dim(modelLine) +
		'\n\n' +
		chalk.blue(`Input: ${prdFilePath}`) +
		'\n' +
		chalk.blue(`Output: ${outputPath}`) +
		'\n' +
		chalk.blue(`Tasks to ${append ? 'Append' : 'Generate'}: ${numTasks}`)
	);
}

/**
 * Helper function for displaying the main message box
 * @param {string} message - The message content to display in the box
 */
function displayMainMessageBox(message) {
	console.log(boxen(message, BOX_STYLES.main));
}

/**
 * Helper function for displaying append mode notice
 * @param {number} existingTasksCount - Number of existing tasks
 * @param {number} nextId - Next ID to be used
 */
function displayAppendModeNotice(existingTasksCount, nextId) {
	console.log(
		chalk.yellow.bold('📝 Append mode') +
			` - Adding to ${existingTasksCount} existing tasks (next ID: ${nextId})`
	);
}

/**
 * Helper function for force mode messages
 * @param {boolean} append - Whether in append mode
 * @returns {string} The formatted force mode message
 */
function createForceMessage(append) {
	const baseMessage = chalk.red.bold('⚠️  Force flag enabled');
	return append
		? `${baseMessage} - Will overwrite if conflicts occur`
		: `${baseMessage} - Overwriting existing tasks`;
}

/**
 * Display the start of PRD parsing with a boxen announcement
 * @param {Object} options - Options for PRD parsing start
 * @param {string} options.prdFilePath - Path to the PRD file being parsed
 * @param {string} options.outputPath - Path where the tasks will be saved
 * @param {number} options.numTasks - Number of tasks to generate
 * @param {string} [options.model] - AI model name
 * @param {number} [options.temperature] - AI temperature setting
 * @param {boolean} [options.append=false] - Whether to append to existing tasks
 * @param {boolean} [options.research=false] - Whether research mode is enabled
 * @param {boolean} [options.force=false] - Whether force mode is enabled
 * @param {Array} [options.existingTasks=[]] - Existing tasks array
 * @param {number} [options.nextId=1] - Next ID to be used
 */
function displayParsePrdStart({
	prdFilePath,
	outputPath,
	numTasks,
	model = CONSTANTS.DEFAULT_MODEL,
	temperature = CONSTANTS.DEFAULT_TEMPERATURE,
	append = false,
	research = false,
	force = false,
	existingTasks = [],
	nextId = 1
}) {
	// Input validation
	if (
		!prdFilePath ||
		typeof prdFilePath !== 'string' ||
		prdFilePath.trim() === ''
	) {
		throw new Error('prdFilePath is required and must be a non-empty string');
	}
	if (
		!outputPath ||
		typeof outputPath !== 'string' ||
		outputPath.trim() === ''
	) {
		throw new Error('outputPath is required and must be a non-empty string');
	}

	// Build and display the main message box
	const message = buildMainMessage({
		prdFilePath,
		outputPath,
		numTasks,
		model,
		temperature,
		append,
		research
	});
	displayMainMessageBox(message);

	// Display append/force notices beneath the boxen if either flag is set
	if (append || force) {
		// Add append mode details if enabled
		if (append) {
			displayAppendModeNotice(existingTasks.length, nextId);
		}

		// Add force mode details if enabled
		if (force) {
			console.log(createForceMessage(append));
		}

		// Add a blank line after notices for spacing
		console.log();
	}
}

/**
 * Calculate priority statistics
 * @param {Object} taskPriorities - Priority counts object
 * @param {number} totalTasks - Total number of tasks
 * @returns {Object} Priority statistics with counts and percentages
 */
function calculatePriorityStats(taskPriorities, totalTasks) {
	const stats = {};

	Object.values(PRIORITIES).forEach((priority) => {
		const count = taskPriorities[priority] || 0;
		stats[priority] = {
			count,
			percentage: totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0
		};
	});

	return stats;
}

/**
 * Calculate bar character distribution for priorities
 * @param {Object} priorityStats - Priority statistics
 * @param {number} totalTasks - Total number of tasks
 * @returns {Object} Character counts for each priority
 */
function calculateBarDistribution(priorityStats, totalTasks) {
	const barWidth = CONSTANTS.BAR_WIDTH;
	const distribution = {};

	if (totalTasks === 0) {
		Object.values(PRIORITIES).forEach((priority) => {
			distribution[priority] = 0;
		});
		return distribution;
	}

	// Calculate raw proportions
	const rawChars = {};
	Object.values(PRIORITIES).forEach((priority) => {
		rawChars[priority] =
			(priorityStats[priority].count / totalTasks) * barWidth;
	});

	// Initial distribution - floor values
	Object.values(PRIORITIES).forEach((priority) => {
		distribution[priority] = Math.floor(rawChars[priority]);
	});

	// Ensure non-zero priorities get at least 1 character
	Object.values(PRIORITIES).forEach((priority) => {
		if (priorityStats[priority].count > 0 && distribution[priority] === 0) {
			distribution[priority] = 1;
		}
	});

	// Distribute remaining characters based on decimal parts
	const currentTotal = Object.values(distribution).reduce(
		(sum, val) => sum + val,
		0
	);
	const remainingChars = barWidth - currentTotal;

	if (remainingChars > 0) {
		const decimals = Object.values(PRIORITIES)
			.map((priority) => ({
				priority,
				decimal: rawChars[priority] - Math.floor(rawChars[priority])
			}))
			.sort((a, b) => b.decimal - a.decimal);

		for (let i = 0; i < remainingChars && i < decimals.length; i++) {
			distribution[decimals[i].priority]++;
		}
	}

	return distribution;
}

/**
 * Create priority distribution bar visual
 * @param {Object} barDistribution - Character distribution for priorities
 * @returns {string} Visual bar string
 */
function createPriorityBar(barDistribution) {
	let bar = '';

	bar += chalk.hex(PRIORITY_COLORS[PRIORITIES.HIGH])(
		'█'.repeat(barDistribution[PRIORITIES.HIGH])
	);
	bar += chalk.hex(PRIORITY_COLORS[PRIORITIES.MEDIUM])(
		'█'.repeat(barDistribution[PRIORITIES.MEDIUM])
	);
	bar += chalk.yellow('█'.repeat(barDistribution[PRIORITIES.LOW]));

	const totalChars = Object.values(barDistribution).reduce(
		(sum, val) => sum + val,
		0
	);
	if (totalChars < CONSTANTS.BAR_WIDTH) {
		bar += chalk.gray('░'.repeat(CONSTANTS.BAR_WIDTH - totalChars));
	}

	return bar;
}

/**
 * Build priority distribution row for table
 * @param {Object} priorityStats - Priority statistics
 * @returns {Array} Table row for priority distribution
 */
function buildPriorityRow(priorityStats) {
	const parts = [];

	Object.entries(PRIORITIES).forEach(([key, priority]) => {
		const stats = priorityStats[priority];
		const color =
			priority === PRIORITIES.HIGH
				? chalk.hex(PRIORITY_COLORS[PRIORITIES.HIGH])
				: priority === PRIORITIES.MEDIUM
					? chalk.hex(PRIORITY_COLORS[PRIORITIES.MEDIUM])
					: chalk.yellow;

		const label = key.charAt(0) + key.slice(1).toLowerCase();
		parts.push(
			`${color.bold(stats.count)} ${color(label)} (${stats.percentage}%)`
		);
	});

	return [chalk.cyan('Priority distribution:'), parts.join(' · ')];
}

/**
 * Display a summary of the PRD parsing results
 * @param {Object} summary - Summary of the parsing results
 * @param {number} summary.totalTasks - Total number of tasks generated
 * @param {string} summary.prdFilePath - Path to the PRD file
 * @param {string} summary.outputPath - Path where the tasks were saved
 * @param {number} summary.elapsedTime - Total elapsed time in seconds
 * @param {Object} summary.taskPriorities - Breakdown of tasks by category/priority
 * @param {boolean} summary.usedFallback - Whether fallback parsing was used
 * @param {string} summary.actionVerb - Whether tasks were 'generated' or 'appended'
 */
function displayParsePrdSummary(summary) {
	const {
		totalTasks,
		taskPriorities = {},
		prdFilePath,
		outputPath,
		elapsedTime,
		usedFallback = false,
		actionVerb = 'generated'
	} = summary;

	// Format the elapsed time
	const timeDisplay = formatElapsedTime(elapsedTime);

	// Create a table for better alignment
	const table = new Table({
		chars: {
			top: '',
			'top-mid': '',
			'top-left': '',
			'top-right': '',
			bottom: '',
			'bottom-mid': '',
			'bottom-left': '',
			'bottom-right': '',
			left: '',
			'left-mid': '',
			mid: '',
			'mid-mid': '',
			right: '',
			'right-mid': '',
			middle: ' '
		},
		style: { border: [], 'padding-left': 2 },
		colWidths: CONSTANTS.TABLE_COL_WIDTHS
	});

	// Basic info
	// Use the action verb to properly display if tasks were generated or appended
	table.push(
		[chalk.cyan(`Total tasks ${actionVerb}:`), chalk.bold(totalTasks)],
		[chalk.cyan('Processing time:'), chalk.bold(timeDisplay)]
	);

	// Priority distribution if available
	if (taskPriorities && Object.keys(taskPriorities).length > 0) {
		const priorityStats = calculatePriorityStats(taskPriorities, totalTasks);
		const priorityRow = buildPriorityRow(priorityStats);
		table.push(priorityRow);

		// Visual bar representation
		const barDistribution = calculateBarDistribution(priorityStats, totalTasks);
		const distributionBar = createPriorityBar(barDistribution);
		table.push([chalk.cyan('Distribution:'), distributionBar]);
	}

	// Add file paths
	table.push(
		[chalk.cyan('PRD source:'), chalk.italic(prdFilePath)],
		[chalk.cyan('Tasks file:'), chalk.italic(outputPath)]
	);

	// Add fallback parsing indicator if applicable
	if (usedFallback) {
		table.push([
			chalk.yellow('Fallback parsing:'),
			chalk.yellow('✓ Used fallback parsing')
		]);
	}

	// Final string output with title and footer
	const output = [
		chalk.bold.underline(
			`PRD Parsing Complete - Tasks ${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)}`
		),
		'',
		table.toString()
	].join('\n');

	// Display the summary box
	console.log(boxen(output, BOX_STYLES.summary));

	// Show fallback parsing warning if needed
	if (usedFallback) {
		displayFallbackWarning();
	}

	// Show next steps
	displayNextSteps();
}

/**
 * Display fallback parsing warning
 */
function displayFallbackWarning() {
	const warningContent =
		chalk.yellow.bold('⚠️ Fallback Parsing Used') +
		'\n\n' +
		chalk.white(
			'The system used fallback parsing to complete task generation.'
		) +
		'\n' +
		chalk.white(
			'This typically happens when streaming JSON parsing is incomplete.'
		) +
		'\n' +
		chalk.white('Your tasks were successfully generated, but consider:') +
		'\n' +
		chalk.white('• Reviewing task completeness') +
		'\n' +
		chalk.white('• Checking for any missing details') +
		'\n\n' +
		chalk.white("This is normal and usually doesn't indicate any issues.");

	console.log(boxen(warningContent, BOX_STYLES.warning));
}

/**
 * Display next steps after parsing
 */
function displayNextSteps() {
	const stepsContent =
		chalk.white.bold('Next Steps:') +
		'\n\n' +
		`${chalk.cyan('1.')} Run ${chalk.yellow('task-master list')} to view all tasks\n` +
		`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down a task into subtasks\n` +
		`${chalk.cyan('3.')} Run ${chalk.yellow('task-master analyze-complexity')} to analyze task complexity`;

	console.log(boxen(stepsContent, BOX_STYLES.nextSteps));
}

export { displayParsePrdStart, displayParsePrdSummary, formatElapsedTime };
