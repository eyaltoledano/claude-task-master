/**
 * analyze-complexity.js
 * UI functions specifically for complexity analysis operations
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { formatElapsedTime } from '../utils/format.js';

/**
 * Display the start of complexity analysis with a boxen announcement
 * @param {Object} options - Options for complexity analysis start
 * @param {string} options.tasksFilePath - Path to the tasks file being analyzed
 * @param {string} options.outputPath - Path where the report will be saved
 * @param {number} options.numTasks - Number of tasks to analyze
 * @param {string} [options.model] - AI model name
 * @param {number} [options.temperature] - AI temperature setting
 * @param {boolean} [options.research=false] - Whether research mode is enabled
 * @param {number} [options.threshold=5] - Complexity threshold for recommendations
 * @param {string} [options.analysisScope] - Description of what's being analyzed (e.g., "all pending tasks", "specific task IDs: 1,2,3")
 */
function displayAnalyzeComplexityStart({
	tasksFilePath,
	outputPath,
	numTasks,
	model = 'Default',
	temperature = 0.7,
	research = false,
	threshold = 5,
	analysisScope = 'all pending tasks'
}) {
	// Create the model line with research indicator
	let modelLine = `Model: ${model} | Temperature: ${temperature} | Threshold: ${threshold}`;
	if (research) {
		modelLine += ` | ${chalk.cyan.bold('🔬 Research Mode')}`;
	}

	// Create the main message content
	const message =
		chalk.bold(`🧠 Analyzing Task Complexity`) +
		'\n' +
		chalk.dim(modelLine) +
		'\n\n' +
		chalk.blue(`Input: ${tasksFilePath}`) +
		'\n' +
		chalk.blue(`Output: ${outputPath}`) +
		'\n' +
		chalk.blue(`Analyzing: ${analysisScope}`) +
		'\n' +
		chalk.blue(`Tasks to analyze: ${numTasks}`);

	// Display the main boxen
	console.log(
		boxen(message, {
			padding: { top: 1, bottom: 1, left: 2, right: 2 },
			margin: { top: 0, bottom: 0 },
			borderColor: 'magenta',
			borderStyle: 'round'
		})
	);

	console.log(); // Add spacing after the header
}

/**
 * Display a summary of the complexity analysis results
 * @param {Object} summary - Summary of the analysis results
 * @param {number} summary.totalAnalyzed - Total number of tasks analyzed in this run
 * @param {number} summary.highComplexity - Number of high complexity tasks in this run
 * @param {number} summary.mediumComplexity - Number of medium complexity tasks in this run
 * @param {number} summary.lowComplexity - Number of low complexity tasks in this run
 * @param {string} summary.tasksFilePath - Path to the tasks file
 * @param {string} summary.outputPath - Path where the report was saved
 * @param {number} summary.elapsedTime - Total elapsed time in milliseconds
 * @param {boolean} [summary.research=false] - Whether research mode was used
 * @param {number} [summary.threshold=5] - Complexity threshold used
 * @param {string} [summary.analysisScope] - Description of what was analyzed
 * @param {number} [summary.totalInReport] - Total analyses in the final report (including previous runs)
 * @param {number} [summary.previousAnalyses] - Number of analyses from previous runs
 */
