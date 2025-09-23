/**
 * Direct function wrapper for cross-tag task moves
 */

import { moveTasksBetweenTags } from '../../../../scripts/modules/task-manager/move-task.js';
import { findTasksPath } from '../utils/path-utils.js';

import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Move tasks between tags
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file
 * @param {string} args.sourceIds - Comma-separated IDs of tasks to move
 * @param {string} args.sourceTag - Source tag name
 * @param {string} args.targetTag - Target tag name
 * @param {boolean} args.withDependencies - Move dependent tasks along with main task
 * @param {boolean} args.ignoreDependencies - Break cross-tag dependencies during move
 * @param {string} args.file - Alternative path to the tasks.json file
 * @param {string} args.projectRoot - Project root directory
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: Object}>}
 */
export async function moveTaskCrossTagDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot } = args;

	log.info(`moveTaskCrossTagDirect called with args: ${JSON.stringify(args)}`);

	// Validate required parameters
	if (!args.sourceIds) {
		return {
			success: false,
			error: {
				message: 'Source IDs are required',
				code: 'MISSING_SOURCE_IDS'
			}
		};
	}

	if (!args.sourceTag) {
		return {
			success: false,
			error: {
				message: 'Source tag is required for cross-tag moves',
				code: 'MISSING_SOURCE_TAG'
			}
		};
	}

	if (!args.targetTag) {
		return {
			success: false,
			error: {
				message: 'Target tag is required for cross-tag moves',
				code: 'MISSING_TARGET_TAG'
			}
		};
	}

	// Validate that source and target tags are different
	if (args.sourceTag === args.targetTag) {
		return {
			success: false,
			error: {
				message: `Source and target tags are the same ("${args.sourceTag}")`,
				code: 'SAME_SOURCE_TARGET_TAG',
				suggestions: [
					'Use different tags for cross-tag moves',
					'Use within-tag move: task-master move --from=<id> --to=<id> --tag=<tag>',
					'Check available tags: task-master tags'
				]
			}
		};
	}

	try {
		// Find tasks.json path if not provided
		let tasksPath = args.tasksJsonPath || args.file;
		if (!tasksPath) {
			if (!args.projectRoot) {
				return {
					success: false,
					error: {
						message:
							'Project root is required if tasksJsonPath is not provided',
						code: 'MISSING_PROJECT_ROOT'
					}
				};
			}
			tasksPath = findTasksPath(args, log);
		}

		// Enable silent mode to prevent console output during MCP operation
		enableSilentMode();

		try {
			// Parse source IDs
			const sourceIds = args.sourceIds.split(',').map((id) => id.trim());

			// Prepare move options
			const moveOptions = {
				withDependencies: args.withDependencies || false,
				ignoreDependencies: args.ignoreDependencies || false
			};

			// Call the core moveTasksBetweenTags function
			const result = await moveTasksBetweenTags(
				tasksPath,
				sourceIds,
				args.sourceTag,
				args.targetTag,
				moveOptions,
				{ projectRoot }
			);

			return {
				success: true,
				data: {
					...result,
					message: `Successfully moved ${sourceIds.length} task(s) from "${args.sourceTag}" to "${args.targetTag}"`,
					moveOptions,
					sourceTag: args.sourceTag,
					targetTag: args.targetTag
				}
			};
		} finally {
			// Restore console output - always executed regardless of success or error
			disableSilentMode();
		}
	} catch (error) {
		log.error(`Failed to move tasks between tags: ${error.message}`);
		log.error(`Error code: ${error.code}, Error name: ${error.name}`);

		// Enhanced error handling with structured error objects
		let errorCode = 'MOVE_TASK_CROSS_TAG_ERROR';
		let suggestions = [];

		// Handle structured errors first
		if (error.code === 'CROSS_TAG_DEPENDENCY_CONFLICTS') {
			errorCode = 'CROSS_TAG_DEPENDENCY_CONFLICT';
			suggestions = [
				'Use --with-dependencies to move dependent tasks together',
				'Use --ignore-dependencies to break cross-tag dependencies',
				'Run task-master validate-dependencies to check for issues',
				'Move dependencies first, then move the main task'
			];
		} else if (error.code === 'CANNOT_MOVE_SUBTASK') {
			errorCode = 'SUBTASK_MOVE_RESTRICTION';
			suggestions = [
				'Promote subtask to full task first: task-master remove-subtask --id=<subtaskId> --convert',
				'Move the parent task with all subtasks using --with-dependencies'
			];
		} else if (
			error.code === 'TASK_NOT_FOUND' ||
			error.code === 'INVALID_SOURCE_TAG' ||
			error.code === 'INVALID_TARGET_TAG'
		) {
			errorCode = 'TAG_OR_TASK_NOT_FOUND';
			suggestions = [
				'Check available tags: task-master tags',
				'Verify task IDs exist: task-master list',
				'Check task details: task-master show <id>'
			];
		} else if (error.message.includes('cross-tag dependency conflicts')) {
			// Fallback for legacy error messages
			errorCode = 'CROSS_TAG_DEPENDENCY_CONFLICT';
			suggestions = [
				'Use --with-dependencies to move dependent tasks together',
				'Use --ignore-dependencies to break cross-tag dependencies',
				'Run task-master validate-dependencies to check for issues',
				'Move dependencies first, then move the main task'
			];
		} else if (error.message.includes('Cannot move subtask')) {
			// Fallback for legacy error messages
			errorCode = 'SUBTASK_MOVE_RESTRICTION';
			suggestions = [
				'Promote subtask to full task first: task-master remove-subtask --id=<subtaskId> --convert',
				'Move the parent task with all subtasks using --with-dependencies'
			];
		} else if (error.message.includes('not found')) {
			// Fallback for legacy error messages
			errorCode = 'TAG_OR_TASK_NOT_FOUND';
			suggestions = [
				'Check available tags: task-master tags',
				'Verify task IDs exist: task-master list',
				'Check task details: task-master show <id>'
			];
		} else if (
			error.code === 'TASK_ALREADY_EXISTS' ||
			error.message?.includes('already exists in target tag')
		) {
			// Target tag has an ID collision
			errorCode = 'TASK_ALREADY_EXISTS';
			suggestions = [
				'Choose a different target tag without conflicting IDs',
				'Move a different set of IDs (avoid existing ones)',
				'If needed, move within-tag to a new ID first, then cross-tag move'
			];
		}

		return {
			success: false,
			error: {
				message: error.message,
				code: errorCode,
				suggestions
			}
		};
	}
}
