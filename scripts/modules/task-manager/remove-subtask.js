import path from 'path';
import { log, readJSON, writeJSON } from '../utils.js';
import generateTaskFiles from './generate-task-files.js';

/**
 * Remove a subtask from its parent task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} subtaskId - ID of the subtask to remove in format "parentId.subtaskId"
 * @param {boolean} convertToTask - Whether to convert the subtask to a standalone task
 * @param {boolean} generateFiles - Whether to regenerate task files after removing the subtask
 * @param {Object} context - Context object containing projectRoot and tag information
 * @returns {Object|null} The removed subtask if convertToTask is true, otherwise null
 */
async function removeSubtask(
	tasksPath,
	subtaskId,
	convertToTask = false,
	generateFiles = true,
	context = {}
) {
	try {
		log('info', `Removing subtask ${subtaskId}...`);

		// Read the existing tasks with proper context
		const data = readJSON(tasksPath, context.projectRoot, context.tag);
		if (!data || !data.tasks) {
			throw new Error(`Invalid or missing tasks file at ${tasksPath}`);
		}

		// Parse the subtask ID (format: "parentId.subtaskId")
		if (!subtaskId.includes('.')) {
			throw new Error(
				`Invalid subtask ID format: ${subtaskId}. Expected format: "parentId.subtaskId"`
			);
		}

		const [parentIdStr, subtaskIdStr] = subtaskId.split('.');
		const parentId = parseInt(parentIdStr, 10);
		const subtaskIdNum = parseInt(subtaskIdStr, 10);

		// Find the parent task
		const parentTask = data.tasks.find((t) => t.id === parentId);
		if (!parentTask) {
			throw new Error(`Parent task with ID ${parentId} not found`);
		}

		// Check if parent has subtasks
		if (!parentTask.subtasks || parentTask.subtasks.length === 0) {
			throw new Error(`Parent task ${parentId} has no subtasks`);
		}

		// Find the subtask to remove
		const subtaskIndex = parentTask.subtasks.findIndex(
			(st) => st.id === subtaskIdNum
		);
		if (subtaskIndex === -1) {
			throw new Error(`Subtask ${subtaskId} not found`);
		}

		// Get a copy of the subtask before removing it
		const removedSubtask = { ...parentTask.subtasks[subtaskIndex] };

		// Remove the subtask from the parent
		parentTask.subtasks.splice(subtaskIndex, 1);

		// If parent has no more subtasks, remove the subtasks array
		if (parentTask.subtasks.length === 0) {
			parentTask.subtasks = undefined;
		}

		let convertedTask = null;

		// Convert the subtask to a standalone task if requested
		if (convertToTask) {
			log('info', `Converting subtask ${subtaskId} to a standalone task...`);

			// Find the highest task ID to determine the next ID
			const highestId = Math.max(...data.tasks.map((t) => t.id));
			const newTaskId = highestId + 1;

			// Create the new task from the subtask
			convertedTask = {
				id: newTaskId,
				title: removedSubtask.title,
				description: removedSubtask.description || '',
				details: removedSubtask.details || '',
				status: removedSubtask.status || 'pending',
				dependencies: removedSubtask.dependencies || [],
				priority: parentTask.priority || 'medium' // Inherit priority from parent
			};

			// Add the parent task as a dependency if not already present
			if (!convertedTask.dependencies.includes(parentId)) {
				convertedTask.dependencies.push(parentId);
			}

			// Add the converted task to the tasks array
			data.tasks.push(convertedTask);

			log('info', `Created new task ${newTaskId} from subtask ${subtaskId}`);
		} else {
			log('info', `Subtask ${subtaskId} deleted`);
		}

		// Write the updated tasks back to the file with proper context
		writeJSON(tasksPath, data, context.projectRoot, context.tag);

		// Generate task files if requested
		if (generateFiles) {
			log('info', 'Regenerating task files...');
			// await generateTaskFiles(tasksPath, path.dirname(tasksPath), context);
		}

		return convertedTask;
	} catch (error) {
		log('error', `Error removing subtask: ${error.message}`);
		throw error;
	}
}

export default removeSubtask;
