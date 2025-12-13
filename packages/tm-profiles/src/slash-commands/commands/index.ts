/**
 * @fileoverview Slash Commands Index
 * Exports all TaskMaster slash commands organized by operating mode.
 */

import type { SlashCommand } from '../types.js';

// Solo commands (local file-based storage)
import {
	parsePrd,
	parsePrdWithResearch,
	analyzeComplexity,
	complexityReport,
	expandTask,
	expandAllTasks,
	addTask,
	addSubtask,
	removeTask,
	removeSubtask,
	removeSubtasks,
	removeAllSubtasks,
	convertTaskToSubtask,
	addDependency,
	removeDependency,
	fixDependencies,
	validateDependencies,
	setupModels,
	viewModels,
	installTaskmaster,
	quickInstallTaskmaster,
	toReview,
	toDeferred,
	toCancelled,
	initProject,
	initProjectQuick
} from './solo/index.js';

// Team commands (API-based storage via Hamster)
import { goham } from './team/index.js';

// Common commands (work in both modes)
import {
	showTask,
	listTasks,
	listTasksWithSubtasks,
	listTasksByStatus,
	projectStatus,
	nextTask,
	help,
	toDone,
	toPending,
	toInProgress,
	updateTask,
	updateSingleTask,
	updateTasksFromId,
	tmMain,
	smartWorkflow,
	learn,
	commandPipeline,
	autoImplementTasks,
	analyzeProject,
	syncReadme
} from './common/index.js';

/**
 * All TaskMaster slash commands
 * Add new commands here to have them automatically distributed to all profiles.
 */
export const allCommands: SlashCommand[] = [
	// Solo commands
	parsePrd,
	parsePrdWithResearch,
	analyzeComplexity,
	complexityReport,
	expandTask,
	expandAllTasks,
	addTask,
	addSubtask,
	removeTask,
	removeSubtask,
	removeSubtasks,
	removeAllSubtasks,
	convertTaskToSubtask,
	addDependency,
	removeDependency,
	fixDependencies,
	validateDependencies,
	setupModels,
	viewModels,
	installTaskmaster,
	quickInstallTaskmaster,
	toReview,
	toDeferred,
	toCancelled,
	initProject,
	initProjectQuick,

	// Team commands
	goham,

	// Common commands
	showTask,
	listTasks,
	listTasksWithSubtasks,
	listTasksByStatus,
	projectStatus,
	nextTask,
	help,
	toDone,
	toPending,
	toInProgress,
	updateTask,
	updateSingleTask,
	updateTasksFromId,
	tmMain,
	smartWorkflow,
	learn,
	commandPipeline,
	autoImplementTasks,
	analyzeProject,
	syncReadme
];

/**
 * Filter commands by operating mode
 *
 * Both modes include common commands:
 * - Solo mode: solo + common commands
 * - Team mode: team + common commands
 *
 * @param commands - Array of slash commands to filter
 * @param mode - Operating mode ('solo' or 'team')
 * @returns Filtered array of commands for the specified mode
 */
export function filterCommandsByMode(
	commands: SlashCommand[],
	mode: 'solo' | 'team'
): SlashCommand[] {
	if (mode === 'team') {
		// Team mode: team + common commands
		return commands.filter(
			(cmd) =>
				cmd.metadata.mode === 'team' ||
				cmd.metadata.mode === 'common' ||
				!cmd.metadata.mode // backward compat: no mode = common
		);
	}
	// Solo mode: solo + common commands
	return commands.filter(
		(cmd) =>
			cmd.metadata.mode === 'solo' ||
			cmd.metadata.mode === 'common' ||
			!cmd.metadata.mode // backward compat: no mode = common
	);
}

/** Commands for solo mode (solo + common) */
export const soloCommands = filterCommandsByMode(allCommands, 'solo');

/** Commands for team mode (team + common) */
export const teamCommands = filterCommandsByMode(allCommands, 'team');

/** Commands that work in both modes */
export const commonCommands = allCommands.filter(
	(cmd) => cmd.metadata.mode === 'common' || !cmd.metadata.mode
);

// Re-export from subdirectories for direct access
export * from './solo/index.js';
export * from './team/index.js';
export * from './common/index.js';
