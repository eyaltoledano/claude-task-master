import fs from 'fs';
import path from 'path';

import { log, readJSON, writeJSON } from '../utils.js';
import generateTaskFiles from './generate-task-files.js';
import taskExists from './task-exists.js';

/**
 * Removes one or more tasks or subtasks from the tasks file
 * @param {string} tasksPath - Path to the tasks file
 * @param {string} taskIds - Comma-separated string of task/subtask IDs to remove (e.g., '5,6.1,7')
 * @returns {Object} Result object with success status, messages, and removed task info
 */
async function removeTask(tasksPath, taskIds) {
	const results = {
		success: true,
		messages: [],
		errors: [],
		removedTasks: []
	};
	const taskIdsToRemove = taskIds
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean); // Remove empty strings if any

	if (taskIdsToRemove.length === 0) {
		results.success = false;
		results.errors.push('No valid task IDs provided.');
		return results;
	}

	try {
		// Read the tasks file ONCE before the loop
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		const tasksToDeleteFiles = []; // Collect IDs of main tasks whose files should be deleted

		for (const taskId of taskIdsToRemove) {
			// Check if the task ID exists *before* attempting removal
			if (!taskExists(data.tasks, taskId)) {
				const errorMsg = `Task with ID ${taskId} not found or already removed.`;
				results.errors.push(errorMsg);
				results.success = false; // Mark overall success as false if any error occurs
				continue; // Skip to the next ID
			}

			try {
				// Handle subtask removal (e.g., '5.2')
				if (typeof taskId === 'string' && taskId.includes('.')) {
					const [parentTaskId, subtaskId] = taskId
						.split('.')
						.map((id) => parseInt(id, 10));

					// Find the parent task
					const parentTask = data.tasks.find((t) => t.id === parentTaskId);
					if (!parentTask || !parentTask.subtasks) {
						throw new Error(
							`Parent task ${parentTaskId} or its subtasks not found for subtask ${taskId}`
						);
					}

					// Find the subtask to remove
					const subtaskIndex = parentTask.subtasks.findIndex(
						(st) => st.id === subtaskId
					);
					if (subtaskIndex === -1) {
						throw new Error(
							`Subtask ${subtaskId} not found in parent task ${parentTaskId}`
						);
					}

					// Store the subtask info before removal
					const removedSubtask = {
						...parentTask.subtasks[subtaskIndex],
						parentTaskId: parentTaskId
					};
					results.removedTasks.push(removedSubtask);

					// Remove the subtask from the parent
					parentTask.subtasks.splice(subtaskIndex, 1);

					results.messages.push(`Successfully removed subtask ${taskId}`);
				}
				// Handle main task removal
				else {
					const taskIdNum = parseInt(taskId, 10);
					const taskIndex = data.tasks.findIndex((t) => t.id === taskIdNum);
					if (taskIndex === -1) {
						// This case should theoretically be caught by the taskExists check above,
						// but keep it as a safeguard.
						throw new Error(`Task with ID ${taskId} not found`);
					}

					// Store the task info before removal
					const removedTask = data.tasks[taskIndex];
					results.removedTasks.push(removedTask);
					tasksToDeleteFiles.push(taskIdNum); // Add to list for file deletion

					// Remove the task from the main array
					data.tasks.splice(taskIndex, 1);

					results.messages.push(`Successfully removed task ${taskId}`);
				}
			} catch (innerError) {
				// Catch errors specific to processing *this* ID
				const errorMsg = `Error processing ID ${taskId}: ${innerError.message}`;
				results.errors.push(errorMsg);
				results.success = false;
				log('warn', errorMsg); // Log as warning and continue with next ID
			}
		} // End of loop through taskIdsToRemove

		// --- Post-Loop Operations ---

		// Only proceed with cleanup and saving if at least one task was potentially removed
		if (results.removedTasks.length > 0) {
			// Remove all references AFTER all tasks/subtasks are removed
			const allRemovedIds = new Set(
				taskIdsToRemove.map((id) =>
					typeof id === 'string' && id.includes('.') ? id : parseInt(id, 10)
				)
			);

			data.tasks.forEach((task) => {
				// Clean dependencies in main tasks
				if (task.dependencies) {
					task.dependencies = task.dependencies.filter(
						(depId) => !allRemovedIds.has(depId)
					);
				}
				// Clean dependencies in remaining subtasks
				if (task.subtasks) {
					task.subtasks.forEach((subtask) => {
						if (subtask.dependencies) {
							subtask.dependencies = subtask.dependencies.filter(
								(depId) =>
									!allRemovedIds.has(`${task.id}.${depId}`) &&
									!allRemovedIds.has(depId) // check both subtask and main task refs
							);
						}
					});
				}
			});

			// Save the updated tasks file ONCE
			writeJSON(tasksPath, data);

			// Delete task files AFTER saving tasks.json
			for (const taskIdNum of tasksToDeleteFiles) {
				const taskFileName = path.join(
					path.dirname(tasksPath),
					`task_${taskIdNum.toString().padStart(3, '0')}.txt`
				);
				if (fs.existsSync(taskFileName)) {
					try {
						fs.unlinkSync(taskFileName);
						results.messages.push(`Deleted task file: ${taskFileName}`);
					} catch (unlinkError) {
						const unlinkMsg = `Failed to delete task file ${taskFileName}: ${unlinkError.message}`;
						results.errors.push(unlinkMsg);
						results.success = false;
						log('warn', unlinkMsg);
					}
				}
			}

			// Generate updated task files ONCE
			try {
				await generateTaskFiles(tasksPath, path.dirname(tasksPath));
				results.messages.push('Task files regenerated successfully.');
			} catch (genError) {
				const genErrMsg = `Failed to regenerate task files: ${genError.message}`;
				results.errors.push(genErrMsg);
				results.success = false;
				log('warn', genErrMsg);
			}
		} else if (results.errors.length === 0) {
			// Case where valid IDs were provided but none existed
			results.messages.push('No tasks found matching the provided IDs.');
		}

		// Consolidate messages for final output
		const finalMessage = results.messages.join('\n');
		const finalError = results.errors.join('\n');

		return {
			success: results.success,
			message: finalMessage || 'No tasks were removed.',
			error: finalError || null,
			removedTasks: results.removedTasks
		};
	} catch (error) {
		// Catch errors from reading file or other initial setup
		log('error', `Error removing tasks: ${error.message}`);
		return {
			success: false,
			message: '',
			error: `Operation failed: ${error.message}`,
			removedTasks: []
		};
	}
}

export default removeTask;
