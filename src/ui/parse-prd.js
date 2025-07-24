/**
 * parse-prd.js
 * UI functions specifically for PRD parsing operations
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { formatElapsedTime } from '../utils/format.js';

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
	model = 'Default',
	temperature = 0.7,
	append = false,
	research = false,
	force = false,
	existingTasks = [],
	nextId = 1
}) {
	// Determine the action verb based on append flag
	const actionVerb = append ? 'Appending' : 'Generating';

	// Create the model line with research indicator
	let modelLine = `Model: ${model} | Temperature: ${temperature}`;
	if (research) {
		modelLine += ` | ${chalk.cyan.bold('🔬 Research Mode')}`;
	}

	// Create the main message content (without append/force notices)
	const message =
		chalk.bold(`🤖 Parsing PRD and ${actionVerb} Tasks`) +
		'\n' +
		chalk.dim(modelLine) +
		'\n\n' +
		chalk.blue(`Input: ${prdFilePath}`) +
		'\n' +
		chalk.blue(`Output: ${outputPath}`) +
		'\n' +
		chalk.blue(`Tasks to ${append ? 'Append' : 'Generate'}: ${numTasks}`);

	// Display the main boxen
	console.log(
		boxen(message, {
			padding: { top: 1, bottom: 1, left: 2, right: 2 },
			margin: { top: 0, bottom: 0 },
			borderColor: 'blue',
			borderStyle: 'round'
		})
	);

	// Display append/force notices beneath the boxen if either flag is set
	if (append || force) {
		// Add append mode details if enabled
		if (append) {
			console.log(
				chalk.yellow.bold('📝 Append mode') +
					` - Adding to ${existingTasks.length} existing tasks (next ID: ${nextId})`
			);
		}

		// Add force mode details if enabled
		if (force) {
			if (append) {
				console.log(
					chalk.red.bold('⚠️  Force flag enabled') +
						` - Will overwrite if conflicts occur`
				);
			} else {
				console.log(
					chalk.red.bold('⚠️  Force flag enabled') +
						` - Overwriting existing tasks`
				);
			}
		}

		// Add a blank line after notices for spacing
		console.log();
	}
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
	// Calculate task category percentages
	const {
		totalTasks,
		taskPriorities = {},
		prdFilePath,
		outputPath,
		elapsedTime,
		usedFallback = false,
		actionVerb = 'generated' // Default to 'generated' if not provided
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
		colWidths: [28, 50]
	});

	// Basic info
	// Use the action verb to properly display if tasks were generated or appended
	table.push(
		[chalk.cyan(`Total tasks ${actionVerb}:`), chalk.bold(totalTasks)],
		[chalk.cyan('Processing time:'), chalk.bold(timeDisplay)]
	);

	// Priority distribution if available
	if (taskPriorities && Object.keys(taskPriorities).length > 0) {
		// Count tasks by priority
		const highPriority = taskPriorities.high || 0;
		const mediumPriority = taskPriorities.medium || 0;
		const lowPriority = taskPriorities.low || 0;

		// Calculate percentages
		const percentHigh = Math.round((highPriority / totalTasks) * 100);
		const percentMedium = Math.round((mediumPriority / totalTasks) * 100);
		const percentLow = Math.round((lowPriority / totalTasks) * 100);

		// Priority distribution row
		const priorityRow = [
			chalk.cyan('Priority distribution:'),
			`${chalk.hex('#CC0000').bold(highPriority)} ${chalk.hex('#CC0000')('High')} (${percentHigh}%) · ` +
				`${chalk.hex('#FF8800').bold(mediumPriority)} ${chalk.hex('#FF8800')('Medium')} (${percentMedium}%) · ` +
				`${chalk.yellow.bold(lowPriority)} ${chalk.yellow('Low')} (${percentLow}%)`
		];
		table.push(priorityRow);

		// Visual bar representation of priority distribution
		const barWidth = 40; // Total width of the bar

		// Only show bars for priorities with at least 1 task
		const highChars =
			highPriority > 0
				? Math.max(1, Math.round((highPriority / totalTasks) * barWidth))
				: 0;

		const mediumChars =
			mediumPriority > 0
				? Math.max(1, Math.round((mediumPriority / totalTasks) * barWidth))
				: 0;

		const lowChars =
			lowPriority > 0
				? Math.max(1, Math.round((lowPriority / totalTasks) * barWidth))
				: 0;

		// Adjust bar width if some priorities have 0 tasks
		const actualBarWidth = highChars + mediumChars + lowChars;

		// Use the same colors as formatComplexitySummary
		const distributionBar =
			chalk.hex('#CC0000')('█'.repeat(highChars)) +
			chalk.hex('#FF8800')('█'.repeat(mediumChars)) +
			chalk.yellow('█'.repeat(lowChars)) +
			// Add empty space if actual bar is shorter than expected
			(actualBarWidth < barWidth
				? chalk.gray('░'.repeat(barWidth - actualBarWidth))
				: '');

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

	// Return a boxed version
	console.log(
		boxen(output, {
			padding: { top: 1, right: 1, bottom: 1, left: 1 },
			borderColor: 'blue',
			borderStyle: 'round',
			margin: { top: 1, right: 1, bottom: 1, left: 0 }
		})
	);

	// Show fallback parsing warning if needed
	if (usedFallback) {
		console.log(
			boxen(
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
					chalk.white(
						"This is normal and usually doesn't indicate any issues."
					),
				{
					padding: 1,
					borderColor: 'yellow',
					borderStyle: 'round',
					margin: { top: 1, bottom: 1 }
				}
			)
		);
	}

	// Show next steps
	console.log(
		boxen(
			chalk.white.bold('Next Steps:') +
				'\n\n' +
				`${chalk.cyan('1.')} Run ${chalk.yellow('task-master list')} to view all tasks\n` +
				`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down a task into subtasks\n` +
				`${chalk.cyan('3.')} Run ${chalk.yellow('task-master analyze-complexity')} to analyze task complexity`,
			{
				padding: 1,
				borderColor: 'cyan',
				borderStyle: 'round',
				margin: { top: 1, right: 0, bottom: 1, left: 0 }
			}
		)
	);
}

export { displayParsePrdStart, displayParsePrdSummary, formatElapsedTime };