function displayAnalyzeComplexitySummary(summary) {
	const {
		totalAnalyzed,
		highComplexity = 0,
		mediumComplexity = 0,
		lowComplexity = 0,
		tasksFilePath,
		outputPath,
		elapsedTime,
		research = false,
		threshold = 5,
		analysisScope = 'tasks',
		totalInReport,
		previousAnalyses
	} = summary;

	// Convert elapsed time from milliseconds to seconds
	const timeDisplay = formatElapsedTime(Math.floor(elapsedTime / 1000));

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

	// Basic analysis info
	table.push([
		chalk.cyan('Tasks analyzed:'),
		chalk.bold(`${totalAnalyzed} (${timeDisplay})`)
	]);

	// Report update info (if applicable)
	if (totalInReport && previousAnalyses !== undefined) {
		table.push([
			chalk.cyan('Report status:'),
			`${chalk.bold(totalInReport)} total · ${chalk.dim(previousAnalyses)} previous · ${chalk.green.bold(totalAnalyzed)} new`
		]);
	}

	// Complexity distribution if we have tasks
	if (totalAnalyzed > 0) {
		// Calculate percentages
		const percentHigh = Math.round((highComplexity / totalAnalyzed) * 100);
		const percentMedium = Math.round((mediumComplexity / totalAnalyzed) * 100);
		const percentLow = Math.round((lowComplexity / totalAnalyzed) * 100);

		// Complexity distribution row
		const complexityRow = [
			chalk.cyan('Complexity breakdown:'),
			`${chalk.red.bold(highComplexity)} ${chalk.red('High')} (${percentHigh}%) · ` +
				`${chalk.hex('#FF8800').bold(mediumComplexity)} ${chalk.hex('#FF8800')('Medium')} (${percentMedium}%) · ` +
				`${chalk.green.bold(lowComplexity)} ${chalk.green('Low')} (${percentLow}%)`
		];
		table.push(complexityRow);

		// Visual bar representation of complexity distribution
		const barWidth = 40; // Total width of the bar

		// Only show bars for complexities with at least 1 task
		const highChars =
			highComplexity > 0
				? Math.max(1, Math.round((highComplexity / totalAnalyzed) * barWidth))
				: 0;

		const mediumChars =
			mediumComplexity > 0
				? Math.max(1, Math.round((mediumComplexity / totalAnalyzed) * barWidth))
				: 0;

		const lowChars =
			lowComplexity > 0
				? Math.max(1, Math.round((lowComplexity / totalAnalyzed) * barWidth))
				: 0;

		// Adjust bar width if some complexities have 0 tasks
		const actualBarWidth = highChars + mediumChars + lowChars;

		// Use complexity colors
		const distributionBar =
			chalk.red('█'.repeat(highChars)) +
			chalk.hex('#FF8800')('█'.repeat(mediumChars)) +
			chalk.green('█'.repeat(lowChars)) +
			// Add empty space if actual bar is shorter than expected
			(actualBarWidth < barWidth
				? chalk.gray('░'.repeat(barWidth - actualBarWidth))
				: '');

		table.push([chalk.cyan('Distribution:'), distributionBar]);
	}

	// Analysis settings only (file paths already shown in header)
	table.push(
		[chalk.cyan('Analysis scope:'), chalk.italic(analysisScope)],
		[
			chalk.cyan('Settings:'),
			`Threshold: ${chalk.bold(threshold)}${research ? ` · ${chalk.cyan('🔬 Research')}` : ''}`
		]
	);

	// Final string output with title
	const output = [
		chalk.bold.underline('Complexity Analysis Complete'),
		'',
		table.toString()
	].join('\n');

	// Display the summary in a boxed format
	console.log(
		boxen(output, {
			padding: { top: 1, right: 1, bottom: 1, left: 1 },
			borderColor: 'magenta',
			borderStyle: 'round',
			margin: { top: 1, right: 1, bottom: 1, left: 0 }
		})
	);

	// Show next steps
	console.log(
		boxen(
			chalk.white.bold('Suggested Next Steps:') +
				'\n\n' +
				`${chalk.cyan('1.')} Run ${chalk.yellow('task-master complexity-report')} to review detailed findings\n` +
				`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down complex tasks\n` +
				`${chalk.cyan('3.')} Run ${chalk.yellow('task-master expand --all')} to expand all pending tasks based on complexity`,
			{
				padding: 1,
				borderColor: 'cyan',
				borderStyle: 'round',
				margin: { top: 1, right: 0, bottom: 1, left: 0 }
			}
		)
	);
}

export {
	displayAnalyzeComplexityStart,
	displayAnalyzeComplexitySummary,
	formatElapsedTime
};
