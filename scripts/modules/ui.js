/**
 * ui.js
 * User interface functions for the Task Master CLI
 */

import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import ora from 'ora';
import Table from 'cli-table3';
import gradient from 'gradient-string';
import {
	CONFIG,
	log,
	findTaskById,
	readJSON,
	readComplexityReport,
	truncate
} from './utils.js';
import path from 'path';
import fs from 'fs';
import { findNextTask, analyzeTaskComplexity } from './task-manager.js';

// Create a color gradient for the banner
const coolGradient = gradient(['#00b4d8', '#0077b6', '#03045e']);
const warmGradient = gradient(['#fb8b24', '#e36414', '#9a031e']);

/**
 * Display a fancy banner for the CLI
 */
function displayBanner() {
	console.clear();
	const bannerText = figlet.textSync('Task Master', {
		font: 'Standard',
		horizontalLayout: 'default',
		verticalLayout: 'default'
	});

	console.log(coolGradient(bannerText));

	// Add creator credit line below the banner
	console.log(
		chalk.dim('by ') + chalk.cyan.underline('https://x.com/eyaltoledano')
	);

	// Read version directly from package.json
	let version = CONFIG.projectVersion; // Default fallback
	try {
		const packageJsonPath = path.join(process.cwd(), 'package.json');
		if (fs.existsSync(packageJsonPath)) {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			version = packageJson.version;
		}
	} catch (error) {
		// Silently fall back to default version
	}

	console.log(
		boxen(
			chalk.white(
				`${chalk.bold('Version:')} ${version}   ${chalk.bold('Project:')} ${CONFIG.projectName}`
			),
			{
				padding: 1,
				margin: { top: 0, bottom: 1 },
				borderStyle: 'round',
				borderColor: 'cyan'
			}
		)
	);
}

/**
 * Start a loading indicator with an animated spinner
 * @param {string} message - Message to display next to the spinner
 * @returns {Object} Spinner object
 */
function startLoadingIndicator(message) {
	const spinner = ora({
		text: message,
		color: 'cyan'
	}).start();

	return spinner;
}

/**
 * Stop a loading indicator
 * @param {Object} spinner - Spinner object to stop
 */
function stopLoadingIndicator(spinner) {
	if (spinner && spinner.stop) {
		spinner.stop();
	}
}

/**
 * Create a colored progress bar
 * @param {number} percent - The completion percentage
 * @param {number} length - The total length of the progress bar in characters
 * @param {Object} statusBreakdown - Optional breakdown of non-complete statuses (e.g., {pending: 20, 'in-progress': 10})
 * @returns {string} The formatted progress bar
 */
function createProgressBar(percent, length = 30, statusBreakdown = null) {
	// Adjust the percent to treat deferred and cancelled as complete
	const effectivePercent = statusBreakdown
		? Math.min(
				100,
				percent +
					(statusBreakdown.deferred || 0) +
					(statusBreakdown.cancelled || 0)
			)
		: percent;

	// Calculate how many characters to fill for "true completion"
	const trueCompletedFilled = Math.round((percent * length) / 100);

	// Calculate how many characters to fill for "effective completion" (including deferred/cancelled)
	const effectiveCompletedFilled = Math.round(
		(effectivePercent * length) / 100
	);

	// The "deferred/cancelled" section (difference between true and effective)
	const deferredCancelledFilled =
		effectiveCompletedFilled - trueCompletedFilled;

	// Set the empty section (remaining after effective completion)
	const empty = length - effectiveCompletedFilled;

	// Determine color based on percentage for the completed section
	let completedColor;
	if (percent < 25) {
		completedColor = chalk.red;
	} else if (percent < 50) {
		completedColor = chalk.hex('#FFA500'); // Orange
	} else if (percent < 75) {
		completedColor = chalk.yellow;
	} else if (percent < 100) {
		completedColor = chalk.green;
	} else {
		completedColor = chalk.hex('#006400'); // Dark green
	}

	// Create colored sections
	const completedSection = completedColor('█'.repeat(trueCompletedFilled));

	// Gray section for deferred/cancelled items
	const deferredCancelledSection = chalk.gray(
		'█'.repeat(deferredCancelledFilled)
	);

	// If we have a status breakdown, create a multi-colored remaining section
	let remainingSection = '';

	if (statusBreakdown && empty > 0) {
		// Status colors (matching the statusConfig colors in getStatusWithColor)
		const statusColors = {
			pending: chalk.yellow,
			'in-progress': chalk.hex('#FFA500'), // Orange
			blocked: chalk.red,
			review: chalk.magenta
			// Deferred and cancelled are treated as part of the completed section
		};

		// Calculate proportions for each status
		const totalRemaining = Object.entries(statusBreakdown)
			.filter(
				([status]) =>
					!['deferred', 'cancelled', 'done', 'completed'].includes(status)
			)
			.reduce((sum, [_, val]) => sum + val, 0);

		// If no remaining tasks with tracked statuses, just use gray
		if (totalRemaining <= 0) {
			remainingSection = chalk.gray('░'.repeat(empty));
		} else {
			// Track how many characters we've added
			let addedChars = 0;

			// Add each status section proportionally
			for (const [status, percentage] of Object.entries(statusBreakdown)) {
				// Skip statuses that are considered complete
				if (['deferred', 'cancelled', 'done', 'completed'].includes(status))
					continue;

				// Calculate how many characters this status should fill
				const statusChars = Math.round((percentage / totalRemaining) * empty);

				// Make sure we don't exceed the total length due to rounding
				const actualChars = Math.min(statusChars, empty - addedChars);

				// Add colored section for this status
				const colorFn = statusColors[status] || chalk.gray;
				remainingSection += colorFn('░'.repeat(actualChars));

				addedChars += actualChars;
			}

			// If we have any remaining space due to rounding, fill with gray
			if (addedChars < empty) {
				remainingSection += chalk.gray('░'.repeat(empty - addedChars));
			}
		}
	} else {
		// Default to gray for the empty section if no breakdown provided
		remainingSection = chalk.gray('░'.repeat(empty));
	}

	// Effective percentage text color should reflect the highest category
	const percentTextColor =
		percent === 100
			? chalk.hex('#006400') // Dark green for 100%
			: effectivePercent === 100
				? chalk.gray // Gray for 100% with deferred/cancelled
				: completedColor; // Otherwise match the completed color

	// Build the complete progress bar
	return `${completedSection}${deferredCancelledSection}${remainingSection} ${percentTextColor(`${effectivePercent.toFixed(0)}%`)}`;
}

/**
 * Get a colored status string based on the status value
 * @param {string} status - Task status (e.g., "done", "pending", "in-progress")
 * @param {boolean} forTable - Whether the status is being displayed in a table
 * @returns {string} Colored status string
 */
function getStatusWithColor(status, forTable = false) {
	if (!status) {
		return chalk.gray('❓ unknown');
	}

	const statusConfig = {
		done: { color: chalk.green, icon: '✅', tableIcon: '✓' },
		completed: { color: chalk.green, icon: '✅', tableIcon: '✓' },
		pending: { color: chalk.yellow, icon: '⏱️', tableIcon: '⏱' },
		'in-progress': { color: chalk.hex('#FFA500'), icon: '🔄', tableIcon: '►' },
		deferred: { color: chalk.gray, icon: '⏱️', tableIcon: '⏱' },
		blocked: { color: chalk.red, icon: '❌', tableIcon: '✗' },
		review: { color: chalk.magenta, icon: '👀', tableIcon: '👁' },
		cancelled: { color: chalk.gray, icon: '❌', tableIcon: '✗' }
	};

	const config = statusConfig[status.toLowerCase()] || {
		color: chalk.red,
		icon: '❌',
		tableIcon: '✗'
	};

	// Use simpler icons for table display to prevent border issues
	if (forTable) {
		// Use ASCII characters instead of Unicode for completely stable display
		const simpleIcons = {
			done: '✓',
			completed: '✓',
			pending: '○',
			'in-progress': '►',
			deferred: 'x',
			blocked: '!', // Using plain x character for better compatibility
			review: '?' // Using circled dot symbol
		};
		const simpleIcon = simpleIcons[status.toLowerCase()] || 'x';
		return config.color(`${simpleIcon} ${status}`);
	}

	return config.color(`${config.icon} ${status}`);
}

/**
 * Format dependencies list with status indicators
 * @param {Array} dependencies - Array of dependency IDs
 * @param {Array} allTasks - Array of all tasks
 * @param {boolean} forConsole - Whether the output is for console display
 * @returns {string} Formatted dependencies string
 */
function formatDependenciesWithStatus(
	dependencies,
	allTasks,
	forConsole = false
) {
	if (
		!dependencies ||
		!Array.isArray(dependencies) ||
		dependencies.length === 0
	) {
		return forConsole ? chalk.gray('None') : 'None';
	}

	const formattedDeps = dependencies.map((depId) => {
		const depIdStr = depId.toString(); // Ensure string format for display

		// Check if it's already a fully qualified subtask ID (like "22.1")
		if (depIdStr.includes('.')) {
			const [parentId, subtaskId] = depIdStr
				.split('.')
				.map((id) => parseInt(id, 10));

			// Find the parent task
			const parentTask = allTasks.find((t) => t.id === parentId);
			if (!parentTask || !parentTask.subtasks) {
				return forConsole
					? chalk.red(`${depIdStr} (Not found)`)
					: `${depIdStr} (Not found)`;
			}

			// Find the subtask
			const subtask = parentTask.subtasks.find((st) => st.id === subtaskId);
			if (!subtask) {
				return forConsole
					? chalk.red(`${depIdStr} (Not found)`)
					: `${depIdStr} (Not found)`;
			}

			// Format with status
			const status = subtask.status || 'pending';
			const isDone =
				status.toLowerCase() === 'done' || status.toLowerCase() === 'completed';
			const isInProgress = status.toLowerCase() === 'in-progress';

			if (forConsole) {
				if (isDone) {
					return chalk.green.bold(depIdStr);
				} else if (isInProgress) {
					return chalk.hex('#FFA500').bold(depIdStr);
				} else {
					return chalk.red.bold(depIdStr);
				}
			}

			// For plain text output (task files), return just the ID without any formatting or emoji
			return depIdStr;
		}

		// If depId is a number less than 100, it's likely a reference to a subtask ID in the current task
		// This case is typically handled elsewhere (in task-specific code) before calling this function

		// For regular task dependencies (not subtasks)
		// Convert string depId to number if needed
		const numericDepId =
			typeof depId === 'string' ? parseInt(depId, 10) : depId;

		// Look up the task using the numeric ID
		const depTask = findTaskById(allTasks, numericDepId);

		if (!depTask) {
			return forConsole
				? chalk.red(`${depIdStr} (Not found)`)
				: `${depIdStr} (Not found)`;
		}

		// Format with status
		const status = depTask.status || 'pending';
		const isDone =
			status.toLowerCase() === 'done' || status.toLowerCase() === 'completed';
		const isInProgress = status.toLowerCase() === 'in-progress';

		if (forConsole) {
			if (isDone) {
				return chalk.green.bold(depIdStr);
			} else if (isInProgress) {
				return chalk.yellow.bold(depIdStr);
			} else {
				return chalk.red.bold(depIdStr);
			}
		}

		// For plain text output (task files), return just the ID without any formatting or emoji
		return depIdStr;
	});

	return formattedDeps.join(', ');
}

