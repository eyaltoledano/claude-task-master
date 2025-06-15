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
	log,
	findTaskById,
	readJSON,
	truncate,
	isSilentMode
} from './utils.js';
import fs from 'fs';
import {
	findNextTask,
	analyzeTaskComplexity,
	readComplexityReport
} from './task-manager.js';
import { getProjectName, getDefaultSubtasks } from './config-manager.js';
import { TASK_STATUS_OPTIONS } from '../../src/constants/task-status.js';
import {
	TASKMASTER_CONFIG_FILE,
	TASKMASTER_TASKS_FILE
} from '../../src/constants/paths.js';
import { getTaskMasterVersion } from '../../src/utils/getVersion.js';

// Create a color gradient for the banner
const coolGradient = gradient(['#00b4d8', '#0077b6', '#03045e']);
const warmGradient = gradient(['#fb8b24', '#e36414', '#9a031e']);

/**
 * Display FYI notice about tagged task lists (only if migration occurred)
 * @param {Object} data - Data object that may contain _migrationHappened flag
 */
function displayTaggedTasksFYI(data) {
	if (isSilentMode() || !data || !data._migrationHappened) return;

	console.log(
		boxen(
			chalk.white.bold('FYI: ') +
				chalk.gray('Taskmaster now supports separate task lists per tag. ') +
				chalk.cyan(
					'Use the --tag flag to create/read/update/filter tasks by tag.'
				),
			{
				padding: { top: 0, bottom: 0, left: 2, right: 2 },
				borderColor: 'cyan',
				borderStyle: 'round',
				margin: { top: 1, bottom: 1 }
			}
		)
	);
}

/**
 * Display a small, non-intrusive indicator showing the current tag context
 * @param {string} tagName - The tag name to display
 * @param {Object} options - Display options
 * @param {boolean} [options.skipIfMaster=false] - Don't show indicator if tag is 'master'
 * @param {boolean} [options.dim=false] - Use dimmed styling
 */
function displayCurrentTagIndicator(tag, options = {}) {
	if (isSilentMode()) return;

	const { skipIfMaster = false, dim = false } = options;

	// Skip display for master tag only if explicitly requested
	if (skipIfMaster && tag === 'master') return;

	// Create a small, tasteful tag indicator
	const tagIcon = '🏷️';
	const tagText = dim
		? chalk.gray(`${tagIcon} tag: ${tag}`)
		: chalk.dim(`${tagIcon} tag: `) + chalk.cyan(tag);

	console.log(tagText);
}

/**
 * Display a fancy banner for the CLI
 */
