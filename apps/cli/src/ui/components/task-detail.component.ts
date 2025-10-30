/**
 * @fileoverview Task detail component for show command
 * Displays detailed task information in a structured format
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { marked, MarkedExtension } from 'marked';
import { markedTerminal } from 'marked-terminal';
import type { Subtask, Task } from '@tm/core';
import {
	getStatusWithColor,
	getPriorityWithColor,
	getComplexityWithColor
} from '../../utils/ui.js';

// Configure marked to use terminal renderer with subtle colors
marked.use(
	markedTerminal({
		// More subtle colors that match the overall design
		code: (code: string) => {
			// Custom code block handler to preserve formatting
			return code
				.split('\n')
				.map((line) => '    ' + chalk.cyan(line))
				.join('\n');
		},
		blockquote: chalk.gray.italic,
		html: chalk.gray,
		heading: chalk.white.bold, // White bold for headings
		hr: chalk.gray,
		listitem: chalk.white, // White for list items
		paragraph: chalk.white, // White for paragraphs (default text color)
		strong: chalk.white.bold, // White bold for strong text
		em: chalk.white.italic, // White italic for emphasis
		codespan: chalk.cyan, // Cyan for inline code (no background)
		del: chalk.dim.strikethrough,
		link: chalk.blue,
		href: chalk.blue.underline,
		// Add more explicit code block handling
		showSectionPrefix: false,
		unescape: true,
		emoji: false,
		// Try to preserve whitespace in code blocks
		tab: 4,
		width: 120
	}) as MarkedExtension
);

// Also set marked options to preserve whitespace
marked.setOptions({
	breaks: true,
	gfm: true
});

/**
 * Display the task header with tag
 */
export function displayTaskHeader(
	taskId: string | number,
	title: string
): void {
	// Display task header box
	console.log(
		boxen(chalk.white.bold(`Task: #${taskId} - ${title}`), {
			padding: { top: 0, bottom: 0, left: 1, right: 1 },
			borderColor: 'blue',
			borderStyle: 'round'
		})
	);
}

/**
 * Display task properties in a table format
 */
export function displayTaskProperties(
	task: Task | Subtask,
	originalTaskId?: string
): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;
	// Create table for task properties - simple 2-column layout
	const table = new Table({
		head: [],
		style: {
			head: [],
			border: ['grey']
		},
		colWidths: [
			Math.floor(terminalWidth * 0.2),
			Math.floor(terminalWidth * 0.8)
		],
		wordWrap: true
	});

	const deps =
		task.dependencies && task.dependencies.length > 0
			? task.dependencies.map((d) => String(d)).join(', ')
			: 'None';

	// Use originalTaskId if provided (for subtasks like "104.1")
	const displayId = originalTaskId || String(task.id);

	// Build the left column (labels) and right column (values)
	const labels = [
		chalk.cyan('ID:'),
		chalk.cyan('Title:'),
		chalk.cyan('Status:'),
		chalk.cyan('Priority:'),
		chalk.cyan('Dependencies:'),
		chalk.cyan('Complexity:'),
		chalk.cyan('Description:')
	].join('\n');

	const values = [
		displayId,
		task.title,
		getStatusWithColor(task.status),
		getPriorityWithColor(task.priority),
		deps,
		typeof task.complexity === 'number'
			? getComplexityWithColor(task.complexity)
			: chalk.gray('N/A'),
		task.description || ''
	].join('\n');

	table.push([labels, values]);

	console.log(table.toString());
}

/**
 * Display implementation details in a box
 */
