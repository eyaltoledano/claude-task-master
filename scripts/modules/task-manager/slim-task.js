import { log } from '../utils.js';

/**
 * Maximum length for truncated description on slimmed tasks.
 * @type {number}
 */
const DESCRIPTION_TRUNCATE_LENGTH = 200;

/**
 * Slim a completed task by removing verbose fields that are no longer actionable.
 * Removes `details` and `testStrategy`, truncates `description` to 200 chars + ellipsis.
 * This is a one-way operation — git history preserves the original content.
 *
 * @param {Object} task - The task object to slim
 * @returns {Object} The same task object, mutated in place
 */
function slimTask(task) {
	if (!task) return task;

	// Clear verbose fields
	if (task.details) {
		task.details = '';
	}

	if (task.testStrategy) {
		task.testStrategy = '';
	}

	// Truncate description to max length
	if (
		task.description &&
		task.description.length > DESCRIPTION_TRUNCATE_LENGTH
	) {
		task.description =
			task.description.substring(0, DESCRIPTION_TRUNCATE_LENGTH) + '...';
	}

	return task;
}

/**
 * Slim a completed subtask by removing verbose fields.
 * Subtasks typically have fewer fields, but we still clear details/testStrategy
 * and truncate description.
 *
 * @param {Object} subtask - The subtask object to slim
 * @returns {Object} The same subtask object, mutated in place
 */
function slimSubtask(subtask) {
	if (!subtask) return subtask;

	if (subtask.details) {
		subtask.details = '';
	}

	if (subtask.testStrategy) {
		subtask.testStrategy = '';
	}

	if (
		subtask.description &&
		subtask.description.length > DESCRIPTION_TRUNCATE_LENGTH
	) {
		subtask.description =
			subtask.description.substring(0, DESCRIPTION_TRUNCATE_LENGTH) + '...';
	}

	return subtask;
}

/**
 * Slim a task and all its subtasks when the task transitions to "done".
 * Only slims if the transition is TO a done/completed status.
 *
 * @param {Object} task - The task object
 * @param {string} oldStatus - The previous status
 * @param {string} newStatus - The new status being set
 * @returns {Object} The task, slimmed if transitioning to done
 */
function slimTaskOnComplete(task, oldStatus, newStatus) {
	const isDoneStatus =
		newStatus.toLowerCase() === 'done' ||
		newStatus.toLowerCase() === 'completed';
	const wasDone =
		oldStatus.toLowerCase() === 'done' ||
		oldStatus.toLowerCase() === 'completed';

	// Only slim on transition TO done, not if already done
	if (!isDoneStatus || wasDone) {
		return task;
	}

	log('info', `Slimming completed task ${task.id}: "${task.title}"`);

	slimTask(task);

	// Also slim all subtasks
	if (task.subtasks && task.subtasks.length > 0) {
		for (const subtask of task.subtasks) {
			slimSubtask(subtask);
		}
	}

	return task;
}

/**
 * Slim a subtask when it transitions to "done".
 *
 * @param {Object} subtask - The subtask object
 * @param {string} oldStatus - The previous status
 * @param {string} newStatus - The new status being set
 * @returns {Object} The subtask, slimmed if transitioning to done
 */
function slimSubtaskOnComplete(subtask, oldStatus, newStatus) {
	const isDoneStatus =
		newStatus.toLowerCase() === 'done' ||
		newStatus.toLowerCase() === 'completed';
	const wasDone =
		oldStatus.toLowerCase() === 'done' ||
		oldStatus.toLowerCase() === 'completed';

	if (!isDoneStatus || wasDone) {
		return subtask;
	}

	log('info', `Slimming completed subtask ${subtask.id}: "${subtask.title}"`);

	return slimSubtask(subtask);
}

export {
	DESCRIPTION_TRUNCATE_LENGTH,
	slimTask,
	slimSubtask,
	slimTaskOnComplete,
	slimSubtaskOnComplete
};