function displayBanner() {
	if (isSilentMode()) return;

	// console.clear(); // Removing this to avoid clearing the terminal per command
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
	const version = getTaskMasterVersion();

	console.log(
		boxen(
			chalk.white(
				`${chalk.bold('Version:')} ${version}   ${chalk.bold('Project:')} ${getProjectName(null)}`
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
	if (isSilentMode()) return null;

	const spinner = ora({
		text: message,
		color: 'cyan'
	}).start();

	return spinner;
}

/**
 * Stop a loading indicator (basic stop, no success/fail indicator)
 * @param {Object} spinner - Spinner object to stop
 */
function stopLoadingIndicator(spinner) {
	if (spinner && typeof spinner.stop === 'function') {
		spinner.stop();
	}
}

/**
 * Complete a loading indicator with success (shows checkmark)
 * @param {Object} spinner - Spinner object to complete
 * @param {string} message - Optional success message (defaults to current text)
 */
function succeedLoadingIndicator(spinner, message = null) {
	if (spinner && typeof spinner.succeed === 'function') {
		if (message) {
			spinner.succeed(message);
		} else {
			spinner.succeed();
		}
	}
}

/**
 * Complete a loading indicator with failure (shows X)
 * @param {Object} spinner - Spinner object to fail
 * @param {string} message - Optional failure message (defaults to current text)
 */
function failLoadingIndicator(spinner, message = null) {
	if (spinner && typeof spinner.fail === 'function') {
		if (message) {
			spinner.fail(message);
		} else {
			spinner.fail();
		}
	}
}

/**
 * Complete a loading indicator with warning (shows warning symbol)
 * @param {Object} spinner - Spinner object to warn
 * @param {string} message - Optional warning message (defaults to current text)
 */
function warnLoadingIndicator(spinner, message = null) {
	if (spinner && typeof spinner.warn === 'function') {
		if (message) {
			spinner.warn(message);
		} else {
			spinner.warn();
		}
	}
}

/**
 * Complete a loading indicator with info (shows info symbol)
 * @param {Object} spinner - Spinner object to complete with info
 * @param {string} message - Optional info message (defaults to current text)
 */
function infoLoadingIndicator(spinner, message = null) {
	if (spinner && typeof spinner.info === 'function') {
		if (message) {
			spinner.info(message);
		} else {
			spinner.info();
		}
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
		done: { color: chalk.green, icon: '✓', tableIcon: '✓' },
		completed: { color: chalk.green, icon: '✓', tableIcon: '✓' },
		pending: { color: chalk.yellow, icon: '○', tableIcon: '⏱' },
		'in-progress': { color: chalk.hex('#FFA500'), icon: '🔄', tableIcon: '►' },
		deferred: { color: chalk.gray, icon: 'x', tableIcon: '⏱' },
		blocked: { color: chalk.red, icon: '!', tableIcon: '✗' },
		review: { color: chalk.magenta, icon: '?', tableIcon: '?' },
		cancelled: { color: chalk.gray, icon: '❌', tableIcon: 'x' }
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
 * @param {Object|null} complexityReport - Optional pre-loaded complexity report
 * @returns {string} Formatted dependencies string
 */
function formatDependenciesWithStatus(
	dependencies,
	allTasks,
	forConsole = false,
	complexityReport = null // Add complexityReport parameter
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
		const depTaskResult = findTaskById(
			allTasks,
			numericDepId,
			complexityReport
		);
		const depTask = depTaskResult.task; // Access the task object from the result

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
	// Get terminal width - moved to top of function to make it available throughout
	const terminalWidth = process.stdout.columns || 100; // Default to 100 if can't detect

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
			title: 'Project Setup & Configuration',
			color: 'blue',
			commands: [
				{
					name: 'init',
					args: '[--name=<name>] [--description=<desc>] [-y]',
					desc: 'Initialize a new project with Task Master structure'
				},
				{
					name: 'models',
					args: '',
					desc: 'View current AI model configuration and available models'
				},
				{
					name: 'models --setup',
					args: '',
					desc: 'Run interactive setup to configure AI models'
				},
				{
					name: 'models --set-main',
					args: '<model_id>',
					desc: 'Set the primary model for task generation'
				},
				{
					name: 'models --set-research',
					args: '<model_id>',
					desc: 'Set the model for research operations'
				},
				{
					name: 'models --set-fallback',
					args: '<model_id>',
					desc: 'Set the fallback model (optional)'
				}
			]
		},
		{
			title: 'Task Generation',
			color: 'cyan',
			commands: [
				{
					name: 'parse-prd',
					args: '--input=<file.txt> [--num-tasks=10]',
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
					desc: `Update task status (${TASK_STATUS_OPTIONS.join(', ')})`
				},
				{
					name: 'sync-readme',
					args: '[--with-subtasks] [--status=<status>]',
					desc: 'Export tasks to README.md with professional formatting'
				},
				{
					name: 'update',
					args: '--from=<id> --prompt="<context>"',
					desc: 'Update multiple tasks based on new requirements'
				},
				{
					name: 'update-task',
					args: '--id=<id> --prompt="<context>"',
					desc: 'Update a single specific task with new information'
				},
				{
					name: 'update-subtask',
					args: '--id=<parentId.subtaskId> --prompt="<context>"',
					desc: 'Append additional information to a subtask'
				},
				{
					name: 'add-task',
					args: '--prompt="<text>" [--dependencies=<ids>] [--priority=<priority>]',
					desc: 'Add a new task using AI'
				},
				{
					name: 'remove-task',
					args: '--id=<id> [-y]',
					desc: 'Permanently remove a task or subtask'
				}
			]
		},
		{
			title: 'Subtask Management',
			color: 'yellow',
			commands: [
				{
					name: 'add-subtask',
					args: '--parent=<id> --title="<title>" [--description="<desc>"]',
					desc: 'Add a new subtask to a parent task'
				},
				{
					name: 'add-subtask',
					args: '--parent=<id> --task-id=<id>',
					desc: 'Convert an existing task into a subtask'
				},
				{
					name: 'remove-subtask',
					args: '--id=<parentId.subtaskId> [--convert]',
					desc: 'Remove a subtask (optionally convert to standalone task)'
				},
				{
					name: 'clear-subtasks',
					args: '--id=<id>',
					desc: 'Remove all subtasks from specified tasks'
				},
				{
					name: 'clear-subtasks --all',
					args: '',
					desc: 'Remove subtasks from all tasks'
				}
			]
		},
		{
			title: 'Task Analysis & Breakdown',
			color: 'magenta',
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
					name: 'research',
					args: '"<prompt>" [-i=<task_ids>] [-f=<file_paths>] [-c="<context>"] [--tree] [-s=<save_file>] [-d=<detail_level>]',
					desc: 'Perform AI-powered research queries with project context'
				}
			]
		},
		{
			title: 'Task Navigation & Viewing',
			color: 'cyan',
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
			title: 'Tag Management',
			color: 'magenta',
			commands: [
				{
					name: 'tags',
					args: '[--show-metadata]',
					desc: 'List all available tags with task counts'
				},
				{
					name: 'add-tag',
					args: '<tagName> [--copy-from-current] [--copy-from=<tag>] [-d="<desc>"]',
					desc: 'Create a new tag context for organizing tasks'
				},
				{
					name: 'use-tag',
					args: '<tagName>',
					desc: 'Switch to a different tag context'
				},
				{
					name: 'delete-tag',
					args: '<tagName> [--yes]',
					desc: 'Delete an existing tag and all its tasks'
				},
				{
					name: 'rename-tag',
					args: '<oldName> <newName>',
					desc: 'Rename an existing tag'
				},
				{
					name: 'copy-tag',
					args: '<sourceName> <targetName> [-d="<desc>"]',
					desc: 'Copy an existing tag to create a new tag with the same tasks'
				}
			]
		},
		{
			title: 'Dependency Management',
			color: 'blue',
			commands: [
				{
					name: 'add-dependency',
					args: '--id=<id> --depends-on=<id>',
					desc: 'Add a dependency to a task'
				},
				{
					name: 'remove-dependency',
					args: '--id=<id> --depends-on=<id>',
					desc: 'Remove a dependency from a task'
				},
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

		// Calculate dynamic column widths - adjust ratios as needed
		const nameWidth = Math.max(25, Math.floor(terminalWidth * 0.2)); // 20% of width but min 25
		const argsWidth = Math.max(40, Math.floor(terminalWidth * 0.35)); // 35% of width but min 40
		const descWidth = Math.max(45, Math.floor(terminalWidth * 0.45) - 10); // 45% of width but min 45, minus some buffer

		const commandTable = new Table({
			colWidths: [nameWidth, argsWidth, descWidth],
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
			style: { border: [], 'padding-left': 4 },
			wordWrap: true
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

	// Display configuration section
	console.log(
		boxen(chalk.cyan.bold('Configuration'), {
			padding: { left: 2, right: 2, top: 0, bottom: 0 },
			margin: { top: 1, bottom: 0 },
			borderColor: 'cyan',
			borderStyle: 'round'
		})
	);

	// Get terminal width if not already defined
	const configTerminalWidth = terminalWidth || process.stdout.columns || 100;

	// Calculate dynamic column widths for config table
	const configKeyWidth = Math.max(30, Math.floor(configTerminalWidth * 0.25));
	const configDescWidth = Math.max(50, Math.floor(configTerminalWidth * 0.45));
	const configValueWidth = Math.max(
		30,
		Math.floor(configTerminalWidth * 0.3) - 10
	);

	const configTable = new Table({
		colWidths: [configKeyWidth, configDescWidth, configValueWidth],
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
		style: { border: [], 'padding-left': 4 },
		wordWrap: true
	});

	configTable.push(
		[
			`${chalk.yellow(TASKMASTER_CONFIG_FILE)}${chalk.reset('')}`,
			`${chalk.white('AI model configuration file (project root)')}${chalk.reset('')}`,
			`${chalk.dim('Managed by models cmd')}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('API Keys (.env)')}${chalk.reset('')}`,
			`${chalk.white('API keys for AI providers (ANTHROPIC_API_KEY, etc.)')}${chalk.reset('')}`,
			`${chalk.dim('Required in .env file')}${chalk.reset('')}`
		],
		[
			`${chalk.yellow('MCP Keys (mcp.json)')}${chalk.reset('')}`,
			`${chalk.white('API keys for Cursor integration')}${chalk.reset('')}`,
			`${chalk.dim('Required in .cursor/')}${chalk.reset('')}`
		]
	);

	console.log(configTable.toString());
	console.log('');

	// Show helpful hints
	console.log(
		boxen(
			chalk.white.bold('Quick Start:') +
				'\n\n' +
				chalk.cyan('1. Create Project: ') +
				chalk.white('task-master init') +
				'\n' +
				chalk.cyan('2. Setup Models: ') +
				chalk.white('task-master models --setup') +
				'\n' +
				chalk.cyan('3. Parse PRD: ') +
				chalk.white('task-master parse-prd --input=<prd-file>') +
				'\n' +
				chalk.cyan('4. List Tasks: ') +
				chalk.white('task-master list') +
				'\n' +
				chalk.cyan('5. Find Next Task: ') +
				chalk.white('task-master next'),
			{
				padding: 1,
				borderColor: 'yellow',
				borderStyle: 'round',
				margin: { top: 1 },
				width: Math.min(configTerminalWidth - 10, 100) // Limit width to terminal width minus padding, max 100
			}
		)
	);
}

/**
 * Get colored complexity score
 * @param {number} score - Complexity score (1-10)
 * @returns {string} Colored complexity score
 */
function getComplexityWithColor(score) {
	if (score <= 3) return chalk.green(`● ${score}`);
	if (score <= 6) return chalk.yellow(`● ${score}`);
	return chalk.red(`● ${score}`);
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
 * @param {string} complexityReportPath - Path to the complexity report file
 * @param {string} tag - Optional tag to override current tag resolution
 */
async function displayNextTask(
	tasksPath,
	complexityReportPath = null,
	context = {}
) {
	// Extract parameters from context
	const { projectRoot, tag } = context;

	// Read the tasks file with proper projectRoot for tag resolution
	const data = readJSON(tasksPath, projectRoot, tag);
	if (!data || !data.tasks) {
		log('error', 'No valid tasks found.');
		process.exit(1);
	}

	// Read complexity report once
	const complexityReport = readComplexityReport(complexityReportPath);

	// Find the next task
	const nextTask = findNextTask(data.tasks, complexityReport);

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
		chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
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
			formatDependenciesWithStatus(
				nextTask.dependencies,
				data.tasks,
				true,
				complexityReport
			)
		],
		[
			chalk.cyan.bold('Complexity:'),
			nextTask.complexityScore
				? getComplexityWithColor(nextTask.complexityScore)
				: chalk.gray('N/A')
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

	// Determine if the nextTask is a subtask
	const isSubtask = !!nextTask.parentId;

	// Show subtasks if they exist (only for parent tasks)
	if (!isSubtask && nextTask.subtasks && nextTask.subtasks.length > 0) {
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
			chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
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
	}

	// Suggest expanding if no subtasks (only for parent tasks without subtasks)
	if (!isSubtask && (!nextTask.subtasks || nextTask.subtasks.length === 0)) {
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
	let suggestedActionsContent = chalk.white.bold('Suggested Actions:') + '\n';
	if (isSubtask) {
		// Suggested actions for a subtask
		suggestedActionsContent +=
			`${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=in-progress`)}\n` +
			`${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=done`)}\n` +
			`${chalk.cyan('3.')} View parent task: ${chalk.yellow(`task-master show --id=${nextTask.parentId}`)}`;
	} else {
		// Suggested actions for a parent task
		suggestedActionsContent +=
			`${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=in-progress`)}\n` +
			`${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=done`)}\n` +
			(nextTask.subtasks && nextTask.subtasks.length > 0
				? `${chalk.cyan('3.')} Update subtask status: ${chalk.yellow(`task-master set-status --id=${nextTask.id}.1 --status=done`)}` // Example: first subtask
				: `${chalk.cyan('3.')} Break down into subtasks: ${chalk.yellow(`task-master expand --id=${nextTask.id}`)}`);
	}

	console.log(
		boxen(suggestedActionsContent, {
			padding: { top: 0, bottom: 0, left: 1, right: 1 },
			borderColor: 'green',
			borderStyle: 'round',
			margin: { top: 1 }
		})
	);

	// Show FYI notice if migration occurred
	displayTaggedTasksFYI(data);
}

/**
 * Display a specific task by ID
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string|number} taskId - The ID of the task to display
 * @param {string} complexityReportPath - Path to the complexity report file
 * @param {string} [statusFilter] - Optional status to filter subtasks by
 * @param {string} tag - Optional tag to override current tag resolution
 */
async function displayTaskById(
	tasksPath,
	taskId,
	complexityReportPath = null,
	statusFilter = null,
	tag = null,
	context = {}
) {
	// Extract projectRoot from context
	const projectRoot = context.projectRoot || null;

	// Read the tasks file with proper projectRoot for tag resolution
	const data = readJSON(tasksPath, projectRoot, tag);
	if (!data || !data.tasks) {
		log('error', 'No valid tasks found.');
		process.exit(1);
	}

	// Read complexity report once
	const complexityReport = readComplexityReport(complexityReportPath);

	// Find the task by ID, applying the status filter if provided
	// Returns { task, originalSubtaskCount, originalSubtasks }
	const { task, originalSubtaskCount, originalSubtasks } = findTaskById(
		data.tasks,
		taskId,
		complexityReport,
		statusFilter
	);

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

	// Handle subtask display specially (This logic remains the same)
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

		const subtaskTable = new Table({
			style: {
				head: [],
				border: [],
				'padding-top': 0,
				'padding-bottom': 0,
				compact: true
			},
			chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
			colWidths: [15, Math.min(75, process.stdout.columns - 20 || 60)],
			wordWrap: true
		});
		subtaskTable.push(
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
				chalk.cyan.bold('Complexity:'),
				task.complexityScore
					? getComplexityWithColor(task.complexityScore)
					: chalk.gray('N/A')
			],
			[
				chalk.cyan.bold('Description:'),
				task.description || 'No description provided.'
			]
		);
		console.log(subtaskTable.toString());

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
		return; // Exit after displaying subtask details
	}

	// --- Display Regular Task Details ---
	console.log(
		boxen(chalk.white.bold(`Task: #${task.id} - ${task.title}`), {
			padding: { top: 0, bottom: 0, left: 1, right: 1 },
			borderColor: 'blue',
			borderStyle: 'round',
			margin: { top: 1, bottom: 0 }
		})
	);

	const taskTable = new Table({
		style: {
			head: [],
			border: [],
			'padding-top': 0,
			'padding-bottom': 0,
			compact: true
		},
		chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
		colWidths: [15, Math.min(75, process.stdout.columns - 20 || 60)],
		wordWrap: true
	});
	const priorityColors = {
		high: chalk.red.bold,
		medium: chalk.yellow,
		low: chalk.gray
	};
	const priorityColor =
		priorityColors[task.priority || 'medium'] || chalk.white;
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
			formatDependenciesWithStatus(
				task.dependencies,
				data.tasks,
				true,
				complexityReport
			)
		],
		[
			chalk.cyan.bold('Complexity:'),
			task.complexityScore
				? getComplexityWithColor(task.complexityScore)
				: chalk.gray('N/A')
		],
		[chalk.cyan.bold('Description:'), task.description]
	);
	console.log(taskTable.toString());

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

	// --- Subtask Table Display (uses filtered list: task.subtasks) ---
	if (task.subtasks && task.subtasks.length > 0) {
		console.log(
			boxen(chalk.white.bold('Subtasks'), {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				margin: { top: 1, bottom: 0 },
				borderColor: 'magenta',
				borderStyle: 'round'
			})
		);

		const availableWidth = process.stdout.columns - 10 || 100;
		const idWidthPct = 10;
		const statusWidthPct = 15;
		const depsWidthPct = 25;
		const titleWidthPct = 100 - idWidthPct - statusWidthPct - depsWidthPct;
		const idWidth = Math.floor(availableWidth * (idWidthPct / 100));
		const statusWidth = Math.floor(availableWidth * (statusWidthPct / 100));
		const depsWidth = Math.floor(availableWidth * (depsWidthPct / 100));
		const titleWidth = Math.floor(availableWidth * (titleWidthPct / 100));

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
			chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
			wordWrap: true
		});

		// Populate table with the potentially filtered subtasks
		task.subtasks.forEach((st) => {
			const statusColorMap = {
				done: chalk.green,
				completed: chalk.green,
				pending: chalk.yellow,
				'in-progress': chalk.blue
			};
			const statusColor = statusColorMap[st.status || 'pending'] || chalk.white;
			let subtaskDeps = 'None';
			if (st.dependencies && st.dependencies.length > 0) {
				const formattedDeps = st.dependencies.map((depId) => {
					// Use the original, unfiltered list for dependency status lookup
					const sourceListForDeps = originalSubtasks || task.subtasks;
					const foundDepSubtask =
						typeof depId === 'number' && depId < 100
							? sourceListForDeps.find((sub) => sub.id === depId)
							: null;

					if (foundDepSubtask) {
						const isDone =
							foundDepSubtask.status === 'done' ||
							foundDepSubtask.status === 'completed';
						const isInProgress = foundDepSubtask.status === 'in-progress';
						const color = isDone
							? chalk.green.bold
							: isInProgress
								? chalk.hex('#FFA500').bold
								: chalk.red.bold;
						return color(`${task.id}.${depId}`);
					} else if (typeof depId === 'number' && depId < 100) {
						return chalk.red(`${task.id}.${depId} (Not found)`);
					}
					return depId; // Assume it's a top-level task ID if not a number < 100
				});
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

		// Display filter summary line *immediately after the table* if a filter was applied
		if (statusFilter && originalSubtaskCount !== null) {
			console.log(
				chalk.cyan(
					`  Filtered by status: ${chalk.bold(statusFilter)}. Showing ${chalk.bold(task.subtasks.length)} of ${chalk.bold(originalSubtaskCount)} subtasks.`
				)
			);
			// Add a newline for spacing before the progress bar if the filter line was shown
			console.log();
		}
		// --- Conditional Messages for No Subtasks Shown ---
	} else if (statusFilter && originalSubtaskCount === 0) {
		// Case where filter applied, but the parent task had 0 subtasks originally
		console.log(
			boxen(
				chalk.yellow(
					`No subtasks found matching status: ${statusFilter} (Task has no subtasks)`
				),
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					margin: { top: 1, bottom: 0 },
					borderColor: 'yellow',
					borderStyle: 'round'
				}
			)
		);
	} else if (
		statusFilter &&
		originalSubtaskCount > 0 &&
		task.subtasks.length === 0
	) {
		// Case where filter applied, original subtasks existed, but none matched
		console.log(
			boxen(
				chalk.yellow(
					`No subtasks found matching status: ${statusFilter} (out of ${originalSubtaskCount} total)`
				),
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					margin: { top: 1, bottom: 0 },
					borderColor: 'yellow',
					borderStyle: 'round'
				}
			)
		);
	} else if (
		!statusFilter &&
		(!originalSubtasks || originalSubtasks.length === 0)
	) {
		// Case where NO filter applied AND the task genuinely has no subtasks
		// Use the authoritative originalSubtasks if it exists (from filtering), else check task.subtasks
		const actualSubtasks = originalSubtasks || task.subtasks;
		if (!actualSubtasks || actualSubtasks.length === 0) {
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
	}

	// --- Subtask Progress Bar Display (uses originalSubtasks or task.subtasks) ---
	// Determine the list to use for progress calculation (always the original if available and filtering happened)
	const subtasksForProgress = originalSubtasks || task.subtasks; // Use original if filtering occurred, else the potentially empty task.subtasks

	// Only show progress if there are actually subtasks
	if (subtasksForProgress && subtasksForProgress.length > 0) {
		const totalSubtasks = subtasksForProgress.length;
		const completedSubtasks = subtasksForProgress.filter(
			(st) => st.status === 'done' || st.status === 'completed'
		).length;

		// Count other statuses from the original/complete list
		const inProgressSubtasks = subtasksForProgress.filter(
			(st) => st.status === 'in-progress'
		).length;
		const pendingSubtasks = subtasksForProgress.filter(
			(st) => st.status === 'pending'
		).length;
		const blockedSubtasks = subtasksForProgress.filter(
			(st) => st.status === 'blocked'
		).length;
		const deferredSubtasks = subtasksForProgress.filter(
			(st) => st.status === 'deferred'
		).length;
		const cancelledSubtasks = subtasksForProgress.filter(
			(st) => st.status === 'cancelled'
		).length;

		const statusBreakdown = {
			// Calculate breakdown based on the complete list
			'in-progress': (inProgressSubtasks / totalSubtasks) * 100,
			pending: (pendingSubtasks / totalSubtasks) * 100,
			blocked: (blockedSubtasks / totalSubtasks) * 100,
			deferred: (deferredSubtasks / totalSubtasks) * 100,
			cancelled: (cancelledSubtasks / totalSubtasks) * 100
		};
		const completionPercentage = (completedSubtasks / totalSubtasks) * 100;

		const availableWidth = process.stdout.columns || 80;
		const boxPadding = 2;
		const boxBorders = 2;
		const percentTextLength = 5;
		const progressBarLength = Math.max(
			20,
			Math.min(
				60,
				availableWidth - boxPadding - boxBorders - percentTextLength - 35
			)
		);

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
					width: Math.min(availableWidth - 10, 100),
					textAlignment: 'left'
				}
			)
		);
	}

	// --- Suggested Actions ---
	console.log(
		boxen(
			chalk.white.bold('Suggested Actions:') +
				'\n' +
				`${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`task-master set-status --id=${task.id} --status=in-progress`)}\n` +
				`${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`task-master set-status --id=${task.id} --status=done`)}\n` +
				// Determine action 3 based on whether subtasks *exist* (use the source list for progress)
				(subtasksForProgress && subtasksForProgress.length > 0
					? `${chalk.cyan('3.')} Update subtask status: ${chalk.yellow(`task-master set-status --id=${task.id}.1 --status=done`)}` // Example uses .1
					: `${chalk.cyan('3.')} Break down into subtasks: ${chalk.yellow(`task-master expand --id=${task.id}`)}`),
			{
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: 'green',
				borderStyle: 'round',
				margin: { top: 1 }
			}
		)
	);

	// Show FYI notice if migration occurred
	displayTaggedTasksFYI(data);
}

