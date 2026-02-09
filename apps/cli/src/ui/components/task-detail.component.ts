/**
 * @fileoverview Task detail component for show command
 * Displays detailed task information in a structured format
 */

import type {
	ExistingInfrastructure,
	RelevantFile,
	ScopeBoundaries,
	StorageType,
	Subtask,
	Task,
	TaskCategory
} from '@tm/core';
import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';
import { renderContent } from '../../utils/content-renderer.js';
import {
	getComplexityWithColor,
	getPriorityWithColor,
	getStatusWithColor
} from '../../utils/ui.js';

// ============================================================================
// Constants and Helper Functions
// ============================================================================

/**
 * Icons for task categories
 */
const CATEGORY_ICONS: Record<TaskCategory, string> = {
	research: '🔍',
	design: '🎨',
	development: '🔧',
	testing: '🧪',
	documentation: '📝',
	review: '👀'
};

/**
 * Get icon for file action
 */
function getFileActionIcon(action: RelevantFile['action']): string {
	switch (action) {
		case 'create':
			return chalk.green('✚ CREATE');
		case 'modify':
			return chalk.yellow('✎ MODIFY');
		case 'reference':
			return chalk.blue('👁 REFER ');
		default:
			return chalk.gray('  FILE  ');
	}
}

/**
 * Get category display with icon
 */
function getCategoryDisplay(category: TaskCategory): string {
	const icon = CATEGORY_ICONS[category] || '📋';
	return `${icon} ${category}`;
}

// ============================================================================
// Display Functions
// ============================================================================

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

	// Render description with markdown/HTML support (handles tiptap HTML from Hamster)
	const renderedDescription = renderContent(task.description || '');

	// Format category with icon
	const categoryDisplay = task.category
		? `${getCategoryDisplay(task.category)}`
		: chalk.gray('N/A');

	// Format skills as badges
	const skillsDisplay =
		task.skills && task.skills.length > 0
			? task.skills.map((s) => chalk.magenta(`[${s}]`)).join(' ')
			: chalk.gray('N/A');

	// Build the left column (labels) and right column (values)
	const labels = [
		chalk.cyan('ID:'),
		chalk.cyan('Title:'),
		chalk.cyan('Status:'),
		chalk.cyan('Priority:'),
		chalk.cyan('Dependencies:'),
		chalk.cyan('Complexity:'),
		chalk.cyan('Category:'),
		chalk.cyan('Skills:'),
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
		categoryDisplay,
		skillsDisplay,
		renderedDescription
	].join('\n');

	table.push([labels, values]);

	console.log(table.toString());
}

/**
 * Display implementation details in a box
 */
export function displayImplementationDetails(details: string): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;
	const formattedDetails = renderContent(details);

	console.log(
		boxen(
			chalk.white.bold('Implementation Details:') + '\n\n' + formattedDetails,
			{
				padding: 1,
				borderStyle: 'round',
				borderColor: 'cyan',
				width: terminalWidth
			}
		)
	);
}

/**
 * Display test strategy in a box
 */
export function displayTestStrategy(testStrategy: string): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;
	const formattedStrategy = renderContent(testStrategy);

	console.log(
		boxen(chalk.white.bold('Test Strategy:') + '\n\n' + formattedStrategy, {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'cyan',
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
	}>,
	parentTaskId?: string | number,
	storageType?: Exclude<StorageType, 'auto'>
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
		// Format subtask ID based on storage type:
		// - File storage: Show parent prefix (e.g., 10.1, 10.2)
		// - API storage: Show subtask ID only (e.g., 1, 2)
		const subtaskId =
			storageType === 'file' && parentTaskId
				? `${parentTaskId}.${subtask.id}`
				: String(subtask.id);

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

// ============================================================================
// AI Implementation Metadata Display Functions
// ============================================================================

/**
 * Display relevant files in a structured format
 */
export function displayRelevantFiles(files: RelevantFile[]): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;

	const content = files
		.map((file) => {
			const actionIcon = getFileActionIcon(file.action);
			const path = chalk.white(file.path);
			const desc = chalk.gray(file.description);
			return `${actionIcon}  ${path}\n         ${desc}`;
		})
		.join('\n\n');

	console.log(
		boxen(chalk.white.bold('📂 Files to Touch:') + '\n\n' + content, {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'yellow',
			width: terminalWidth
		})
	);
}

/**
 * Display existing infrastructure to leverage
 */
export function displayExistingInfrastructure(
	infrastructure: ExistingInfrastructure[]
): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;

	const content = infrastructure
		.map((infra) => {
			const name = chalk.cyan.bold(infra.name);
			const location = chalk.gray(infra.location);
			const usage = chalk.white(infra.usage);
			return `${name} → ${location}\n  ↳ ${usage}`;
		})
		.join('\n\n');

	console.log(
		boxen(chalk.white.bold('🔗 Leverage Existing Code:') + '\n\n' + content, {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'blue',
			width: terminalWidth
		})
	);
}

/**
 * Display scope boundaries (what's in/out of scope)
 */
