import chalk from 'chalk';

import {
	TASK_STATUS_OPTIONS,
	isValidTaskStatus
} from '../../../src/constants/task-status.js';
import { log } from '../utils.js';
import { slimSubtaskOnComplete, slimTaskOnComplete } from './slim-task.js';

/**
 * Update the status of a single task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIdInput - Task ID to update
 * @param {string} newStatus - New status
 * @param {Object} data - Tasks data
 * @param {boolean} showUi - Whether to show UI elements
 * @param {Object} [statusOptions] - Additional options
 * @param {boolean} [statusOptions.slimOnDone=false] - Whether to slim tasks when marking as done
 */
async function updateSingleTaskStatus(
	tasksPath,
	taskIdInput,
	newStatus,
	data,
	showUi = true,
	statusOptions = {}
) {
	const { slimOnDone = false } = statusOptions || {};
	if (!isValidTaskStatus(newStatus)) {
		throw new Error(
			`Error: Invalid status value: ${newStatus}. Use one of: ${TASK_STATUS_OPTIONS.join(', ')}`
		);
	}

	// Check if it's a subtask (e.g., "1.2")
	if (taskIdInput.includes('.')) {
		const [parentId, subtaskId] = taskIdInput
			.split('.')
			.map((id) => parseInt(id, 10));

		// Find the parent task
		const parentTask = data.tasks.find((t) => t.id === parentId);
		if (!parentTask) {
			throw new Error(`Parent task ${parentId} not found`);
		}

		// Find the subtask
		if (!parentTask.subtasks) {
			throw new Error(`Parent task ${parentId} has no subtasks`);
		}

		const subtask = parentTask.subtasks.find((st) => st.id === subtaskId);
		if (!subtask) {
			throw new Error(
				`Subtask ${subtaskId} not found in parent task ${parentId}`
			);
		}

		// Update the subtask status
		const oldStatus = subtask.status || 'pending';
		subtask.status = newStatus;

		// Slim subtask if transitioning to done and slimming is enabled
		if (slimOnDone) {
			slimSubtaskOnComplete(subtask, oldStatus, newStatus);
		}

		log(
			'info',
			`Updated subtask ${parentId}.${subtaskId} status from '${oldStatus}' to '${newStatus}'`
		);

		// Check if all subtasks are done (if setting to 'done')
		if (
			newStatus.toLowerCase() === 'done' ||
			newStatus.toLowerCase() === 'completed'
		) {
			const allSubtasksDone = parentTask.subtasks.every(
				(st) => st.status === 'done' || st.status === 'completed'
			);

			// Suggest updating parent task if all subtasks are done
			if (
				allSubtasksDone &&
				parentTask.status !== 'done' &&
				parentTask.status !== 'completed'
			) {
				// Only show suggestion in CLI mode
				if (showUi) {
					console.log(
						chalk.yellow(
							`All subtasks of parent task ${parentId} are now marked as done.`
						)
					);
					console.log(
						chalk.yellow(
							`Consider updating the parent task status with: task-master set-status --id=${parentId} --status=done`
						)
					);
				}
			}
		}
	} else {
		// Handle regular task
		const taskId = parseInt(taskIdInput, 10);
		const task = data.tasks.find((t) => t.id === taskId);

		if (!task) {
			throw new Error(`Task ${taskId} not found`);
		}

		// Update the task status
		const oldStatus = task.status || 'pending';
		task.status = newStatus;

		log(
			'info',
			`Updated task ${taskId} status from '${oldStatus}' to '${newStatus}'`
		);

		// If marking as done, also mark all subtasks as done
		if (
			(newStatus.toLowerCase() === 'done' ||
				newStatus.toLowerCase() === 'completed') &&
			task.subtasks &&
			task.subtasks.length > 0
		) {
			const pendingSubtasks = task.subtasks.filter(
				(st) => st.status !== 'done' && st.status !== 'completed'
			);

			if (pendingSubtasks.length > 0) {
				log(
					'info',
					`Also marking ${pendingSubtasks.length} subtasks as '${newStatus}'`
				);

				pendingSubtasks.forEach((subtask) => {
					subtask.status = newStatus;
				});
			}
		}

		// Slim task (and its subtasks) if transitioning to done and slimming is enabled
		if (slimOnDone) {
			slimTaskOnComplete(task, oldStatus, newStatus);
		}
	}
}

export default updateSingleTaskStatus;