/**
 * Display the complexity analysis report in a nice format
 * @param {string} reportPath - Path to the complexity report file
 */
async function displayComplexityReport(reportPath) {
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
			const tasksPath = TASKMASTER_TASKS_FILE;
			if (!fs.existsSync(tasksPath)) {
				console.error(
					'❌ No tasks.json file found. Please run "task-master init" or create a tasks.json file.'
				);
				return null;
			}

			await analyzeTaskComplexity({
				output: reportPath,
				research: false, // Default to no research for speed
				file: tasksPath
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
 * Generate a prompt for complexity analysis
 * @param {Object} tasksData - Tasks data object containing tasks array
 * @returns {string} Generated prompt
 */
function generateComplexityAnalysisPrompt(tasksData) {
	const defaultSubtasks = getDefaultSubtasks(null); // Use the getter
	return `Analyze the complexity of the following tasks and provide recommendations for subtask breakdown:

${tasksData.tasks
	.map(
		(task) => `
Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Details: ${task.details}
Dependencies: ${JSON.stringify(task.dependencies || [])}
Priority: ${task.priority || 'medium'}
`
	)
	.join('\n---\n')}

Analyze each task and return a JSON array with the following structure for each task:
[
  {
    "taskId": number,
    "taskTitle": string,
    "complexityScore": number (1-10),
    "recommendedSubtasks": number (${Math.max(3, defaultSubtasks - 1)}-${Math.min(8, defaultSubtasks + 2)}),
    "expansionPrompt": string (a specific prompt for generating good subtasks),
    "reasoning": string (brief explanation of your assessment)
  },
  ...
]

IMPORTANT: Make sure to include an analysis for EVERY task listed above, with the correct taskId matching each task's ID.
`;
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
 * Displays the API key status for different providers.
 * @param {Array<{provider: string, cli: boolean, mcp: boolean}>} statusReport - The report generated by getApiKeyStatusReport.
 */
function displayApiKeyStatus(statusReport) {
	if (!statusReport || statusReport.length === 0) {
		console.log(chalk.yellow('No API key status information available.'));
		return;
	}

	const table = new Table({
		head: [
			chalk.cyan('Provider'),
			chalk.cyan('CLI Key (.env)'),
			chalk.cyan('MCP Key (mcp.json)')
		],
		colWidths: [15, 20, 25],
		chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
	});

	statusReport.forEach(({ provider, cli, mcp }) => {
		const cliStatus = cli ? chalk.green('✅ Found') : chalk.red('❌ Missing');
		const mcpStatus = mcp ? chalk.green('✅ Found') : chalk.red('❌ Missing');
		// Capitalize provider name for display
		const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
		table.push([providerName, cliStatus, mcpStatus]);
	});

	console.log(chalk.bold('\n🔑 API Key Status:'));
	console.log(table.toString());
	console.log(
		chalk.gray(
			`  Note: Some providers (e.g., Azure, Ollama) may require additional endpoint configuration in ${TASKMASTER_CONFIG_FILE}.`
		)
	);
}

// --- Formatting Helpers (Potentially move some to utils.js if reusable) ---

const formatSweScoreWithTertileStars = (score, allModels) => {
	// ... (Implementation from previous version or refine) ...
	if (score === null || score === undefined || score <= 0) return 'N/A';
	const formattedPercentage = `${(score * 100).toFixed(1)}%`;

	const validScores = allModels
		.map((m) => m.sweScore)
		.filter((s) => s !== null && s !== undefined && s > 0);
	const sortedScores = [...validScores].sort((a, b) => b - a);
	const n = sortedScores.length;
	let stars = chalk.gray('☆☆☆');

	if (n > 0) {
		const topThirdIndex = Math.max(0, Math.floor(n / 3) - 1);
		const midThirdIndex = Math.max(0, Math.floor((2 * n) / 3) - 1);
		if (score >= sortedScores[topThirdIndex]) stars = chalk.yellow('★★★');
		else if (score >= sortedScores[midThirdIndex])
			stars = chalk.yellow('★★') + chalk.gray('☆');
		else stars = chalk.yellow('★') + chalk.gray('☆☆');
	}
	return `${formattedPercentage} ${stars}`;
};

const formatCost = (costObj) => {
	// ... (Implementation from previous version or refine) ...
	if (!costObj) return 'N/A';
	if (costObj.input === 0 && costObj.output === 0) {
		return chalk.green('Free');
	}
	const formatSingleCost = (costValue) => {
		if (costValue === null || costValue === undefined) return 'N/A';
		const isInteger = Number.isInteger(costValue);
		return `$${costValue.toFixed(isInteger ? 0 : 2)}`;
	};
	return `${formatSingleCost(costObj.input)} in, ${formatSingleCost(costObj.output)} out`;
};

// --- Display Functions ---

/**
 * Displays the currently configured active models.
 * @param {ConfigData} configData - The active configuration data.
 * @param {AvailableModel[]} allAvailableModels - Needed for SWE score tertiles.
 */
function displayModelConfiguration(configData, allAvailableModels = []) {
	console.log(chalk.cyan.bold('\nActive Model Configuration:'));
	const active = configData.activeModels;
	const activeTable = new Table({
		head: [
			'Role',
			'Provider',
			'Model ID',
			'SWE Score',
			'Cost ($/1M tkns)'
			// 'API Key Status' // Removed, handled by separate displayApiKeyStatus
		].map((h) => chalk.cyan.bold(h)),
		colWidths: [10, 14, 30, 18, 20 /*, 28 */], // Adjusted widths
		style: { head: ['cyan', 'bold'] }
	});

	activeTable.push([
		chalk.white('Main'),
		active.main.provider,
		active.main.modelId,
		formatSweScoreWithTertileStars(active.main.sweScore, allAvailableModels),
		formatCost(active.main.cost)
		// getCombinedStatus(active.main.keyStatus) // Removed
	]);
	activeTable.push([
		chalk.white('Research'),
		active.research.provider,
		active.research.modelId,
		formatSweScoreWithTertileStars(
			active.research.sweScore,
			allAvailableModels
		),
		formatCost(active.research.cost)
		// getCombinedStatus(active.research.keyStatus) // Removed
	]);
	if (active.fallback && active.fallback.provider && active.fallback.modelId) {
		activeTable.push([
			chalk.white('Fallback'),
			active.fallback.provider,
			active.fallback.modelId,
			formatSweScoreWithTertileStars(
				active.fallback.sweScore,
				allAvailableModels
			),
			formatCost(active.fallback.cost)
			// getCombinedStatus(active.fallback.keyStatus) // Removed
		]);
	} else {
		activeTable.push([
			chalk.white('Fallback'),
			chalk.gray('-'),
			chalk.gray('(Not Set)'),
			chalk.gray('-'),
			chalk.gray('-')
			// chalk.gray('-') // Removed
		]);
	}
	console.log(activeTable.toString());
}

/**
 * Displays the list of available models not currently configured.
 * @param {AvailableModel[]} availableModels - List of available models.
 */
function displayAvailableModels(availableModels) {
	if (!availableModels || availableModels.length === 0) {
		console.log(
			chalk.gray('\n(No other models available or all are configured)')
		);
		return;
	}

	console.log(chalk.cyan.bold('\nOther Available Models:'));
	const availableTable = new Table({
		head: ['Provider', 'Model ID', 'SWE Score', 'Cost ($/1M tkns)'].map((h) =>
			chalk.cyan.bold(h)
		),
		colWidths: [15, 40, 18, 25],
		style: { head: ['cyan', 'bold'] }
	});

	availableModels.forEach((model) => {
		availableTable.push([
			model.provider,
			model.modelId,
			formatSweScoreWithTertileStars(model.sweScore, availableModels), // Pass itself for comparison
			formatCost(model.cost)
		]);
	});
	console.log(availableTable.toString());

	// --- Suggested Actions Section (moved here from models command) ---
	console.log(
		boxen(
			chalk.white.bold('Next Steps:') +
				'\n' +
				chalk.cyan(
					`1. Set main model: ${chalk.yellow('task-master models --set-main <model_id>')}`
				) +
				'\n' +
				chalk.cyan(
					`2. Set research model: ${chalk.yellow('task-master models --set-research <model_id>')}`
				) +
				'\n' +
				chalk.cyan(
					`3. Set fallback model: ${chalk.yellow('task-master models --set-fallback <model_id>')}`
				) +
				'\n' +
				chalk.cyan(
					`4. Run interactive setup: ${chalk.yellow('task-master models --setup')}`
				) +
				'\n' +
				chalk.cyan(
					`5. Use custom ollama/openrouter models: ${chalk.yellow('task-master models --openrouter|ollama --set-main|research|fallback <model_id>')}`
				),
			{
				padding: 1,
				borderColor: 'yellow',
				borderStyle: 'round',
				margin: { top: 1 }
			}
		)
	);
}

/**
 * Displays AI usage telemetry summary in the CLI.
 * @param {object} telemetryData - The telemetry data object.
 * @param {string} outputType - 'cli' or 'mcp' (though typically only called for 'cli').
 */
function displayAiUsageSummary(telemetryData, outputType = 'cli') {
	if (
		(outputType !== 'cli' && outputType !== 'text') ||
		!telemetryData ||
		isSilentMode()
	) {
		return; // Only display for CLI and if data exists and not in silent mode
	}

	const {
		modelUsed,
		providerName,
		inputTokens,
		outputTokens,
		totalTokens,
		totalCost,
		commandName
	} = telemetryData;

	let summary = chalk.bold.blue('AI Usage Summary:') + '\n';
	summary += chalk.gray(`  Command: ${commandName}\n`);
	summary += chalk.gray(`  Provider: ${providerName}\n`);
	summary += chalk.gray(`  Model: ${modelUsed}\n`);
	summary += chalk.gray(
		`  Tokens: ${totalTokens} (Input: ${inputTokens}, Output: ${outputTokens})\n`
	);
	summary += chalk.gray(`  Est. Cost: $${totalCost.toFixed(6)}`);

	console.log(
		boxen(summary, {
			padding: 1,
			margin: { top: 1 },
			borderColor: 'blue',
			borderStyle: 'round',
			title: '💡 Telemetry',
			titleAlignment: 'center'
		})
	);
}

/**
 * Display multiple tasks in a compact summary format with interactive drill-down
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {Array<string>} taskIds - Array of task IDs to display
 * @param {string} complexityReportPath - Path to complexity report
 * @param {string} statusFilter - Optional status filter for subtasks
 * @param {Object} context - Optional context object containing projectRoot and tag
 */
async function displayMultipleTasksSummary(
	tasksPath,
	taskIds,
	complexityReportPath = null,
	statusFilter = null,
	context = {}
) {
	displayBanner();

	// Extract projectRoot and tag from context
	const projectRoot = context.projectRoot || null;
	const tag = context.tag || null;

	// Read the tasks file with proper projectRoot for tag resolution
	const data = readJSON(tasksPath, projectRoot, tag);
	if (!data || !data.tasks) {
		log('error', 'No valid tasks found.');
		process.exit(1);
	}

	// Read complexity report once
	const complexityReport = readComplexityReport(complexityReportPath);

	// Find all requested tasks
	const foundTasks = [];
	const notFoundIds = [];

	taskIds.forEach((id) => {
		const { task } = findTaskById(
			data.tasks,
			id,
			complexityReport,
			statusFilter
		);
		if (task) {
			foundTasks.push(task);
		} else {
			notFoundIds.push(id);
		}
	});

	// Show not found tasks
	if (notFoundIds.length > 0) {
		console.log(
			boxen(chalk.yellow(`Tasks not found: ${notFoundIds.join(', ')}`), {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: 'yellow',
				borderStyle: 'round',
				margin: { top: 1, bottom: 1 }
			})
		);
	}

	if (foundTasks.length === 0) {
		console.log(
			boxen(chalk.red('No valid tasks found to display'), {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: 'red',
				borderStyle: 'round',
				margin: { top: 1 }
			})
		);
		return;
	}

	// Display header
	console.log(
		boxen(
			chalk.white.bold(
				`Task Summary (${foundTasks.length} task${foundTasks.length === 1 ? '' : 's'})`
			),
			{
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: 'blue',
				borderStyle: 'round',
				margin: { top: 1, bottom: 0 }
			}
		)
	);

	// Calculate terminal width for responsive layout
	const terminalWidth = process.stdout.columns || 100;
	const availableWidth = terminalWidth - 10;

	// Create compact summary table
	const summaryTable = new Table({
		head: [
			chalk.cyan.bold('ID'),
			chalk.cyan.bold('Title'),
			chalk.cyan.bold('Status'),
			chalk.cyan.bold('Priority'),
			chalk.cyan.bold('Subtasks'),
			chalk.cyan.bold('Progress')
		],
		colWidths: [
			Math.floor(availableWidth * 0.08), // ID: 8%
			Math.floor(availableWidth * 0.35), // Title: 35%
			Math.floor(availableWidth * 0.12), // Status: 12%
			Math.floor(availableWidth * 0.1), // Priority: 10%
			Math.floor(availableWidth * 0.15), // Subtasks: 15%
			Math.floor(availableWidth * 0.2) // Progress: 20%
		],
		style: {
			head: [],
			border: [],
			'padding-top': 0,
			'padding-bottom': 0,
			compact: true
		},
		chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
		wordWrap: true
	});

	// Add each task to the summary table
	foundTasks.forEach((task) => {
		// Handle subtask case
		if (task.isSubtask || task.parentTask) {
			const parentId = task.parentTask ? task.parentTask.id : 'Unknown';
			summaryTable.push([
				`${parentId}.${task.id}`,
				truncate(task.title, Math.floor(availableWidth * 0.35) - 3),
				getStatusWithColor(task.status || 'pending', true),
				chalk.gray('(subtask)'),
				chalk.gray('N/A'),
				chalk.gray('N/A')
			]);
			return;
		}

		// Handle regular task
		const priorityColors = {
			high: chalk.red.bold,
			medium: chalk.yellow,
			low: chalk.gray
		};
		const priorityColor =
			priorityColors[task.priority || 'medium'] || chalk.white;

		// Calculate subtask summary
		let subtaskSummary = chalk.gray('None');
		let progressBar = chalk.gray('N/A');

		if (task.subtasks && task.subtasks.length > 0) {
			const total = task.subtasks.length;
			const completed = task.subtasks.filter(
				(st) => st.status === 'done' || st.status === 'completed'
			).length;
			const inProgress = task.subtasks.filter(
				(st) => st.status === 'in-progress'
			).length;
			const pending = task.subtasks.filter(
				(st) => st.status === 'pending'
			).length;

			// Compact subtask count with status indicators
			subtaskSummary = `${chalk.green(completed)}/${total}`;
			if (inProgress > 0)
				subtaskSummary += ` ${chalk.hex('#FFA500')(`+${inProgress}`)}`;
			if (pending > 0) subtaskSummary += ` ${chalk.yellow(`(${pending})`)}`;

			// Mini progress bar (shorter than usual)
			const completionPercentage = (completed / total) * 100;
			const barLength = 8; // Compact bar
			const statusBreakdown = {
				'in-progress': (inProgress / total) * 100,
				pending: (pending / total) * 100
			};
			progressBar = createProgressBar(
				completionPercentage,
				barLength,
				statusBreakdown
			);
		}

		summaryTable.push([
			task.id.toString(),
			truncate(task.title, Math.floor(availableWidth * 0.35) - 3),
			getStatusWithColor(task.status || 'pending', true),
			priorityColor(task.priority || 'medium'),
			subtaskSummary,
			progressBar
		]);
	});

	console.log(summaryTable.toString());

	// Interactive drill-down prompt
	if (foundTasks.length > 1) {
		console.log(
			boxen(
				chalk.white.bold('Interactive Options:') +
					'\n' +
					chalk.cyan('• Press Enter to view available actions for all tasks') +
					'\n' +
					chalk.cyan(
						'• Type a task ID (e.g., "3" or "3.2") to view that specific task'
					) +
					'\n' +
					chalk.cyan('• Type "q" to quit'),
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'green',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);

		// Use dynamic import for readline
		const readline = await import('readline');
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

		const choice = await new Promise((resolve) => {
			rl.question(chalk.cyan('Your choice: '), resolve);
		});
		rl.close();

		if (choice.toLowerCase() === 'q') {
			return;
		} else if (choice.trim() === '') {
			// Show action menu for selected tasks
			console.log(
				boxen(
					chalk.white.bold('Available Actions for Selected Tasks:') +
						'\n' +
						chalk.cyan('1.') +
						' Mark all as in-progress' +
						'\n' +
						chalk.cyan('2.') +
						' Mark all as done' +
						'\n' +
						chalk.cyan('3.') +
						' Show next available task' +
						'\n' +
						chalk.cyan('4.') +
						' Expand all tasks (generate subtasks)' +
						'\n' +
						chalk.cyan('5.') +
						' View dependency relationships' +
						'\n' +
						chalk.cyan('6.') +
						' Generate task files' +
						'\n' +
						chalk.gray('Or type a task ID to view details'),
					{
						padding: { top: 0, bottom: 0, left: 1, right: 1 },
						borderColor: 'blue',
						borderStyle: 'round',
						margin: { top: 1 }
					}
				)
			);

			const rl2 = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});

			const actionChoice = await new Promise((resolve) => {
				rl2.question(chalk.cyan('Choose action (1-6): '), resolve);
			});
			rl2.close();

			const taskIdList = foundTasks.map((t) => t.id).join(',');

			switch (actionChoice.trim()) {
				case '1':
					console.log(
						chalk.blue(
							`\n→ Command: task-master set-status --id=${taskIdList} --status=in-progress`
						)
					);
					console.log(
						chalk.green(
							'✓ Copy and run this command to mark all tasks as in-progress'
						)
					);
					break;
				case '2':
					console.log(
						chalk.blue(
							`\n→ Command: task-master set-status --id=${taskIdList} --status=done`
						)
					);
					console.log(
						chalk.green('✓ Copy and run this command to mark all tasks as done')
					);
					break;
				case '3':
					console.log(chalk.blue(`\n→ Command: task-master next`));
					console.log(
						chalk.green(
							'✓ Copy and run this command to see the next available task'
						)
					);
					break;
				case '4':
					console.log(
						chalk.blue(
							`\n→ Command: task-master expand --id=${taskIdList} --research`
						)
					);
					console.log(
						chalk.green(
							'✓ Copy and run this command to expand all selected tasks into subtasks'
						)
					);
					break;
				case '5': {
					// Show dependency visualization
					console.log(chalk.white.bold('\nDependency Relationships:'));
					let hasDependencies = false;
					foundTasks.forEach((task) => {
						if (task.dependencies && task.dependencies.length > 0) {
							console.log(
								chalk.cyan(
									`Task ${task.id} depends on: ${task.dependencies.join(', ')}`
								)
							);
							hasDependencies = true;
						}
					});
					if (!hasDependencies) {
						console.log(chalk.gray('No dependencies found for selected tasks'));
					}
					break;
				}
				case '6':
					console.log(chalk.blue(`\n→ Command: task-master generate`));
					console.log(
						chalk.green('✓ Copy and run this command to generate task files')
					);
					break;
				default:
					if (actionChoice.trim().length > 0) {
						console.log(chalk.yellow(`Invalid choice: ${actionChoice.trim()}`));
						console.log(chalk.gray('Please choose 1-6 or type a task ID'));
					}
			}
		} else {
			// Show specific task
			await displayTaskById(
				tasksPath,
				choice.trim(),
				complexityReportPath,
				statusFilter,
				tag,
				context
			);
		}
	} else {
		// Single task - show suggested actions
		const task = foundTasks[0];
		console.log(
			boxen(
				chalk.white.bold('Suggested Actions:') +
					'\n' +
					`${chalk.cyan('1.')} View full details: ${chalk.yellow(`task-master show ${task.id}`)}\n` +
					`${chalk.cyan('2.')} Mark as in-progress: ${chalk.yellow(`task-master set-status --id=${task.id} --status=in-progress`)}\n` +
					`${chalk.cyan('3.')} Mark as done: ${chalk.yellow(`task-master set-status --id=${task.id} --status=done`)}`,
				{
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'green',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);
	}
}

/**
 * Display context analysis results with beautiful formatting
 * @param {Object} analysisData - Analysis data from ContextGatherer
 * @param {string} semanticQuery - The original query used for semantic search
 * @param {number} contextSize - Size of gathered context in characters
 */
function displayContextAnalysis(analysisData, semanticQuery, contextSize) {
	if (isSilentMode() || !analysisData) return;

	const { highRelevance, mediumRelevance, recentTasks, allRelevantTasks } =
		analysisData;

	// Create the context analysis display
	let analysisContent = chalk.white.bold('Context Analysis') + '\n\n';

	// Query info
	analysisContent +=
		chalk.gray('Query: ') + chalk.white(`"${semanticQuery}"`) + '\n';
	analysisContent +=
		chalk.gray('Context size: ') +
		chalk.cyan(`${contextSize.toLocaleString()} characters`) +
		'\n';
	analysisContent +=
		chalk.gray('Tasks found: ') +
		chalk.yellow(`${allRelevantTasks.length} relevant tasks`) +
		'\n\n';

	// High relevance matches
	if (highRelevance.length > 0) {
		analysisContent += chalk.green.bold('🎯 High Relevance Matches:') + '\n';
		highRelevance.slice(0, 3).forEach((task) => {
			analysisContent +=
				chalk.green(`  • Task ${task.id}: ${truncate(task.title, 50)}`) + '\n';
		});
		if (highRelevance.length > 3) {
			analysisContent +=
				chalk.green(
					`  • ... and ${highRelevance.length - 3} more high relevance tasks`
				) + '\n';
		}
		analysisContent += '\n';
	}

	// Medium relevance matches
	if (mediumRelevance.length > 0) {
		analysisContent += chalk.yellow.bold('📋 Medium Relevance Matches:') + '\n';
		mediumRelevance.slice(0, 3).forEach((task) => {
			analysisContent +=
				chalk.yellow(`  • Task ${task.id}: ${truncate(task.title, 50)}`) + '\n';
		});
		if (mediumRelevance.length > 3) {
			analysisContent +=
				chalk.yellow(
					`  • ... and ${mediumRelevance.length - 3} more medium relevance tasks`
				) + '\n';
		}
		analysisContent += '\n';
	}

	// Recent tasks (if they contributed)
	const recentTasksNotInRelevance = recentTasks.filter(
		(task) =>
			!highRelevance.some((hr) => hr.id === task.id) &&
			!mediumRelevance.some((mr) => mr.id === task.id)
	);

	if (recentTasksNotInRelevance.length > 0) {
		analysisContent += chalk.cyan.bold('🕒 Recent Tasks (for context):') + '\n';
		recentTasksNotInRelevance.slice(0, 2).forEach((task) => {
			analysisContent +=
				chalk.cyan(`  • Task ${task.id}: ${truncate(task.title, 50)}`) + '\n';
		});
		if (recentTasksNotInRelevance.length > 2) {
			analysisContent +=
				chalk.cyan(
					`  • ... and ${recentTasksNotInRelevance.length - 2} more recent tasks`
				) + '\n';
		}
	}

	console.log(
		boxen(analysisContent, {
			padding: { top: 1, bottom: 1, left: 2, right: 2 },
			margin: { top: 1, bottom: 0 },
			borderStyle: 'round',
			borderColor: 'blue',
			title: chalk.blue('🔍 Context Gathering'),
			titleAlignment: 'center'
		})
	);
}

// Export UI functions
export {
	displayBanner,
	displayTaggedTasksFYI,
	startLoadingIndicator,
	stopLoadingIndicator,
	createProgressBar,
	getStatusWithColor,
	formatDependenciesWithStatus,
	displayHelp,
	getComplexityWithColor,
	displayNextTask,
	displayTaskById,
	displayComplexityReport,
	generateComplexityAnalysisPrompt,
	confirmTaskOverwrite,
	displayApiKeyStatus,
	displayModelConfiguration,
	displayAvailableModels,
	displayAiUsageSummary,
	displayMultipleTasksSummary,
	succeedLoadingIndicator,
	failLoadingIndicator,
	warnLoadingIndicator,
	infoLoadingIndicator,
	displayContextAnalysis,
	displayCurrentTagIndicator
};