/**
 * Display a comprehensive help guide
 */
function displayHelp() {
	displayBanner();

	console.log(
		boxen(chalk.white.bold('Task Master CLI'), {
			padding: 1,
			borderColor: 'blue',
			borderStyle: 'round',
			margin: { top: 1, bottom: 1 }
		})
	);

	// Command categories
	const commandCategories = [
		{
			title: 'Task Generation',
			color: 'cyan',
			commands: [
				{
					name: 'parse-prd',
					args: '--input=<file.txt> [--tasks=10]',
					desc: 'Generate tasks from a PRD document'
				},
				{
					name: 'generate',
					args: '',
					desc: 'Create individual task files from tasks.json'
				}
			]
		},
		{
			title: 'Task Management',
			color: 'green',
			commands: [
				{
					name: 'list',
					args: '[--status=<status>] [--with-subtasks]',
					desc: 'List all tasks with their status'
				},
				{
					name: 'set-status',
					args: '--id=<id> --status=<status>',
					desc: 'Update task status (done, pending, etc.)'
				},
				{
					name: 'update',
					args: '--from=<id> --prompt="<context>"',
					desc: 'Update tasks based on new requirements'
				},
				{
					name: 'add-task',
					args: '--prompt="<text>" [--dependencies=<ids>] [--priority=<priority>]',
					desc: 'Add a new task using AI'
				},
				{
					name: 'add-dependency',
					args: '--id=<id> --depends-on=<id>',
					desc: 'Add a dependency to a task'
				},
				{
					name: 'remove-dependency',
					args: '--id=<id> --depends-on=<id>',
					desc: 'Remove a dependency from a task'
				}
			]
		},
		{
			title: 'Task Analysis & Detail',
			color: 'yellow',
			commands: [
				{
					name: 'analyze-complexity',
					args: '[--research] [--threshold=5]',
					desc: 'Analyze tasks and generate expansion recommendations'
				},
				{
					name: 'complexity-report',
					args: '[--file=<path>]',
					desc: 'Display the complexity analysis report'
				},
				{
					name: 'expand',
					args: '--id=<id> [--num=5] [--research] [--prompt="<context>"]',
					desc: 'Break down tasks into detailed subtasks'
				},
				{
					name: 'expand --all',
					args: '[--force] [--research]',
					desc: 'Expand all pending tasks with subtasks'
				},
				{
					name: 'clear-subtasks',
					args: '--id=<id>',
					desc: 'Remove subtasks from specified tasks'
				}
			]
		},
		{
			title: 'Task Navigation & Viewing',
			color: 'magenta',
			commands: [
				{
					name: 'next',
					args: '',
					desc: 'Show the next task to work on based on dependencies'
				},
				{
					name: 'show',
					args: '<id>',
					desc: 'Display detailed information about a specific task'
				}
			]
		},
		{
			title: 'Dependency Management',
			color: 'blue',
			commands: [
				{
					name: 'validate-dependencies',
					args: '',
					desc: 'Identify invalid dependencies without fixing them'
				},
				{
					name: 'fix-dependencies',
					args: '',
					desc: 'Fix invalid dependencies automatically'
				}
			]
		}
	];

	// Display each category
	commandCategories.forEach((category) => {
		console.log(
			boxen(chalk[category.color].bold(category.title), {
				padding: { left: 2, right: 2, top: 0, bottom: 0 },
				margin: { top: 1, bottom: 0 },
				borderColor: category.color,
				borderStyle: 'round'
			})
		);

		const commandTable = new Table({
			colWidths: [25, 40, 45],
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
			style: { border: [], 'padding-left': 4 }
		});

		category.commands.forEach((cmd, index) => {
			commandTable.push([
				`${chalk.yellow.bold(cmd.name)}${chalk.reset('')}`,
				`${chalk.white(cmd.args)}${chalk.reset('')}`,
				`${chalk.dim(cmd.desc)}${chalk.reset('')}`
			]);
		});

		console.log(commandTable.toString());
		console.log('');
	});

	// Display environment variables section
	console.log(
		boxen(chalk.cyan.bold('Environment Variables'), {
			padding: { left: 2, right: 2, top: 0, bottom: 0 },
			margin: { top: 1, bottom: 0 },
			borderColor: 'cyan',
			borderStyle: 'round'
		})
	);

	const envTable = new Table({
		colWidths: [30, 50, 30],
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
		style: { border: [], 'padding-left': 4 }
	});

	envTable.push(
		[
			`${chalk.yellow('ANTHROPIC_API_KEY')}${chalk.reset('')}`,
			`${chalk.white('Your Anthropic API key')}${chalk.reset('')}`,
			`${chalk.dim('Required')}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('MODEL')}${chalk.reset('')}`,
			`${chalk.white('Claude model to use')}${chalk.reset('')}`,
			`${chalk.dim(`Default: ${CONFIG.model}`)}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('MAX_TOKENS')}${chalk.reset('')}`,
			`${chalk.white('Maximum tokens for responses')}${chalk.reset('')}`,
			`${chalk.dim(`Default: ${CONFIG.maxTokens}`)}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('TEMPERATURE')}${chalk.reset('')}`,
			`${chalk.white('Temperature for model responses')}${chalk.reset('')}`,
			`${chalk.dim(`Default: ${CONFIG.temperature}`)}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('PERPLEXITY_API_KEY')}${chalk.reset('')}`,
			`${chalk.white('Perplexity API key for research')}${chalk.reset('')}`,
			`${chalk.dim('Optional')}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('PERPLEXITY_MODEL')}${chalk.reset('')}`,
			`${chalk.white('Perplexity model to use')}${chalk.reset('')}`,
			`${chalk.dim('Default: sonar-pro')}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('DEBUG')}${chalk.reset('')}`,
			`${chalk.white('Enable debug logging')}${chalk.reset('')}`,
			`${chalk.dim(`Default: ${CONFIG.debug}`)}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('LOG_LEVEL')}${chalk.reset('')}`,
			`${chalk.white('Console output level (debug,info,warn,error)')}${chalk.reset('')}`,
			`${chalk.dim(`Default: ${CONFIG.logLevel}`)}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('DEFAULT_SUBTASKS')}${chalk.reset('')}`,
			`${chalk.white('Default number of subtasks to generate')}${chalk.reset('')}`,
			`${chalk.dim(`Default: ${CONFIG.defaultSubtasks}`)}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('DEFAULT_PRIORITY')}${chalk.reset('')}`,
			`${chalk.white('Default task priority')}${chalk.reset('')}`,
			`${chalk.dim(`Default: ${CONFIG.defaultPriority}`)}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('PROJECT_NAME')}${chalk.reset('')}`,
			`${chalk.white('Project name displayed in UI')}${chalk.reset('')}`,
			`${chalk.dim(`Default: ${CONFIG.projectName}`)}${chalk.reset('')}`
		]
	);

	console.log(envTable.toString());
	console.log('');
}

/**
 * Get colored complexity score
 * @param {number} score - Complexity score (1-10)
 * @returns {string} Colored complexity score
 */
function getComplexityWithColor(score) {
	if (score <= 3) return chalk.green(`🟢 ${score}`);
	if (score <= 6) return chalk.yellow(`🟡 ${score}`);
	return chalk.red(`🔴 ${score}`);
}

/**
 * Truncate a string to a maximum length and add ellipsis if needed
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength) {
	if (!str) return '';
	if (str.length <= maxLength) return str;
	return str.substring(0, maxLength - 3) + '...';
}

/**
 * Display the next task to work on
 * @param {string} tasksPath - Path to the tasks.json file
 */
