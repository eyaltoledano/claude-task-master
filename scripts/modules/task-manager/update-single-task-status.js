import chalk from 'chalk';

import { log, promptYesNo } from '../utils.js';

/**
 * Update the status of a single task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIdInput - Task ID to update
 * @param {string} newStatus - New status
 * @param {Object} data - Tasks data
 * @param {boolean} showUi - Whether to show UI elements
 * @param {boolean} criteriaMet - Whether acceptance criteria have been confirmed met (for checkpoints)
 */
async function updateSingleTaskStatus(
	tasksPath,
	taskIdInput,
	newStatus,
	data,
	showUi = true,
	criteriaMet = false
) {
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

		// Checkpoint-specific logic for 'done' status
		if (
			task.type === 'checkpoint' &&
			(newStatus.toLowerCase() === 'done' || newStatus.toLowerCase() === 'completed')
		) {
			let confirmedCriteriaMet = criteriaMet;
			if (!confirmedCriteriaMet && showUi) {
				// CLI mode, criteriaMet flag not passed, so prompt user
				const question = `Have the acceptance criteria for checkpoint task '${task.title}' (ID: ${task.id}) been demonstrably met? (yes/no)`;
				// Ensure promptYesNo is awaited as it likely performs I/O.
				confirmedCriteriaMet = await promptYesNo(question);
			}

			if (!confirmedCriteriaMet) {
				const errorMessage = `Acceptance criteria for checkpoint ${task.id} ('${task.title}') must be met and confirmed before marking as done.`;
				log('warn', errorMessage);
				// This error will be caught by the calling function (setTaskStatus)
				// which will handle CLI vs MCP error reporting.
				throw new Error(errorMessage);
			}
			log('info', `Acceptance criteria for checkpoint ${task.id} confirmed as met.`);
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
	}
}

export default updateSingleTaskStatus;
