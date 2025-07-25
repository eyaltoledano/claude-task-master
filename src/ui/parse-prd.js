/**
 * parse-prd.js
 * UI functions specifically for PRD parsing operations
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { formatElapsedTime } from '../utils/format.js';

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
	console.log(
		boxen(message, {
			padding: { top: 1, bottom: 1, left: 2, right: 2 },
			margin: { top: 0, bottom: 0 },
			borderColor: 'blue',
			borderStyle: 'round'
		})
	);
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
	model = 'Default',
	temperature = 0.7,
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

		// Calculate percentages - handle division by zero
		const percentHigh =
			totalTasks > 0 ? Math.round((highPriority / totalTasks) * 100) : 0;
		const percentMedium =
			totalTasks > 0 ? Math.round((mediumPriority / totalTasks) * 100) : 0;
		const percentLow =
			totalTasks > 0 ? Math.round((lowPriority / totalTasks) * 100) : 0;

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

		// Calculate proportional bar lengths while maintaining consistent total width
		let highChars = 0;
		let mediumChars = 0;
		let lowChars = 0;

		if (totalTasks > 0) {
			// Step 1: Calculate raw proportional lengths without minimum constraints
			const rawHighChars = (highPriority / totalTasks) * barWidth;
			const rawMediumChars = (mediumPriority / totalTasks) * barWidth;
			const rawLowChars = (lowPriority / totalTasks) * barWidth;

			// Step 2: Round down initially to get base lengths
			highChars = Math.floor(rawHighChars);
			mediumChars = Math.floor(rawMediumChars);
			lowChars = Math.floor(rawLowChars);

			// Step 3: Identify priorities with tasks but no representation yet
			const nonZeroPriorities = [];
			if (highPriority > 0 && highChars === 0) nonZeroPriorities.push('high');
			if (mediumPriority > 0 && mediumChars === 0)
				nonZeroPriorities.push('medium');
			if (lowPriority > 0 && lowChars === 0) nonZeroPriorities.push('low');

			// Step 4: Ensure non-zero priorities get at least 1 character
			for (const priority of nonZeroPriorities) {
				if (priority === 'high') highChars = 1;
				else if (priority === 'medium') mediumChars = 1;
				else if (priority === 'low') lowChars = 1;
			}

			// Step 5: Calculate remaining characters to distribute
			let currentTotal = highChars + mediumChars + lowChars;
			const remainingChars = barWidth - currentTotal;

			// Step 6: Distribute remaining characters proportionally based on decimal parts
			if (remainingChars > 0) {
				const decimals = [
					{
						priority: 'high',
						decimal: rawHighChars - Math.floor(rawHighChars),
						current: highChars
					},
					{
						priority: 'medium',
						decimal: rawMediumChars - Math.floor(rawMediumChars),
						current: mediumChars
					},
					{
						priority: 'low',
						decimal: rawLowChars - Math.floor(rawLowChars),
						current: lowChars
					}
				];

				// Sort by decimal part (largest first) to distribute remaining characters
				decimals.sort((a, b) => b.decimal - a.decimal);

				for (let i = 0; i < remainingChars && i < decimals.length; i++) {
					const priorityToIncrement = decimals[i].priority;
					if (priorityToIncrement === 'high') highChars++;
					else if (priorityToIncrement === 'medium') mediumChars++;
					else if (priorityToIncrement === 'low') lowChars++;
				}
			}

			// Step 7: Handle case where we still exceed barWidth (should be rare)
			currentTotal = highChars + mediumChars + lowChars;
			if (currentTotal > barWidth) {
				const excess = currentTotal - barWidth;
				// Remove excess from the priority with the largest representation first
				const priorities = [
					{ name: 'low', chars: lowChars },
					{ name: 'medium', chars: mediumChars },
					{ name: 'high', chars: highChars }
				].sort((a, b) => b.chars - a.chars);

				let toRemove = excess;
				for (const priority of priorities) {
					if (toRemove <= 0) break;
					const canRemove = Math.min(
						toRemove,
						priority.chars - (priority.chars > 1 ? 1 : 0)
					);
					if (priority.name === 'high') highChars -= canRemove;
					else if (priority.name === 'medium') mediumChars -= canRemove;
					else if (priority.name === 'low') lowChars -= canRemove;
					toRemove -= canRemove;
				}
			}
		}

		// Calculate actual bar width for any remaining empty space
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