async function displayNextTask(tasksPath) {
	displayBanner();

	// Read the tasks file
	const data = readJSON(tasksPath);
	if (!data || !data.tasks) {
		log('error', 'No valid tasks found.');
		process.exit(1);
	}

	// Find the next task
	const nextTask = findNextTask(data.tasks);

	if (!nextTask) {
		console.log(
			boxen(
				chalk.yellow('No eligible tasks found!\n\n') +
					'All pending tasks have unsatisfied dependencies, or all tasks are completed.',
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'yellow',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);
		return;
	}

	// Display the task in a nice format
	console.log(
		boxen(chalk.white.bold(`Next Task: #${nextTask.id} - ${nextTask.title}`), {
			padding: { top: 0, bottom: 0, left: 1, right: 1 },
			borderColor: 'blue',
			borderStyle: 'round',
			margin: { top: 1, bottom: 0 }
		})
	);

	// Create a table with task details
	const taskTable = new Table({
		style: {
			head: [],
			border: [],
			'padding-top': 0,
			'padding-bottom': 0,
			compact: true
		},
		chars: {
			mid: '',
			'left-mid': '',
			'mid-mid': '',
			'right-mid': ''
		},
		colWidths: [15, Math.min(75, process.stdout.columns - 20 || 60)],
		wordWrap: true
	});

	// Priority with color
	const priorityColors = {
		high: chalk.red.bold,
		medium: chalk.yellow,
		low: chalk.gray
	};
	const priorityColor =
		priorityColors[nextTask.priority || 'medium'] || chalk.white;

	// Add task details to table
	taskTable.push(
		[chalk.cyan.bold('ID:'), nextTask.id.toString()],
		[chalk.cyan.bold('Title:'), nextTask.title],
		[
			chalk.cyan.bold('Priority:'),
			priorityColor(nextTask.priority || 'medium')
		],
		[
			chalk.cyan.bold('Dependencies:'),
			formatDependenciesWithStatus(nextTask.dependencies, data.tasks, true)
		],
		[chalk.cyan.bold('Description:'), nextTask.description]
	);

	console.log(taskTable.toString());

	// If task has details, show them in a separate box
	if (nextTask.details && nextTask.details.trim().length > 0) {
		console.log(
			boxen(
				chalk.white.bold('Implementation Details:') + '\n\n' + nextTask.details,
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'cyan',
					borderStyle: 'round',
					margin: { top: 1, bottom: 0 }
				}
			)
		);
	}

	// Show subtasks if they exist
	if (nextTask.subtasks && nextTask.subtasks.length > 0) {
		console.log(
			boxen(chalk.white.bold('Subtasks'), {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				margin: { top: 1, bottom: 0 },
				borderColor: 'magenta',
				borderStyle: 'round'
			})
		);

		// Calculate available width for the subtask table
		const availableWidth = process.stdout.columns - 10 || 100; // Default to 100 if can't detect

		// Define percentage-based column widths
		const idWidthPct = 8;
		const statusWidthPct = 15;
		const depsWidthPct = 25;
		const titleWidthPct = 100 - idWidthPct - statusWidthPct - depsWidthPct;

		// Calculate actual column widths
		const idWidth = Math.floor(availableWidth * (idWidthPct / 100));
		const statusWidth = Math.floor(availableWidth * (statusWidthPct / 100));
		const depsWidth = Math.floor(availableWidth * (depsWidthPct / 100));
		const titleWidth = Math.floor(availableWidth * (titleWidthPct / 100));

		// Create a table for subtasks with improved handling
		const subtaskTable = new Table({
			head: [
				chalk.magenta.bold('ID'),
				chalk.magenta.bold('Status'),
				chalk.magenta.bold('Title'),
				chalk.magenta.bold('Deps')
			],
			colWidths: [idWidth, statusWidth, titleWidth, depsWidth],
			style: {
				head: [],
				border: [],
				'padding-top': 0,
				'padding-bottom': 0,
				compact: true
			},
			chars: {
				mid: '',
				'left-mid': '',
				'mid-mid': '',
				'right-mid': ''
			},
			wordWrap: true
		});

		// Add subtasks to table
		nextTask.subtasks.forEach((st) => {
			const statusColor =
				{
					done: chalk.green,
					completed: chalk.green,
					pending: chalk.yellow,
					'in-progress': chalk.blue
				}[st.status || 'pending'] || chalk.white;

			// Format subtask dependencies
			let subtaskDeps = 'None';
			if (st.dependencies && st.dependencies.length > 0) {
				// Format dependencies with correct notation
				const formattedDeps = st.dependencies.map((depId) => {
					if (typeof depId === 'number' && depId < 100) {
						const foundSubtask = nextTask.subtasks.find(
							(st) => st.id === depId
						);
						if (foundSubtask) {
							const isDone =
								foundSubtask.status === 'done' ||
								foundSubtask.status === 'completed';
							const isInProgress = foundSubtask.status === 'in-progress';

							// Use consistent color formatting instead of emojis
							if (isDone) {
								return chalk.green.bold(`${nextTask.id}.${depId}`);
							} else if (isInProgress) {
								return chalk.hex('#FFA500').bold(`${nextTask.id}.${depId}`);
							} else {
								return chalk.red.bold(`${nextTask.id}.${depId}`);
							}
						}
						return chalk.red(`${nextTask.id}.${depId} (Not found)`);
					}
					return depId;
				});

				// Join the formatted dependencies directly instead of passing to formatDependenciesWithStatus again
				subtaskDeps =
					formattedDeps.length === 1
						? formattedDeps[0]
						: formattedDeps.join(chalk.white(', '));
			}

			subtaskTable.push([
				`${nextTask.id}.${st.id}`,
				statusColor(st.status || 'pending'),
				st.title,
				subtaskDeps
			]);
		});

		console.log(subtaskTable.toString());
	} else {
		// Suggest expanding if no subtasks
		console.log(
			boxen(
				chalk.yellow('No subtasks found. Consider breaking down this task:') +
					'\n' +
					chalk.white(
						`Run: ${chalk.cyan(`task-master expand --id=${nextTask.id}`)}`
					),
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'yellow',
					borderStyle: 'round',
					margin: { top: 1, bottom: 0 }
				}
			)
		);
	}

	// Show action suggestions
	console.log(
		boxen(
			chalk.white.bold('Suggested Actions:') +
				'\n' +
				`${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=in-progress`)}\n` +
				`${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=done`)}\n` +
				(nextTask.subtasks && nextTask.subtasks.length > 0
					? `${chalk.cyan('3.')} Update subtask status: ${chalk.yellow(`task-master set-status --id=${nextTask.id}.1 --status=done`)}`
					: `${chalk.cyan('3.')} Break down into subtasks: ${chalk.yellow(`task-master expand --id=${nextTask.id}`)}`),
			{
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: 'green',
				borderStyle: 'round',
				margin: { top: 1 }
			}
		)
	);
}

/**
 * Display a specific task by ID
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string|number} taskId - The ID of the task to display
 */