export function displayScopeBoundaries(boundaries: ScopeBoundaries): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;

	let content = '';

	if (boundaries.included) {
		content += chalk.green.bold('✅ In Scope:\n');
		content += chalk.white('   ' + boundaries.included);
	}

	if (boundaries.excluded) {
		if (content) content += '\n\n';
		content += chalk.red.bold('⛔ Out of Scope:\n');
		content += chalk.gray('   ' + boundaries.excluded);
	}

	console.log(
		boxen(chalk.white.bold('🎯 Scope Boundaries:') + '\n\n' + content, {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'magenta',
			width: terminalWidth
		})
	);
}

/**
 * Display acceptance criteria as a checklist
 */
export function displayAcceptanceCriteria(criteria: string[]): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;

	const content = criteria.map((c) => chalk.white(`☐ ${c}`)).join('\n');

	console.log(
		boxen(chalk.white.bold('✓ Acceptance Criteria:') + '\n\n' + content, {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'green',
			width: terminalWidth
		})
	);
}

/**
 * Display technical constraints
 */
export function displayTechnicalConstraints(constraints: string[]): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;

	const content = constraints.map((c) => chalk.yellow(`▸ ${c}`)).join('\n');

	console.log(
		boxen(chalk.white.bold('🔒 Technical Constraints:') + '\n\n' + content, {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'red',
			width: terminalWidth
		})
	);
}

/**
 * Display implementation approach (step-by-step guide)
 */
export function displayImplementationApproach(approach: string): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;
	const formattedApproach = renderContent(approach);

	console.log(
		boxen(
			chalk.white.bold('📋 Implementation Approach:') +
				'\n\n' +
				formattedApproach,
			{
				padding: 1,
				borderStyle: 'round',
				borderColor: 'cyan',
				width: terminalWidth
			}
		)
	);
}

/**
 * Display codebase patterns to follow
 */
export function displayCodebasePatterns(patterns: string[]): void {
	const terminalWidth = process.stdout.columns * 0.95 || 100;

	const content = patterns.map((p) => chalk.white(`• ${p}`)).join('\n');

	console.log(
		boxen(chalk.white.bold('📐 Codebase Patterns:') + '\n\n' + content, {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'gray',
			width: terminalWidth
		})
	);
}

/**
 * Display skills and category as inline badges
 */
export function displaySkillsAndCategory(
	category?: TaskCategory,
	skills?: string[]
): void {
	let output = '';

	if (category) {
		output +=
			chalk.gray('Category: ') +
			chalk.cyan(`[${getCategoryDisplay(category)}]`);
	}

	if (skills && skills.length > 0) {
		if (output) output += '  ';
		output +=
			chalk.gray('Skills: ') +
			skills.map((s) => chalk.magenta(`[${s}]`)).join(' ');
	}

	if (output) {
		console.log('\n' + output);
	}
}

/**
 * Display all implementation metadata for a task
 * Shows all AI-generated guidance when available
 * Note: Category and skills are displayed in the main properties table
 */
export function displayImplementationMetadata(task: Task | Subtask): void {
	const hasMetadata =
		task.relevantFiles ||
		task.existingInfrastructure ||
		task.scopeBoundaries ||
		task.acceptanceCriteria ||
		task.technicalConstraints ||
		task.implementationApproach ||
		task.codebasePatterns;

	if (!hasMetadata) {
		return;
	}

	// Display implementation approach
	if (task.implementationApproach) {
		console.log();
		displayImplementationApproach(task.implementationApproach);
	}

	// Display relevant files
	if (task.relevantFiles && task.relevantFiles.length > 0) {
		console.log();
		displayRelevantFiles(task.relevantFiles);
	}

	// Display existing infrastructure
	if (task.existingInfrastructure && task.existingInfrastructure.length > 0) {
		console.log();
		displayExistingInfrastructure(task.existingInfrastructure);
	}

	// Display codebase patterns
	if (task.codebasePatterns && task.codebasePatterns.length > 0) {
		console.log();
		displayCodebasePatterns(task.codebasePatterns);
	}

	// Display scope boundaries
	if (task.scopeBoundaries) {
		console.log();
		displayScopeBoundaries(task.scopeBoundaries);
	}

	// Display technical constraints
	if (task.technicalConstraints && task.technicalConstraints.length > 0) {
		console.log();
		displayTechnicalConstraints(task.technicalConstraints);
	}

	// Display acceptance criteria
	if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
		console.log();
		displayAcceptanceCriteria(task.acceptanceCriteria);
	}
}

// ============================================================================
// Suggested Actions
// ============================================================================

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
		storageType?: Exclude<StorageType, 'auto'>;
	}
): void {
	const {
		statusFilter,
		showSuggestedActions = false,
		customHeader,
		headerColor = 'blue',
		originalTaskId,
		storageType
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

	// Display AI implementation metadata (relevantFiles, codebasePatterns, etc.)
	displayImplementationMetadata(task);

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
			displaySubtasks(filteredSubtasks, task.id, storageType);
		}
	}

	// Display suggested actions if requested
	if (showSuggestedActions) {
		console.log(); // Empty line for spacing
		const actionTaskId = originalTaskId || task.id;
		displaySuggestedActions(actionTaskId);
	}
}