export function displayImplementationDetails(details: string): void {
	// Handle all escaped characters properly
	const cleanDetails = details
		.replace(/\\n/g, '\n') // Convert \n to actual newlines
		.replace(/\\t/g, '\t') // Convert \t to actual tabs
		.replace(/\\"/g, '"') // Convert \" to actual quotes
		.replace(/\\\\/g, '\\'); // Convert \\ to single backslash

	const terminalWidth = process.stdout.columns * 0.95 || 100;

	// Parse markdown to terminal-friendly format
	const markdownResult = marked(cleanDetails);
	const formattedDetails =
		typeof markdownResult === 'string' ? markdownResult.trim() : cleanDetails; // Fallback to original if Promise

	console.log(
		boxen(
			chalk.white.bold('Implementation Details:') + '\n\n' + formattedDetails,
			{
				padding: 1,
				borderStyle: 'round',
				borderColor: 'cyan', // Changed to cyan to match the original
				width: terminalWidth // Fixed width to match the original
			}
		)
	);
}

/**
 * Display test strategy in a box
 */
export function displayTestStrategy(testStrategy: string): void {
	// Handle all escaped characters properly (same as implementation details)
	const cleanStrategy = testStrategy
		.replace(/\\n/g, '\n') // Convert \n to actual newlines
		.replace(/\\t/g, '\t') // Convert \t to actual tabs
		.replace(/\\"/g, '"') // Convert \" to actual quotes
		.replace(/\\\\/g, '\\'); // Convert \\ to single backslash

	const terminalWidth = process.stdout.columns * 0.95 || 100;

	// Parse markdown to terminal-friendly format (same as implementation details)
	const markdownResult = marked(cleanStrategy);
	const formattedStrategy =
		typeof markdownResult === 'string' ? markdownResult.trim() : cleanStrategy; // Fallback to original if Promise

	console.log(
		boxen(chalk.white.bold('Test Strategy:') + '\n\n' + formattedStrategy, {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'cyan', // Changed to cyan to match implementation details
			width: terminalWidth
		})
	);
}

/**
 * Display subtasks in a table format
 */
export function displaySubtasks(
	subtasks: Array<{
		id: string | number;
		title: string;
		status: any;
		description?: string;
		dependencies?: string[];
	}>
): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;
	// Display subtasks header
	console.log(
		boxen(chalk.magenta.bold('Subtasks'), {
			padding: { top: 0, bottom: 0, left: 1, right: 1 },
			borderColor: 'magenta',
			borderStyle: 'round',
			margin: { top: 1, bottom: 0 }
		})
	);

	// Create subtasks table
	const table = new Table({
		head: [
			chalk.magenta.bold('ID'),
			chalk.magenta.bold('Status'),
			chalk.magenta.bold('Title'),
			chalk.magenta.bold('Deps')
		],
		style: {
			head: [],
			border: ['grey']
		},
		colWidths: [
			Math.floor(terminalWidth * 0.1),
			Math.floor(terminalWidth * 0.15),
			Math.floor(terminalWidth * 0.6),
			Math.floor(terminalWidth * 0.15)
		],
		wordWrap: true
	});

	subtasks.forEach((subtask) => {
		const subtaskId = String(subtask.id);

		// Format dependencies
		const deps =
			subtask.dependencies && subtask.dependencies.length > 0
				? subtask.dependencies.join(', ')
				: 'None';

		table.push([
			subtaskId,
			getStatusWithColor(subtask.status),
			subtask.title,
			deps
		]);
	});

	console.log(table.toString());
}

/**
 * Display suggested actions
 */
export function displaySuggestedActions(taskId: string | number): void {
	console.log(
		boxen(
			chalk.white.bold('Suggested Actions:') +
				'\n\n' +
				`${chalk.cyan('1.')} Run ${chalk.yellow(`task-master set-status --id=${taskId} --status=in-progress`)} to start working\n` +
				`${chalk.cyan('2.')} Run ${chalk.yellow(`task-master expand --id=${taskId}`)} to break down into subtasks\n` +
				`${chalk.cyan('3.')} Run ${chalk.yellow(`task-master update-task --id=${taskId} --prompt="..."`)} to update details`,
			{
				padding: 1,
				margin: { top: 1 },
				borderStyle: 'round',
				borderColor: 'green',
				width: process.stdout.columns * 0.95 || 100
			}
		)
	);
}

/**
 * Display complete task details - used by both show and start commands
 */
export function displayTaskDetails(
	task: Task | Subtask,
	options?: {
		statusFilter?: string;
		showSuggestedActions?: boolean;
		customHeader?: string;
		headerColor?: string;
		originalTaskId?: string;
	}
): void {
	const {
		statusFilter,
		showSuggestedActions = false,
		customHeader,
		headerColor = 'blue',
		originalTaskId
	} = options || {};

	// Display header - either custom or default
	if (customHeader) {
		console.log(
			boxen(chalk.white.bold(customHeader), {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: headerColor,
				borderStyle: 'round',
				margin: { top: 1 }
			})
		);
	} else {
		// Use originalTaskId if provided (for subtasks like "104.1")
		const displayId = originalTaskId || task.id;
		displayTaskHeader(displayId, task.title);
	}

	// Display task properties in table format
	displayTaskProperties(task, originalTaskId);

	// Display implementation details if available
	if (task.details) {
		console.log(); // Empty line for spacing
		displayImplementationDetails(task.details);
	}

	// Display test strategy if available
	if ('testStrategy' in task && task.testStrategy) {
		console.log(); // Empty line for spacing
		displayTestStrategy(task.testStrategy as string);
	}

	// Display subtasks if available
	if (task.subtasks && task.subtasks.length > 0) {
		// Filter subtasks by status if provided
		const filteredSubtasks = statusFilter
			? task.subtasks.filter((sub) => sub.status === statusFilter)
			: task.subtasks;

		if (filteredSubtasks.length === 0 && statusFilter) {
			console.log(); // Empty line for spacing
			console.log(chalk.gray(`  No subtasks with status '${statusFilter}'`));
		} else if (filteredSubtasks.length > 0) {
			console.log(); // Empty line for spacing
			displaySubtasks(filteredSubtasks);
		}
	}

	// Display suggested actions if requested
	if (showSuggestedActions) {
		console.log(); // Empty line for spacing
		const actionTaskId = originalTaskId || task.id;
		displaySuggestedActions(actionTaskId);
	}
}