async function displayTaskById(tasksPath, taskId) {
	displayBanner();

	// Read the tasks file
	const data = readJSON(tasksPath);
	if (!data || !data.tasks) {
		log('error', 'No valid tasks found.');
		process.exit(1);
	}

	// Find the task by ID
	const task = findTaskById(data.tasks, taskId);

	if (!task) {
		console.log(
			boxen(chalk.yellow(`Task with ID ${taskId} not found!`), {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: 'yellow',
				borderStyle: 'round',
				margin: { top: 1 }
			})
		);
		return;
	}

	// Handle subtask display specially
	if (task.isSubtask || task.parentTask) {
		console.log(
			boxen(
				chalk.white.bold(
					`Subtask: #${task.parentTask.id}.${task.id} - ${task.title}`
				),
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'magenta',
					borderStyle: 'round',
					margin: { top: 1, bottom: 0 }
				}
			)
		);

		// Create a table with subtask details
		const taskTable = new Table({
			style: {
				head: [],
				border: [],
				'padding-top': 0,
				'padding-bottom': 0,
				compact: true
			},
			chars: {
				mid: '',
				'left-mid': '',
				'mid-mid': '',
				'right-mid': ''
			},
			colWidths: [15, Math.min(75, process.stdout.columns - 20 || 60)],
			wordWrap: true
		});

		// Add subtask details to table
		taskTable.push(
			[chalk.cyan.bold('ID:'), `${task.parentTask.id}.${task.id}`],
			[
				chalk.cyan.bold('Parent Task:'),
				`#${task.parentTask.id} - ${task.parentTask.title}`
			],
			[chalk.cyan.bold('Title:'), task.title],
			[
				chalk.cyan.bold('Status:'),
				getStatusWithColor(task.status || 'pending', true)
			],
			[
				chalk.cyan.bold('Description:'),
				task.description || 'No description provided.'
			]
		);

		console.log(taskTable.toString());

		// Show details if they exist for subtasks
		if (task.details && task.details.trim().length > 0) {
			console.log(
				boxen(
					chalk.white.bold('Implementation Details:') + '\n\n' + task.details,
					{
						padding: { top: 0, bottom: 0, left: 1, right: 1 },
						borderColor: 'cyan',
						borderStyle: 'round',
						margin: { top: 1, bottom: 0 }
					}
				)
			);
		}

		// Show action suggestions for subtask
		console.log(
			boxen(
				chalk.white.bold('Suggested Actions:') +
					'\n' +
					`${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`task-master set-status --id=${task.parentTask.id}.${task.id} --status=in-progress`)}\n` +
					`${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`task-master set-status --id=${task.parentTask.id}.${task.id} --status=done`)}\n` +
					`${chalk.cyan('3.')} View parent task: ${chalk.yellow(`task-master show --id=${task.parentTask.id}`)}`,
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'green',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);

		// Calculate and display subtask completion progress
		if (task.subtasks && task.subtasks.length > 0) {
			const totalSubtasks = task.subtasks.length;
			const completedSubtasks = task.subtasks.filter(
				(st) => st.status === 'done' || st.status === 'completed'
			).length;

			// Count other statuses for the subtasks
			const inProgressSubtasks = task.subtasks.filter(
				(st) => st.status === 'in-progress'
			).length;
			const pendingSubtasks = task.subtasks.filter(
				(st) => st.status === 'pending'
			).length;
			const blockedSubtasks = task.subtasks.filter(
				(st) => st.status === 'blocked'
			).length;
			const deferredSubtasks = task.subtasks.filter(
				(st) => st.status === 'deferred'
			).length;
			const cancelledSubtasks = task.subtasks.filter(
				(st) => st.status === 'cancelled'
			).length;

			// Calculate status breakdown as percentages
			const statusBreakdown = {
				'in-progress': (inProgressSubtasks / totalSubtasks) * 100,
				pending: (pendingSubtasks / totalSubtasks) * 100,
				blocked: (blockedSubtasks / totalSubtasks) * 100,
				deferred: (deferredSubtasks / totalSubtasks) * 100,
				cancelled: (cancelledSubtasks / totalSubtasks) * 100
			};

			const completionPercentage = (completedSubtasks / totalSubtasks) * 100;

			// Calculate appropriate progress bar length based on terminal width
			// Subtract padding (2), borders (2), and the percentage text (~5)
			const availableWidth = process.stdout.columns || 80; // Default to 80 if can't detect
			const boxPadding = 2; // 1 on each side
			const boxBorders = 2; // 1 on each side
			const percentTextLength = 5; // ~5 chars for " 100%"
			// Reduce the length by adjusting the subtraction value from 20 to 35
			const progressBarLength = Math.max(
				20,
				Math.min(
					60,
					availableWidth - boxPadding - boxBorders - percentTextLength - 35
				)
			); // Min 20, Max 60

			// Status counts for display
			const statusCounts =
				`${chalk.green('✓ Done:')} ${completedSubtasks}  ${chalk.hex('#FFA500')('► In Progress:')} ${inProgressSubtasks}  ${chalk.yellow('○ Pending:')} ${pendingSubtasks}\n` +
				`${chalk.red('! Blocked:')} ${blockedSubtasks}  ${chalk.gray('⏱ Deferred:')} ${deferredSubtasks}  ${chalk.gray('✗ Cancelled:')} ${cancelledSubtasks}`;

			console.log(
				boxen(
					chalk.white.bold('Subtask Progress:') +
						'\n\n' +
						`${chalk.cyan('Completed:')} ${completedSubtasks}/${totalSubtasks} (${completionPercentage.toFixed(1)}%)\n` +
						`${statusCounts}\n` +
						`${chalk.cyan('Progress:')} ${createProgressBar(completionPercentage, progressBarLength, statusBreakdown)}`,
					{
						padding: { top: 0, bottom: 0, left: 1, right: 1 },
						borderColor: 'blue',
						borderStyle: 'round',
						margin: { top: 1, bottom: 0 },
						width: Math.min(availableWidth - 10, 100), // Add width constraint to limit the box width
						textAlignment: 'left'
					}
				)
			);
		}

		return;
	}

	// Display a regular task
	console.log(
		boxen(chalk.white.bold(`Task: #${task.id} - ${task.title}`), {
			padding: { top: 0, bottom: 0, left: 1, right: 1 },
			borderColor: 'blue',
			borderStyle: 'round',
			margin: { top: 1, bottom: 0 }
		})
	);

	// Create a table with task details with improved handling
	const taskTable = new Table({
		style: {
			head: [],
			border: [],
			'padding-top': 0,
			'padding-bottom': 0,
			compact: true
		},
		chars: {
			mid: '',
			'left-mid': '',
			'mid-mid': '',
			'right-mid': ''
		},
		colWidths: [15, Math.min(75, process.stdout.columns - 20 || 60)],
		wordWrap: true
	});

	// Priority with color
	const priorityColors = {
		high: chalk.red.bold,
		medium: chalk.yellow,
		low: chalk.gray
	};
	const priorityColor =
		priorityColors[task.priority || 'medium'] || chalk.white;

	// Add task details to table
	taskTable.push(
		[chalk.cyan.bold('ID:'), task.id.toString()],
		[chalk.cyan.bold('Title:'), task.title],
		[
			chalk.cyan.bold('Status:'),
			getStatusWithColor(task.status || 'pending', true)
		],
		[chalk.cyan.bold('Priority:'), priorityColor(task.priority || 'medium')],
		[
			chalk.cyan.bold('Dependencies:'),
			formatDependenciesWithStatus(task.dependencies, data.tasks, true)
		],
		[chalk.cyan.bold('Description:'), task.description]
	);

	console.log(taskTable.toString());

	// If task has details, show them in a separate box
	if (task.details && task.details.trim().length > 0) {
		console.log(
			boxen(
				chalk.white.bold('Implementation Details:') + '\n\n' + task.details,
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'cyan',
					borderStyle: 'round',
					margin: { top: 1, bottom: 0 }
				}
			)
		);
	}

	// Show test strategy if available
	if (task.testStrategy && task.testStrategy.trim().length > 0) {
		console.log(
			boxen(chalk.white.bold('Test Strategy:') + '\n\n' + task.testStrategy, {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: 'cyan',
				borderStyle: 'round',
				margin: { top: 1, bottom: 0 }
			})
		);
	}

	// Show subtasks if they exist
	if (task.subtasks && task.subtasks.length > 0) {
		console.log(
			boxen(chalk.white.bold('Subtasks'), {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				margin: { top: 1, bottom: 0 },
				borderColor: 'magenta',
				borderStyle: 'round'
			})
		);

		// Calculate available width for the subtask table
		const availableWidth = process.stdout.columns - 10 || 100; // Default to 100 if can't detect

		// Define percentage-based column widths
		const idWidthPct = 10;
		const statusWidthPct = 15;
		const depsWidthPct = 25;
		const titleWidthPct = 100 - idWidthPct - statusWidthPct - depsWidthPct;

		// Calculate actual column widths
		const idWidth = Math.floor(availableWidth * (idWidthPct / 100));
		const statusWidth = Math.floor(availableWidth * (statusWidthPct / 100));
		const depsWidth = Math.floor(availableWidth * (depsWidthPct / 100));
		const titleWidth = Math.floor(availableWidth * (titleWidthPct / 100));

		// Create a table for subtasks with improved handling
		const subtaskTable = new Table({
			head: [
				chalk.magenta.bold('ID'),
				chalk.magenta.bold('Status'),
				chalk.magenta.bold('Title'),
				chalk.magenta.bold('Deps')
			],
			colWidths: [idWidth, statusWidth, titleWidth, depsWidth],
			style: {
				head: [],
				border: [],
				'padding-top': 0,
				'padding-bottom': 0,
				compact: true
			},
			chars: {
				mid: '',
				'left-mid': '',
				'mid-mid': '',
				'right-mid': ''
			},
			wordWrap: true
		});

		// Add subtasks to table
		task.subtasks.forEach((st) => {
			const statusColor =
				{
					done: chalk.green,
					completed: chalk.green,
					pending: chalk.yellow,
					'in-progress': chalk.blue
				}[st.status || 'pending'] || chalk.white;

			// Format subtask dependencies
			let subtaskDeps = 'None';
			if (st.dependencies && st.dependencies.length > 0) {
				// Format dependencies with correct notation
				const formattedDeps = st.dependencies.map((depId) => {
					if (typeof depId === 'number' && depId < 100) {
						const foundSubtask = task.subtasks.find((st) => st.id === depId);
						if (foundSubtask) {
							const isDone =
								foundSubtask.status === 'done' ||
								foundSubtask.status === 'completed';
							const isInProgress = foundSubtask.status === 'in-progress';

							// Use consistent color formatting instead of emojis
							if (isDone) {
								return chalk.green.bold(`${task.id}.${depId}`);
							} else if (isInProgress) {
								return chalk.hex('#FFA500').bold(`${task.id}.${depId}`);
							} else {
								return chalk.red.bold(`${task.id}.${depId}`);
							}
						}
						return chalk.red(`${task.id}.${depId} (Not found)`);
					}
					return depId;
				});

				// Join the formatted dependencies directly instead of passing to formatDependenciesWithStatus again
				subtaskDeps =
					formattedDeps.length === 1
						? formattedDeps[0]
						: formattedDeps.join(chalk.white(', '));
			}

			subtaskTable.push([
				`${task.id}.${st.id}`,
				statusColor(st.status || 'pending'),
				st.title,
				subtaskDeps
			]);
		});

		console.log(subtaskTable.toString());

		// Calculate and display subtask completion progress
		if (task.subtasks && task.subtasks.length > 0) {
			const totalSubtasks = task.subtasks.length;
			const completedSubtasks = task.subtasks.filter(
				(st) => st.status === 'done' || st.status === 'completed'
			).length;

			// Count other statuses for the subtasks
			const inProgressSubtasks = task.subtasks.filter(
				(st) => st.status === 'in-progress'
			).length;
			const pendingSubtasks = task.subtasks.filter(
				(st) => st.status === 'pending'
			).length;
			const blockedSubtasks = task.subtasks.filter(
				(st) => st.status === 'blocked'
			).length;
			const deferredSubtasks = task.subtasks.filter(
				(st) => st.status === 'deferred'
			).length;
			const cancelledSubtasks = task.subtasks.filter(
				(st) => st.status === 'cancelled'
			).length;

			// Calculate status breakdown as percentages
			const statusBreakdown = {
				'in-progress': (inProgressSubtasks / totalSubtasks) * 100,
				pending: (pendingSubtasks / totalSubtasks) * 100,
				blocked: (blockedSubtasks / totalSubtasks) * 100,
				deferred: (deferredSubtasks / totalSubtasks) * 100,
				cancelled: (cancelledSubtasks / totalSubtasks) * 100
			};

			const completionPercentage = (completedSubtasks / totalSubtasks) * 100;

			// Calculate appropriate progress bar length based on terminal width
			// Subtract padding (2), borders (2), and the percentage text (~5)
			const availableWidth = process.stdout.columns || 80; // Default to 80 if can't detect
			const boxPadding = 2; // 1 on each side
			const boxBorders = 2; // 1 on each side
			const percentTextLength = 5; // ~5 chars for " 100%"
			// Reduce the length by adjusting the subtraction value from 20 to 35
			const progressBarLength = Math.max(
				20,
				Math.min(
					60,
					availableWidth - boxPadding - boxBorders - percentTextLength - 35
				)
			); // Min 20, Max 60

			// Status counts for display
			const statusCounts =
				`${chalk.green('✓ Done:')} ${completedSubtasks}  ${chalk.hex('#FFA500')('► In Progress:')} ${inProgressSubtasks}  ${chalk.yellow('○ Pending:')} ${pendingSubtasks}\n` +
				`${chalk.red('! Blocked:')} ${blockedSubtasks}  ${chalk.gray('⏱ Deferred:')} ${deferredSubtasks}  ${chalk.gray('✗ Cancelled:')} ${cancelledSubtasks}`;

			console.log(
				boxen(
					chalk.white.bold('Subtask Progress:') +
						'\n\n' +
						`${chalk.cyan('Completed:')} ${completedSubtasks}/${totalSubtasks} (${completionPercentage.toFixed(1)}%)\n` +
						`${statusCounts}\n` +
						`${chalk.cyan('Progress:')} ${createProgressBar(completionPercentage, progressBarLength, statusBreakdown)}`,
					{
						padding: { top: 0, bottom: 0, left: 1, right: 1 },
						borderColor: 'blue',
						borderStyle: 'round',
						margin: { top: 1, bottom: 0 },
						width: Math.min(availableWidth - 10, 100), // Add width constraint to limit the box width
						textAlignment: 'left'
					}
				)
			);
		}
	} else {
		// Suggest expanding if no subtasks
		console.log(
			boxen(
				chalk.yellow('No subtasks found. Consider breaking down this task:') +
					'\n' +
					chalk.white(
						`Run: ${chalk.cyan(`task-master expand --id=${task.id}`)}`
					),
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'yellow',
					borderStyle: 'round',
					margin: { top: 1, bottom: 0 }
				}
			)
		);
	}

	// Show action suggestions
	console.log(
		boxen(
			chalk.white.bold('Suggested Actions:') +
				'\n' +
				`${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`task-master set-status --id=${task.id} --status=in-progress`)}\n` +
				`${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`task-master set-status --id=${task.id} --status=done`)}\n` +
				(task.subtasks && task.subtasks.length > 0
					? `${chalk.cyan('3.')} Update subtask status: ${chalk.yellow(`task-master set-status --id=${task.id}.1 --status=done`)}`
					: `${chalk.cyan('3.')} Break down into subtasks: ${chalk.yellow(`task-master expand --id=${task.id}`)}`),
			{
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: 'green',
				borderStyle: 'round',
				margin: { top: 1 }
			}
		)
	);
}

/**
 * Display the complexity analysis report in a nice format
 * @param {string} reportPath - Path to the complexity report file
 */
async function displayComplexityReport(reportPath) {
	displayBanner();

	// Check if the report exists
	if (!fs.existsSync(reportPath)) {
		console.log(
			boxen(
				chalk.yellow(`No complexity report found at ${reportPath}\n\n`) +
					'Would you like to generate one now?',
				{
					padding: 1,
					borderColor: 'yellow',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);

		const readline = require('readline').createInterface({
			input: process.stdin,
			output: process.stdout
		});

		const answer = await new Promise((resolve) => {
			readline.question(
				chalk.cyan('Generate complexity report? (y/n): '),
				resolve
			);
		});
		readline.close();

		if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
			// Call the analyze-complexity command
			console.log(chalk.blue('Generating complexity report...'));
			await analyzeTaskComplexity({
				output: reportPath,
				research: false, // Default to no research for speed
				file: 'tasks/tasks.json'
			});
			// Read the newly generated report
			return displayComplexityReport(reportPath);
		} else {
			console.log(chalk.yellow('Report generation cancelled.'));
			return;
		}
	}

	// Read the report
	let report;
	try {
		report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
	} catch (error) {
		log('error', `Error reading complexity report: ${error.message}`);
		return;
	}

	// Display report header
	console.log(
		boxen(chalk.white.bold('Task Complexity Analysis Report'), {
			padding: 1,
			borderColor: 'blue',
			borderStyle: 'round',
			margin: { top: 1, bottom: 1 }
		})
	);

	// Display metadata
	const metaTable = new Table({
		style: {
			head: [],
			border: [],
			'padding-top': 0,
			'padding-bottom': 0,
			compact: true
		},
		chars: {
			mid: '',
			'left-mid': '',
			'mid-mid': '',
			'right-mid': ''
		},
		colWidths: [20, 50]
	});

	metaTable.push(
		[
			chalk.cyan.bold('Generated:'),
			new Date(report.meta.generatedAt).toLocaleString()
		],
		[chalk.cyan.bold('Tasks Analyzed:'), report.meta.tasksAnalyzed],
		[chalk.cyan.bold('Threshold Score:'), report.meta.thresholdScore],
		[chalk.cyan.bold('Project:'), report.meta.projectName],
		[
			chalk.cyan.bold('Research-backed:'),
			report.meta.usedResearch ? 'Yes' : 'No'
		]
	);

	console.log(metaTable.toString());

	// Sort tasks by complexity score (highest first)
	const sortedTasks = [...report.complexityAnalysis].sort(
		(a, b) => b.complexityScore - a.complexityScore
	);

	// Determine which tasks need expansion based on threshold
	const tasksNeedingExpansion = sortedTasks.filter(
		(task) => task.complexityScore >= report.meta.thresholdScore
	);
	const simpleTasks = sortedTasks.filter(
		(task) => task.complexityScore < report.meta.thresholdScore
	);

	// Create progress bar to show complexity distribution
	const complexityDistribution = [0, 0, 0]; // Low (0-4), Medium (5-7), High (8-10)
	sortedTasks.forEach((task) => {
		if (task.complexityScore < 5) complexityDistribution[0]++;
		else if (task.complexityScore < 8) complexityDistribution[1]++;
		else complexityDistribution[2]++;
	});

	const percentLow = Math.round(
		(complexityDistribution[0] / sortedTasks.length) * 100
	);
	const percentMedium = Math.round(
		(complexityDistribution[1] / sortedTasks.length) * 100
	);
	const percentHigh = Math.round(
		(complexityDistribution[2] / sortedTasks.length) * 100
	);

	console.log(
		boxen(
			chalk.white.bold('Complexity Distribution\n\n') +
				`${chalk.green.bold('Low (1-4):')} ${complexityDistribution[0]} tasks (${percentLow}%)\n` +
				`${chalk.yellow.bold('Medium (5-7):')} ${complexityDistribution[1]} tasks (${percentMedium}%)\n` +
				`${chalk.red.bold('High (8-10):')} ${complexityDistribution[2]} tasks (${percentHigh}%)`,
			{
				padding: 1,
				borderColor: 'cyan',
				borderStyle: 'round',
				margin: { top: 1, bottom: 1 }
			}
		)
	);

	// Get terminal width
	const terminalWidth = process.stdout.columns || 100; // Default to 100 if can't detect

	// Calculate dynamic column widths
	const idWidth = 12;
	const titleWidth = Math.floor(terminalWidth * 0.25); // 25% of width
	const scoreWidth = 8;
	const subtasksWidth = 8;
	// Command column gets the remaining space (minus some buffer for borders)
	const commandWidth =
		terminalWidth - idWidth - titleWidth - scoreWidth - subtasksWidth - 10;

	// Create table with new column widths and word wrapping
	const complexTable = new Table({
		head: [
			chalk.yellow.bold('ID'),
			chalk.yellow.bold('Title'),
			chalk.yellow.bold('Score'),
			chalk.yellow.bold('Subtasks'),
			chalk.yellow.bold('Expansion Command')
		],
		colWidths: [idWidth, titleWidth, scoreWidth, subtasksWidth, commandWidth],
		style: { head: [], border: [] },
		wordWrap: true,
		wrapOnWordBoundary: true
	});

	// When adding rows, don't truncate the expansion command
	tasksNeedingExpansion.forEach((task) => {
		const expansionCommand = `task-master expand --id=${task.taskId} --num=${task.recommendedSubtasks}${task.expansionPrompt ? ` --prompt="${task.expansionPrompt}"` : ''}`;

		complexTable.push([
			task.taskId,
			truncate(task.taskTitle, titleWidth - 3), // Still truncate title for readability
			getComplexityWithColor(task.complexityScore),
			task.recommendedSubtasks,
			chalk.cyan(expansionCommand) // Don't truncate - allow wrapping
		]);
	});

	console.log(complexTable.toString());

	// Create table for simple tasks
	if (simpleTasks.length > 0) {
		console.log(
			boxen(chalk.green.bold(`Simple Tasks (${simpleTasks.length})`), {
				padding: { left: 2, right: 2, top: 0, bottom: 0 },
				margin: { top: 1, bottom: 0 },
				borderColor: 'green',
				borderStyle: 'round'
			})
		);

		const simpleTable = new Table({
			head: [
				chalk.green.bold('ID'),
				chalk.green.bold('Title'),
				chalk.green.bold('Score'),
				chalk.green.bold('Reasoning')
			],
			colWidths: [5, 40, 8, 50],
			style: { head: [], border: [] }
		});

		simpleTasks.forEach((task) => {
			simpleTable.push([
				task.taskId,
				truncate(task.taskTitle, 37),
				getComplexityWithColor(task.complexityScore),
				truncate(task.reasoning, 47)
			]);
		});

		console.log(simpleTable.toString());
	}

	// Show action suggestions
	console.log(
		boxen(
			chalk.white.bold('Suggested Actions:') +
				'\n\n' +
				`${chalk.cyan('1.')} Expand all complex tasks: ${chalk.yellow(`task-master expand --all`)}\n` +
				`${chalk.cyan('2.')} Expand a specific task: ${chalk.yellow(`task-master expand --id=<id>`)}\n` +
				`${chalk.cyan('3.')} Regenerate with research: ${chalk.yellow(`task-master analyze-complexity --research`)}`,
			{
				padding: 1,
				borderColor: 'cyan',
				borderStyle: 'round',
				margin: { top: 1 }
			}
		)
	);
}

/**
 * Display real-time analysis progress with detailed information in a single line format
 * @param {Object} progressData - Object containing progress information
 * @param {string} progressData.model - Model name (e.g., 'claude-3-7-sonnet-20250219')
 * @param {number} progressData.contextTokens - Context tokens used
 * @param {number} progressData.elapsed - Elapsed time in seconds
 * @param {number} progressData.temperature - Temperature setting
 * @param {number} progressData.tasksAnalyzed - Number of tasks analyzed so far
 * @param {number} progressData.totalTasks - Total number of tasks to analyze
 * @param {number} progressData.percentComplete - Percentage complete (0-100)
 * @param {number} progressData.maxTokens - Maximum tokens setting
 * @param {boolean} progressData.completed - Whether the process is completed
 * @returns {void}
 */
function displayAnalysisProgress(progressData) {
	const {
		model,
		contextTokens = 0,
		elapsed = 0,
		temperature = 0.7,
		tasksAnalyzed = 0,
		totalTasks = 0,
		percentComplete = 0,
		maxTokens = 0,
		completed = false
	} = progressData;

	// Format the elapsed time
	const timeDisplay = formatElapsedTime(elapsed);

	// Use static variables to track display state
	if (displayAnalysisProgress.initialized === undefined) {
		displayAnalysisProgress.initialized = false;
		displayAnalysisProgress.lastUpdate = Date.now();
		displayAnalysisProgress.statusLineStarted = false;
	}

	// Create progress bar (20 characters wide)
	const progressBarWidth = 20;
	const percentText = `${Math.round(percentComplete)}%`;
	const percentTextLength = percentText.length;

	// Calculate expected total tokens and current progress
	const totalTokens = contextTokens; // Use the actual token count as the total

	// Calculate current tokens based on percentage complete to show gradual increase from 0 to totalTokens
	const currentTokens = completed
		? totalTokens
		: Math.min(totalTokens, Math.round((percentComplete / 100) * totalTokens));

	// Format token counts with proper padding
	const totalTokenDigits = totalTokens.toString().length;
	const currentTokensFormatted = currentTokens
		.toString()
		.padStart(totalTokenDigits, '0');
	const tokenDisplay = `${currentTokensFormatted}/${totalTokens}`;

	// Calculate position for centered percentage
	const halfBarWidth = Math.floor(progressBarWidth / 2);
	const percentStartPos = Math.max(
		0,
		halfBarWidth - Math.floor(percentTextLength / 2)
	);

	// Calculate how many filled and empty chars to draw
	const filledChars = Math.floor((percentComplete / 100) * progressBarWidth);

	// Create the progress bar with centered percentage (without gradient)
	let progressBar = '';
	for (let i = 0; i < progressBarWidth; i++) {
		// If we're at the start position for the percentage text
		if (i === percentStartPos) {
			// Apply bold white for percentage text to stand out
			progressBar += chalk.bold.white(percentText);
			// Skip ahead by the length of the percentage text
			i += percentTextLength - 1;
		} else if (i < filledChars) {
			// Use a single color instead of gradient
			progressBar += chalk.cyan('█');
		} else {
			// Use a subtle character for empty space
			progressBar += chalk.gray('░');
		}
	}

	// Use spinner from ora - these are the actual frames used in the default spinner
	const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

	// Increment the counter faster to speed up the animation
	if (!displayAnalysisProgress.frameCounter) {
		displayAnalysisProgress.frameCounter = 0;
	}
	if (!displayAnalysisProgress.updateToggle) {
		displayAnalysisProgress.updateToggle = false;
	}

	// Toggle between updating and not updating to halve the speed
	displayAnalysisProgress.updateToggle = !displayAnalysisProgress.updateToggle;

	// Only update every other call to make animation half as fast
	if (displayAnalysisProgress.updateToggle) {
		displayAnalysisProgress.frameCounter =
			(displayAnalysisProgress.frameCounter + 1) % spinnerFrames.length;
	}

	const spinner = chalk.cyan(
		spinnerFrames[displayAnalysisProgress.frameCounter]
	);

	// Format status line based on whether we're complete or not
	let statusLine;

	if (completed) {
		// For completed progress, show checkmark and "Complete" text
		statusLine =
			`  ${chalk.cyan('⏱')} ${timeDisplay} ${chalk.gray('|')} ` +
			`Tasks: ${chalk.bold(tasksAnalyzed)}/${totalTasks} ${chalk.gray('|')} ` +
			`Tokens: ${tokenDisplay} ${chalk.gray('|')} ` +
			`${progressBar} ${chalk.gray('|')} ` +
			`${chalk.green('✅')} ${chalk.green('Complete')}`;
	} else {
		// For in-progress, show spinner and "Processing" text
		statusLine =
			`  ${chalk.cyan('⏱')} ${timeDisplay} ${chalk.gray('|')} ` +
			`Tasks: ${chalk.bold(tasksAnalyzed)}/${totalTasks} ${chalk.gray('|')} ` +
			`Tokens: ${tokenDisplay} ${chalk.gray('|')} ` +
			`${progressBar} ${chalk.gray('|')} ` +
			`${chalk.cyan('Processing')} ${spinner}`;
	}

	// Clear the line and update the status
	process.stdout.write('\r\x1B[K');
	process.stdout.write(statusLine);

	// Additional handling for completion
	if (completed) {
		// Move to next line and print completion message in a box
		process.stdout.write('\n\n');

		console.log(
			boxen(
				chalk.green(`Task complexity analysis completed in ${timeDisplay}`) +
					'\n' +
					chalk.green(`✅ Analyzed ${tasksAnalyzed} tasks successfully.`),
				{
					padding: { top: 1, bottom: 1, left: 2, right: 2 },
					margin: { top: 0, bottom: 1 },
					borderColor: 'green',
					borderStyle: 'round'
				}
			)
		);

		// Reset initialization state for next run
		displayAnalysisProgress.initialized = undefined;
		displayAnalysisProgress.statusLineStarted = false;
	}
}

/**
 * Format elapsed time in the format shown in the screenshot (0m 00s)
 * @param {number} seconds - Elapsed time in seconds
 * @returns {string} Formatted time string
 */
function formatElapsedTime(seconds) {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
}

/**
 * Format a complexity summary from analyze-complexity with a neat boxed display
 * @param {Object} summary The complexity analysis summary
 * @returns {string} The formatted summary
 */
function formatComplexitySummary(summary) {
	// Calculate verification sum
	const sumTotal =
		summary.highComplexityCount +
		summary.mediumComplexityCount +
		summary.lowComplexityCount;
	const verificationStatus =
		sumTotal === summary.analyzedTasks ? chalk.green('✅') : chalk.red('✗');

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
	table.push(
		[chalk.cyan('Tasks in input file:'), chalk.bold(summary.totalTasks)],
		[chalk.cyan('Tasks analyzed:'), chalk.bold(summary.analyzedTasks)]
	);

	// Complexity distribution in one row
	const percentHigh = Math.round(
		(summary.highComplexityCount / summary.analyzedTasks) * 100
	);
	const percentMed = Math.round(
		(summary.mediumComplexityCount / summary.analyzedTasks) * 100
	);
	const percentLow = Math.round(
		(summary.lowComplexityCount / summary.analyzedTasks) * 100
	);

	const complexityRow = [
		chalk.cyan('Complexity distribution:'),
		`${chalk.hex('#CC0000').bold(summary.highComplexityCount)} ${chalk.hex('#CC0000')('High')} (${percentHigh}%) · ` +
			`${chalk.hex('#FF8800').bold(summary.mediumComplexityCount)} ${chalk.hex('#FF8800')('Medium')} (${percentMed}%) · ` +
			`${chalk.yellow.bold(summary.lowComplexityCount)} ${chalk.yellow('Low')} (${percentLow}%)`
	];
	table.push(complexityRow);

	// Visual bar representation of complexity distribution
	const barWidth = 40; // Total width of the bar

	// Only show bars for categories with at least 1 task
	const highChars =
		summary.highComplexityCount > 0
			? Math.max(
					1,
					Math.round(
						(summary.highComplexityCount / summary.analyzedTasks) * barWidth
					)
				)
			: 0;

	const medChars =
		summary.mediumComplexityCount > 0
			? Math.max(
					1,
					Math.round(
						(summary.mediumComplexityCount / summary.analyzedTasks) * barWidth
					)
				)
			: 0;

	const lowChars =
		summary.lowComplexityCount > 0
			? Math.max(
					1,
					Math.round(
						(summary.lowComplexityCount / summary.analyzedTasks) * barWidth
					)
				)
			: 0;

	// Adjust bar width if some categories have 0 tasks
	const actualBarWidth = highChars + medChars + lowChars;

	const distributionBar =
		chalk.hex('#CC0000')('█'.repeat(highChars)) +
		chalk.hex('#FF8800')('█'.repeat(medChars)) +
		chalk.yellow('█'.repeat(lowChars)) +
		// Add empty space if actual bar is shorter than expected
		(actualBarWidth < barWidth
			? chalk.gray('░'.repeat(barWidth - actualBarWidth))
			: '');

	table.push([chalk.cyan('Distribution:'), distributionBar]);

	// Add verification and research status
	table.push(
		[
			chalk.cyan('Verification:'),
			`${verificationStatus} ${sumTotal}/${summary.analyzedTasks}`
		],
		[
			chalk.cyan('Research-backed:'),
			summary.researchBacked ? chalk.green('✅') : 'No'
		]
	);

	// Final string output with title and footer
	const output = [
		chalk.bold.underline('Complexity Analysis Summary'),
		'',
		table.toString(),
		'',
		`Report saved to: ${chalk.italic('scripts/task-complexity-report.json')}`
	].join('\n');

	// Return a boxed version
	return boxen(output, {
		padding: { top: 1, right: 1, bottom: 1, left: 1 },
		borderColor: 'blue',
		borderStyle: 'round',
		margin: { top: 1, right: 1, bottom: 1, left: 0 }
	});
}

/**
 * Confirm overwriting existing tasks.json file
 * @param {string} tasksPath - Path to the tasks.json file
 * @returns {Promise<boolean>} - Promise resolving to true if user confirms, false otherwise
 */
async function confirmTaskOverwrite(tasksPath) {
	console.log(
		boxen(
			chalk.yellow(
				"It looks like you've already generated tasks for this project.\n"
			) +
				chalk.yellow(
					'Executing this command will overwrite any existing tasks.'
				),
			{
				padding: 1,
				borderColor: 'yellow',
				borderStyle: 'round',
				margin: { top: 1 }
			}
		)
	);

	// Use dynamic import to get the readline module
	const readline = await import('readline');
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	const answer = await new Promise((resolve) => {
		rl.question(
			chalk.cyan('Are you sure you wish to continue? (y/N): '),
			resolve
		);
	});
	rl.close();

	return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

/**
 * Display the start of complexity analysis with a boxen announcement
 * @param {string} tasksPath - Path to the tasks file being analyzed
 * @param {string} outputPath - Path where the report will be saved
 * @param {boolean} useResearch - Whether Perplexity AI research is enabled
 * @param {string} model - AI model name
 * @param {number} temperature - AI temperature setting
 */
function displayComplexityAnalysisStart(
	tasksPath,
	outputPath,
	useResearch = false,
	model = CONFIG.model,
	temperature = CONFIG.temperature
) {
	// Create the message content with all information
	let message =
		chalk.bold(`🤖 Analyzing Task Complexity`) +
		'\n' +
		chalk.dim(`Model: ${model} | Temperature: ${temperature}`) +
		'\n\n' +
		chalk.blue(`Input: ${tasksPath}`) +
		'\n' +
		chalk.blue(`Output: ${outputPath}`);

	// Add research info if enabled
	if (useResearch) {
		message +=
			'\n' + chalk.blue('Using Perplexity AI for research-backed analysis');
	}

	// Display everything in a single boxen
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
 * Display the start of PRD parsing with a boxen announcement
 * @param {string} prdFilePath - Path to the PRD file being parsed
 * @param {string} outputPath - Path where the tasks will be saved
 * @param {number} numTasks - Number of tasks to generate
 * @param {string} model - AI model name
 * @param {number} temperature - AI temperature setting
 * @param {boolean} append - Whether to append to existing tasks
 */
function displayPRDParsingStart(
	prdFilePath,
	outputPath,
	numTasks,
	model = CONFIG.model,
	temperature = CONFIG.temperature,
	append = false
) {
	// Determine the action verb based on append flag
	const actionVerb = append ? 'Appending' : 'Generating';
	// Create the message content with all information
	let message =
		chalk.bold(`🤖 Parsing PRD and ${actionVerb} Tasks`) +
		'\n' +
		chalk.dim(`Model: ${model} | Temperature: ${temperature}`) +
		'\n\n' +
		chalk.blue(`Input: ${prdFilePath}`) +
		'\n' +
		chalk.blue(`Output: ${outputPath}`) +
		'\n' +
		chalk.blue(`Tasks to ${append ? 'Append' : 'Generate'}: ${numTasks}`);

	// Display everything in a single boxen
	console.log(
		boxen(message, {
			padding: { top: 1, bottom: 1, left: 2, right: 2 },
			margin: { top: 0, bottom: 0 },
			borderColor: 'blue', // Changed from 'green' to 'blue' for consistency
			borderStyle: 'round'
		})
	);
}

/**
 * Display progress information for PRD parsing
 * @param {Object} progressData - Progress data
 * @param {number} progressData.percentComplete - Percentage complete (0-100)
 * @param {number} progressData.elapsed - Elapsed time in seconds
 * @param {number} progressData.contextTokens - Context tokens
 * @param {number} progressData.estimatedTotalTokens - Estimated total tokens
 * @param {number} progressData.promptTokens - Input tokens sent to API
 * @param {number} progressData.completionTokens - Output tokens received from API
 * @param {number} progressData.tasksGenerated - Number of tasks generated so far
 * @param {number} progressData.totalTasks - Total number of tasks to generate
 * @param {boolean} progressData.completed - Whether the operation is completed
 * @param {string} progressData.message - Optional status message during thinking state
 * @param {string} progressData.state - Optional processing state indicator
 * @param {Object} progressData.taskInfo - Optional information about newly detected task
 * @returns {void}
 */
function displayPRDParsingProgress(progressData) {
	const {
		percentComplete = 0,
		elapsed = 0,
		contextTokens = 0,
		estimatedTotalTokens = 0,
		promptTokens = 0,
		completionTokens = 0,
		tasksGenerated = 0,
		totalTasks = 0,
		completed = false,
		message,
		state,
		taskInfo,
		microProgress = false // Flag to detect micro-progress updates
	} = progressData;

	// Format the elapsed time
	const timeDisplay = formatElapsedTime(elapsed);

	// Use static variables to track display state
	if (displayPRDParsingProgress.initialized === undefined) {
		displayPRDParsingProgress.initialized = false;
		displayPRDParsingProgress.lastUpdate = Date.now();
		displayPRDParsingProgress.statusLineStarted = false;
		displayPRDParsingProgress.detectedTasks = new Map(); // Track tasks we've detected
		displayPRDParsingProgress.lastTaskId = 0; // Track last task ID we've displayed
		displayPRDParsingProgress.lastPercentComplete = 0; // Track last percentage shown
		displayPRDParsingProgress.lastTokenCount = 0; // Track last token count
		displayPRDParsingProgress.actualTaskCount = 0; // Track actual number of tasks generated
		displayPRDParsingProgress.lastThinkingMessage = ''; // Track the last thinking message
	}

	// For micro-progress updates, we only update the percentage without
	// changing other elements like task counts or thinking state
	if (microProgress && !completed) {
		// Create progress bar (20 characters wide)
		const progressBarWidth = 20;

		// Use the micro-progress adjusted percentage
		let smoothPercentComplete = percentComplete;

		// Update our percentage tracking but keep other state unchanged
		displayPRDParsingProgress.lastPercentComplete = smoothPercentComplete;

		// Format percentage for display
		const percentText = `${Math.round(smoothPercentComplete)}%`;
		const percentTextLength = percentText.length;

		// Use the latest token counts
		const tokenDisplay = `${promptTokens}/${completionTokens}`;

		// Calculate position for centered percentage
		const halfBarWidth = Math.floor(progressBarWidth / 2);
		const percentStartPos = Math.max(
			0,
			halfBarWidth - Math.floor(percentTextLength / 2)
		);
		const percentEndPos = percentStartPos + percentTextLength - 1;

		// Calculate how many filled and empty chars to draw - use actual percentage
		const rawFilledChars = Math.floor(
			(smoothPercentComplete / 100) * progressBarWidth
		);

		// Create the progress bar with centered percentage that accurately represents the percentage
		let progressBar = '';
		let filledCount = 0;
		let emptyCount = 0;
		let textAdded = false;

		for (let i = 0; i < progressBarWidth; i++) {
			// Determine if this position should be filled based on percentage
			const shouldBeFilled = i < rawFilledChars;

			// If we're in the percentage text range
			if (i >= percentStartPos && i <= percentEndPos) {
				// Only add the text once at the starting position
				if (i === percentStartPos) {
					progressBar += chalk.bold.white(percentText);
					i = percentEndPos; // Skip ahead
					textAdded = true;

					// Track how many filled and empty positions were "consumed" by the text
					const textPositionsCount = percentTextLength;
					const filledPositionsInText = Math.min(
						rawFilledChars - percentStartPos,
						textPositionsCount
					);
					const emptyPositionsInText =
						textPositionsCount - filledPositionsInText;

					filledCount += filledPositionsInText;
					emptyCount += emptyPositionsInText;
				}
			} else if (shouldBeFilled) {
				// This position should be filled
				progressBar += chalk.cyan('█');
				filledCount++;
			} else {
				// This position should be empty
				progressBar += chalk.gray('░');
				emptyCount++;
			}
		}

		// Use spinner from ora
		const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

		// Increment the counter for animation
		if (!displayPRDParsingProgress.frameCounter) {
			displayPRDParsingProgress.frameCounter = 0;
		}
		if (!displayPRDParsingProgress.updateToggle) {
			displayPRDParsingProgress.updateToggle = false;
		}

		// Toggle between updating and not updating to halve the speed
		displayPRDParsingProgress.updateToggle =
			!displayPRDParsingProgress.updateToggle;

		// Only update every other call to make animation half as fast
		if (displayPRDParsingProgress.updateToggle) {
			displayPRDParsingProgress.frameCounter =
				(displayPRDParsingProgress.frameCounter + 1) % spinnerFrames.length;
		}

		const spinner = chalk.cyan(
			spinnerFrames[displayPRDParsingProgress.frameCounter]
		);

		// For a micro-progress update, get the last message we displayed
		const thinkingMessage =
			displayPRDParsingProgress.lastThinkingMessage || 'Processing...';

		// Construct the progress line efficiently for micro-updates
		const displayedTasks = displayPRDParsingProgress.actualTaskCount;
		const progressLine = `  ⏱ ${timeDisplay} | Tasks: ${displayedTasks}/${totalTasks} | Tokens (I/O): ${tokenDisplay} | ${progressBar} | ${thinkingMessage} ${spinner}`;

		// Only output the line if status line has been started
		if (displayPRDParsingProgress.statusLineStarted) {
			// Emit the current status line, replacing the previous one
			process.stdout.write(`\r${progressLine}`);
		}

		// Early return for micro-progress updates after updating the progress bar
		return;
	}

	// For non-micro-progress updates, continue with the full update logic

	// Track task info regardless of microProgress flag
	if (taskInfo && typeof taskInfo === 'object' && taskInfo.taskId) {
		// Only count each task once by tracking the unique task IDs
		if (!displayPRDParsingProgress.detectedTasks.has(taskInfo.taskId)) {
			// If taskInfo has a taskCount, use that directly
			if (taskInfo.taskCount) {
				displayPRDParsingProgress.actualTaskCount = taskInfo.taskCount;
			} else {
				displayPRDParsingProgress.actualTaskCount += 1;
			}
		} else {
			// Even for tasks we've seen, update taskCount if available
			if (taskInfo.taskCount) {
				displayPRDParsingProgress.actualTaskCount = taskInfo.taskCount;
			}
		}

		// Store task info in our tracking map
		displayPRDParsingProgress.detectedTasks.set(taskInfo.taskId, {
			title: taskInfo.title,
			priority: taskInfo.priority || 'medium',
			description: taskInfo.description || '',
			detected: new Date(),
			taskCount: taskInfo.taskCount
		});
	} else if (microProgress) {
		// Micro-progress update, no task count update needed
	} else if (taskInfo) {
		// Invalid taskInfo format or missing taskId
	}

	// Create progress bar (20 characters wide)
	const progressBarWidth = 20;

	// Prevent progress bar jumps by ensuring gradual progression
	// This is key to preventing the 19% to 100% jump
	let smoothPercentComplete = percentComplete;

	if (completed) {
		// Only show 100% when actually complete
		smoothPercentComplete = 100;
	} else {
		// Ensure progress never goes backward by taking the maximum
		// of current percentage and last displayed percentage
		smoothPercentComplete = Math.max(
			displayPRDParsingProgress.lastPercentComplete || 0,
			percentComplete
		);

		// Update our tracking for reference only
		displayPRDParsingProgress.lastPercentComplete = smoothPercentComplete;
		displayPRDParsingProgress.lastUpdate = Date.now();
	}

	// Format percentage for display
	const percentText = `${Math.round(smoothPercentComplete)}%`;
	const percentTextLength = percentText.length;

	// Use actual token count directly - no smoothing
	const displayTokens = contextTokens;

	// Use actual token display with input/output format
	const tokenDisplay = `${promptTokens}/${completionTokens}`;

	// Log token information for debugging

	// Update our tracking for reference only
	displayPRDParsingProgress.lastTokenCount = contextTokens;

	// For displaying task count, prioritize different sources
	let displayedTasks;
	if (completed) {
		// If completed, show total tasks
		displayedTasks = totalTasks;
	} else if (taskInfo && taskInfo.taskCount) {
		// If we have taskInfo with taskCount, use that (regardless of microProgress)
		displayedTasks = taskInfo.taskCount;
		// Update our tracking for consistent display
		displayPRDParsingProgress.actualTaskCount = taskInfo.taskCount;
	} else if (tasksGenerated > 0) {
		// Use provided tasksGenerated if available
		displayedTasks = tasksGenerated;
		// Update our tracking for consistent display
		displayPRDParsingProgress.actualTaskCount = tasksGenerated;
	} else {
		// Otherwise use our tracked count
		displayedTasks = displayPRDParsingProgress.actualTaskCount;
	}

	// Calculate position for centered percentage
	const halfBarWidth = Math.floor(progressBarWidth / 2);
	const percentStartPos = Math.max(
		0,
		halfBarWidth - Math.floor(percentTextLength / 2)
	);
	const percentEndPos = percentStartPos + percentTextLength - 1;

	// Calculate how many filled and empty chars to draw - use actual percentage
	const rawFilledChars = Math.floor(
		(smoothPercentComplete / 100) * progressBarWidth
	);

	// Create the progress bar with centered percentage that accurately represents the percentage
	let progressBar = '';
	let filledCount = 0;
	let emptyCount = 0;
	let textAdded = false;

	for (let i = 0; i < progressBarWidth; i++) {
		// Determine if this position should be filled based on percentage
		const shouldBeFilled = i < rawFilledChars;

		// If we're in the percentage text range
		if (i >= percentStartPos && i <= percentEndPos) {
			// Only add the text once at the starting position
			if (i === percentStartPos) {
				progressBar += chalk.bold.white(percentText);
				i = percentEndPos; // Skip ahead
				textAdded = true;

				// Track how many filled and empty positions were "consumed" by the text
				const textPositionsCount = percentTextLength;
				const filledPositionsInText = Math.min(
					rawFilledChars - percentStartPos,
					textPositionsCount
				);
				const emptyPositionsInText = textPositionsCount - filledPositionsInText;

				filledCount += filledPositionsInText;
				emptyCount += emptyPositionsInText;
			}
		} else if (shouldBeFilled) {
			// This position should be filled
			progressBar += chalk.cyan('█');
			filledCount++;
		} else {
			// This position should be empty
			progressBar += chalk.gray('░');
			emptyCount++;
		}
	}

	// Log progress bar composition for debugging

	// Use spinner from ora
	const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

	// Increment the counter for animation
	if (!displayPRDParsingProgress.frameCounter) {
		displayPRDParsingProgress.frameCounter = 0;
	}
	if (!displayPRDParsingProgress.updateToggle) {
		displayPRDParsingProgress.updateToggle = false;
	}

	// Toggle between updating and not updating to halve the speed
	displayPRDParsingProgress.updateToggle =
		!displayPRDParsingProgress.updateToggle;

	// Only update every other call to make animation half as fast
	if (displayPRDParsingProgress.updateToggle) {
		displayPRDParsingProgress.frameCounter =
			(displayPRDParsingProgress.frameCounter + 1) % spinnerFrames.length;
	}

	const spinner = chalk.cyan(
		spinnerFrames[displayPRDParsingProgress.frameCounter]
	);

	// Determine the message to display in the progress bar
	let thinkingMessage = '';

	if (completed) {
		// If process is completed, show completion message
		thinkingMessage = '✅ Complete';
	} else if (message) {
		// If we have a specific message from the progress event, use that
		thinkingMessage = message;
		// Store this message for micro-progress updates to use
		displayPRDParsingProgress.lastThinkingMessage = message;
	} else if (state === 'thinking') {
		thinkingMessage = 'Analyzing...';
		// Store this message for micro-progress updates to use
		displayPRDParsingProgress.lastThinkingMessage = 'Analyzing...';
	} else {
		thinkingMessage = 'Processing...';
		// Store this message for micro-progress updates to use
		displayPRDParsingProgress.lastThinkingMessage = 'Processing...';
	}

	// Format status line based on whether we're complete or not
	let statusLine;

	if (completed) {
		// For completed progress, show checkmark and "Complete" text
		statusLine =
			`  ${chalk.cyan('⏱')} ${timeDisplay} ${chalk.gray('|')} ` +
			`Tasks: ${chalk.bold(`${totalTasks}/${totalTasks}`)} ${chalk.gray('|')} ` +
			`Tokens (I/O): ${tokenDisplay} ${chalk.gray('|')} ` +
			`${progressBar} ${chalk.gray('|')} ` +
			`${chalk.green('✅')} ${chalk.green('Complete')}`;
	} else {
		// For standard in-progress state, use the most accurate task count
		statusLine =
			`  ${chalk.cyan('⏱')} ${timeDisplay} ${chalk.gray('|')} ` +
			`Tasks: ${chalk.bold(`${displayedTasks}/${totalTasks}`)} ${chalk.gray('|')} ` +
			`Tokens (I/O): ${tokenDisplay} ${chalk.gray('|')} ` +
			`${progressBar} ${chalk.gray('|')} ` +
			`${thinkingMessage} ${spinner}`;
	}

	// Set the flag to indicate status line has been started
	displayPRDParsingProgress.statusLineStarted = true;

	// Clear the line and update the status
	process.stdout.write('\r\x1B[K'); // This clears the entire line

	// Only print task detection if we have new task info
	if (
		taskInfo &&
		typeof taskInfo === 'object' &&
		taskInfo.taskId &&
		taskInfo.taskId > displayPRDParsingProgress.lastTaskId
	) {
		// Function to color task titles based on priority (simplified)
		const priorityColor = (priority) => {
			const priorityLower = String(priority || 'medium').toLowerCase();

			// Use consistent color scheme for priorities
			if (priorityLower === 'high') return chalk.hex('#CC0000');
			if (priorityLower === 'medium') return chalk.hex('#FF8800');
			if (priorityLower === 'low') return chalk.green;

			return chalk.yellow; // Default fallback
		};

		// Get the priority from the task info
		let priorityToDisplay = 'medium'; // Default to medium

		if (taskInfo.priority) {
			const normalizedPriority = String(taskInfo.priority).toLowerCase();
			// Only use valid priority values
			if (['high', 'medium', 'low'].includes(normalizedPriority)) {
				priorityToDisplay = normalizedPriority;
			}
		}

		// Update the taskInfo object for consistency
		if (taskInfo.priority !== priorityToDisplay) {
			taskInfo.priority = priorityToDisplay;
		}

		// Instead of writing the status line with a spinner, create a "completed" version without spinner
		const completedStatusLine =
			`  ${chalk.cyan('⏱')} ${timeDisplay} ${chalk.gray('|')} ` +
			`Tasks: ${chalk.bold(`${displayedTasks}/${totalTasks}`)} ${chalk.gray('|')} ` +
			`Tokens (I/O): ${tokenDisplay} ${chalk.gray('|')} ` +
			`${progressBar} ${chalk.gray('|')} ` +
			`${thinkingMessage}`; // No spinner here

		// Write the completed status line without spinner
		process.stdout.write(completedStatusLine);

		// Priority visualization with pips
		const getPriorityPips = (priority) => {
			const priorityLower = priority.toLowerCase();

			if (priorityLower === 'high') {
				return chalk.hex('#CC0000')('●●●'); // Three red pips for high priority
			} else if (priorityLower === 'medium') {
				return chalk.hex('#FF8800')('●●○'); // Two orange pips for medium priority
			} else if (priorityLower === 'low') {
				return chalk.green('●○○'); // One green pip for low priority
			} else {
				return chalk.yellow('●○○'); // Default fallback
			}
		};

		// Move to next line and print task detection with proper indentation and priority pips
		console.log(
			'\n' +
				`  ${chalk.green('✓')} ${getPriorityPips(priorityToDisplay)} ${chalk.bold('Task ' + taskInfo.taskId)}: ` +
				`${taskInfo.title}`
		);

		// Update our tracking
		displayPRDParsingProgress.lastTaskId = taskInfo.taskId;

		// Store the task with its priority in our tracking map
		if (!displayPRDParsingProgress.detectedTasks) {
			displayPRDParsingProgress.detectedTasks = new Map();
		}

		// Always track the task with the correct priority - but remove unnecessary debug info
		displayPRDParsingProgress.detectedTasks.set(taskInfo.taskId, {
			id: taskInfo.taskId,
			title: taskInfo.title,
			priority: priorityToDisplay
		});
	} else {
		// Just write the status line (no new task)
		process.stdout.write(statusLine);
	}

	// Additional handling for completion
	if (completed && !displayPRDParsingProgress.hasCompletedBefore) {
		// Move to next line after showing completion but leave the progress bar visible
		process.stdout.write('\n\n');

		// Mark as having completed to avoid printing multiple newlines
		displayPRDParsingProgress.hasCompletedBefore = true;

		// Reset other initialization state for next run
		displayPRDParsingProgress.initialized = undefined;
		displayPRDParsingProgress.statusLineStarted = false;
		displayPRDParsingProgress.detectedTasks = new Map();
		displayPRDParsingProgress.lastTaskId = 0;
		displayPRDParsingProgress.lastPercentComplete = 0;
		displayPRDParsingProgress.lastTokenCount = 0;
		displayPRDParsingProgress.actualTaskCount = 0;
	}
}

/**
 * Display a summary of the PRD parsing results
 * @param {Object} summary - Summary of the parsing results
 * @param {number} summary.totalTasks - Total number of tasks generated
 * @param {string} summary.prdFilePath - Path to the PRD file
 * @param {string} summary.outputPath - Path where the tasks were saved
 * @param {number} summary.elapsedTime - Total elapsed time in seconds
 * @param {Object} summary.taskCategories - Breakdown of tasks by category/priority
 * @param {boolean} summary.recoveryMode - Whether recovery mode was used to parse the response
 * @param {string} summary.taskFilesGenerated - Information about generated task files
 * @param {string} summary.actionVerb - Whether tasks were 'generated' or 'appended'
 */
function displayPRDParsingSummary(summary) {
	// Calculate task category percentages
	const {
		totalTasks,
		taskCategories = {},
		prdFilePath,
		outputPath,
		elapsedTime,
		recoveryMode = false,
		taskFilesGenerated,
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
	if (taskCategories && Object.keys(taskCategories).length > 0) {
		// Count tasks by priority
		const highPriority = taskCategories.high || 0;
		const mediumPriority = taskCategories.medium || 0;
		const lowPriority = taskCategories.low || 0;

		// Calculate percentages
		const percentHigh = Math.round((highPriority / totalTasks) * 100);
		const percentMedium = Math.round((mediumPriority / totalTasks) * 100);
		const percentLow = Math.round((lowPriority / totalTasks) * 100);

		// Priority distribution row - use the same color scheme as formatComplexitySummary
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

	// Add task files generation info if available
	if (taskFilesGenerated) {
		table.push([
			chalk.cyan('Files generated:'),
			chalk.italic(taskFilesGenerated)
		]);
	} else if (totalTasks > 0) {
		// Create formatted task file range (e.g., task_001.txt -> task_010.txt)
		const firstTaskId = '001';
		const lastTaskId = totalTasks.toString().padStart(3, '0');
		const fileRange = `task_${firstTaskId}.txt -> task_${lastTaskId}.txt`;

		table.push([chalk.cyan(`Files ${actionVerb}:`), chalk.italic(fileRange)]);
	}

	// Add recovery mode indicator if applicable
	if (recoveryMode) {
		table.push([
			chalk.yellow('Recovery mode:'),
			chalk.yellow('✓ Used recovery parsing')
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

	// Remove the task file range code from here as we're moving it to the end

	// Return a boxed version
	console.log(
		boxen(output, {
			padding: { top: 1, right: 1, bottom: 1, left: 1 },
			borderColor: 'blue', // Change from green to blue to match formatComplexitySummary
			borderStyle: 'round',
			margin: { top: 1, right: 1, bottom: 1, left: 0 }
		})
	);

	// Show recovery mode warning if needed
	if (recoveryMode) {
		console.log(
			boxen(
				chalk.yellow.bold('⚠️ Recovery Mode Used') +
					'\n\n' +
					chalk.white(
						'The system had to recover from a parsing error in the AI response.'
					) +
					'\n' +
					chalk.white(
						'While your tasks were successfully generated, there might be:'
					) +
					'\n' +
					chalk.white('• Missing details in some tasks') +
					'\n' +
					chalk.white('• Incomplete metadata') +
					'\n' +
					chalk.white('• Inconsistencies in task format') +
					'\n\n' +
					chalk.white(
						'Consider reviewing and potentially regenerating if issues are present.'
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

	// We've moved the task file range display to be part of the main table
}

// Export UI functions
export {
	displayBanner,
	startLoadingIndicator,
	stopLoadingIndicator,
	createProgressBar,
	getStatusWithColor,
	formatDependenciesWithStatus,
	displayHelp,
	getComplexityWithColor,
	displayNextTask,
	displayTaskById,
	displayComplexityAnalysisStart,
	displayComplexityReport,
	confirmTaskOverwrite,
	displayAnalysisProgress,
	formatComplexitySummary,
	displayPRDParsingStart,
	displayPRDParsingProgress,
	displayPRDParsingSummary,
	formatElapsedTime
};
