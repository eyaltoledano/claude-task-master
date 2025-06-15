import path from 'path';
import {
	log,
	readJSON,
	writeJSON,
	getCurrentTag,
	setTasksForTag
} from '../utils.js';
import { isTaskDependentOn } from '../task-manager.js';
import generateTaskFiles from './generate-task-files.js';

/**
 * Move one or more tasks/subtasks to new positions
 * @param {string} tasksPath - Path to tasks.json file
 * @param {string} sourceId - ID(s) of the task/subtask to move (e.g., '5' or '5.2' or '5,6,7')
 * @param {string} destinationId - ID(s) of the destination (e.g., '7' or '7.3' or '7,8,9')
 * @param {boolean} generateFiles - Whether to regenerate task files after moving
 * @param {Object} options - Additional options
 * @param {string} options.projectRoot - Project root directory for tag resolution
 * @param {string} options.tag - Explicit tag to use (optional)
 * @returns {Object} Result object with moved task details
 */
async function moveTask(
	tasksPath,
	sourceId,
	destinationId,
	generateFiles = false,
	options = {}
) {
	// Check if we have comma-separated IDs (batch move)
	const sourceIds = sourceId.split(',').map((id) => id.trim());
	const destinationIds = destinationId.split(',').map((id) => id.trim());

	if (sourceIds.length !== destinationIds.length) {
		throw new Error(
			`Number of source IDs (${sourceIds.length}) must match number of destination IDs (${destinationIds.length})`
		);
	}

	// For batch moves, process each pair sequentially
	if (sourceIds.length > 1) {
		const results = [];
		for (let i = 0; i < sourceIds.length; i++) {
			const result = await moveTask(
				tasksPath,
				sourceIds[i],
				destinationIds[i],
				false, // Don't generate files for each individual move
				options
			);
			results.push(result);
		}

		// Generate files once at the end if requested
		if (generateFiles) {
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));
		}

		return {
			message: `Successfully moved ${sourceIds.length} tasks/subtasks`,
			moves: results
		};
	}

	// Single move logic
	// Read the raw data without tag resolution to preserve tagged structure
	let rawData = readJSON(tasksPath, options.projectRoot); // No tag parameter

	// Handle the case where readJSON returns resolved data with _rawTaggedData
	if (rawData && rawData._rawTaggedData) {
		// Use the raw tagged data and discard the resolved view
		rawData = rawData._rawTaggedData;
	}

	// Determine the current tag
	const currentTag =
		options.tag || getCurrentTag(options.projectRoot) || 'master';

	// Ensure the tag exists in the raw data
	if (
		!rawData ||
		!rawData[currentTag] ||
		!Array.isArray(rawData[currentTag].tasks)
	) {
		throw new Error(
			`Invalid tasks file or tag "${currentTag}" not found at ${tasksPath}`
		);
	}

	// Get the tasks for the current tag
	const tasks = rawData[currentTag].tasks;

	log(
		'info',
		`Moving task/subtask ${sourceId} to ${destinationId} (tag: ${currentTag})`
	);

	// Parse source and destination IDs
	const isSourceSubtask = sourceId.includes('.');
	const isDestSubtask = destinationId.includes('.');

	let result;

	if (isSourceSubtask && isDestSubtask) {
		// Subtask to subtask
		result = moveSubtaskToSubtask(tasks, sourceId, destinationId);
	} else if (isSourceSubtask && !isDestSubtask) {
		// Subtask to task
		result = moveSubtaskToTask(tasks, sourceId, destinationId);
	} else if (!isSourceSubtask && isDestSubtask) {
		// Task to subtask
		result = moveTaskToSubtask(tasks, sourceId, destinationId);
	} else {
		// Task to task
		result = moveTaskToTask(tasks, sourceId, destinationId);
	}

	// Update the data structure with the modified tasks
	rawData[currentTag].tasks = tasks;

	// Always write the data object, never the _rawTaggedData directly
	// The writeJSON function will filter out _rawTaggedData automatically
	writeJSON(tasksPath, rawData, options.projectRoot, currentTag);

	if (generateFiles) {
		await generateTaskFiles(tasksPath, path.dirname(tasksPath));
	}

	return result;
}

// Helper functions for different move scenarios
function moveSubtaskToSubtask(tasks, sourceId, destinationId) {
	// Parse IDs
	const [sourceParentId, sourceSubtaskId] = sourceId
		.split('.')
		.map((id) => parseInt(id, 10));
	const [destParentId, destSubtaskId] = destinationId
		.split('.')
		.map((id) => parseInt(id, 10));

	// Find source and destination parent tasks
	const sourceParentTask = tasks.find((t) => t.id === sourceParentId);
	const destParentTask = tasks.find((t) => t.id === destParentId);

	if (!sourceParentTask) {
		throw new Error(`Source parent task with ID ${sourceParentId} not found`);
	}
	if (!destParentTask) {
		throw new Error(
			`Destination parent task with ID ${destParentId} not found`
		);
	}

	// Initialize subtasks arrays if they don't exist (based on commit fixes)
	if (!sourceParentTask.subtasks) {
		sourceParentTask.subtasks = [];
	}
	if (!destParentTask.subtasks) {
		destParentTask.subtasks = [];
	}

	// Find source subtask
	const sourceSubtaskIndex = sourceParentTask.subtasks.findIndex(
		(st) => st.id === sourceSubtaskId
	);
	if (sourceSubtaskIndex === -1) {
		throw new Error(`Source subtask ${sourceId} not found`);
	}

	const sourceSubtask = sourceParentTask.subtasks[sourceSubtaskIndex];

	if (sourceParentId === destParentId) {
		// Moving within the same parent
		if (destParentTask.subtasks.length > 0) {
			const destSubtaskIndex = destParentTask.subtasks.findIndex(
				(st) => st.id === destSubtaskId
			);
			if (destSubtaskIndex !== -1) {
				// Remove from old position
				sourceParentTask.subtasks.splice(sourceSubtaskIndex, 1);
				// Insert at new position (adjust index if moving within same array)
				const adjustedIndex =
					sourceSubtaskIndex < destSubtaskIndex
						? destSubtaskIndex - 1
						: destSubtaskIndex;
				destParentTask.subtasks.splice(adjustedIndex + 1, 0, sourceSubtask);
			} else {
				// Destination subtask doesn't exist, insert at end
				sourceParentTask.subtasks.splice(sourceSubtaskIndex, 1);
				destParentTask.subtasks.push(sourceSubtask);
			}
		} else {
			// No existing subtasks, this will be the first one
			sourceParentTask.subtasks.splice(sourceSubtaskIndex, 1);
			destParentTask.subtasks.push(sourceSubtask);
		}
	} else {
		// Moving between different parents
		moveSubtaskToAnotherParent(
			sourceSubtask,
			sourceParentTask,
			sourceSubtaskIndex,
			destParentTask,
			destSubtaskId
		);
	}

	return {
		message: `Moved subtask ${sourceId} to ${destinationId}`,
		movedItem: sourceSubtask
	};
}

function moveSubtaskToTask(tasks, sourceId, destinationId) {
	// Parse source ID
	const [sourceParentId, sourceSubtaskId] = sourceId
		.split('.')
		.map((id) => parseInt(id, 10));
	const destTaskId = parseInt(destinationId, 10);

	// Find source parent and destination task
	const sourceParentTask = tasks.find((t) => t.id === sourceParentId);

	if (!sourceParentTask) {
		throw new Error(`Source parent task with ID ${sourceParentId} not found`);
	}
	if (!sourceParentTask.subtasks) {
		throw new Error(`Source parent task ${sourceParentId} has no subtasks`);
	}

	// Find source subtask
	const sourceSubtaskIndex = sourceParentTask.subtasks.findIndex(
		(st) => st.id === sourceSubtaskId
	);
	if (sourceSubtaskIndex === -1) {
		throw new Error(`Source subtask ${sourceId} not found`);
	}

	const sourceSubtask = sourceParentTask.subtasks[sourceSubtaskIndex];

	// Check if destination task exists
	const existingDestTask = tasks.find((t) => t.id === destTaskId);
	if (existingDestTask) {
		throw new Error(
			`Cannot move to existing task ID ${destTaskId}. Choose a different ID or use subtask destination.`
		);
	}

	// Create new task from subtask
	const newTask = {
		id: destTaskId,
		title: sourceSubtask.title,
		description: sourceSubtask.description,
		status: sourceSubtask.status || 'pending',
		dependencies: sourceSubtask.dependencies || [],
		priority: sourceSubtask.priority || 'medium',
		details: sourceSubtask.details || '',
		testStrategy: sourceSubtask.testStrategy || '',
		subtasks: []
	};

	// Remove subtask from source parent
	sourceParentTask.subtasks.splice(sourceSubtaskIndex, 1);

	// Insert new task in correct position
	const insertIndex = tasks.findIndex((t) => t.id > destTaskId);
	if (insertIndex === -1) {
		tasks.push(newTask);
	} else {
		tasks.splice(insertIndex, 0, newTask);
	}

	return {
		message: `Converted subtask ${sourceId} to task ${destinationId}`,
		movedItem: newTask
	};
}

function moveTaskToSubtask(tasks, sourceId, destinationId) {
	// Parse IDs
	const sourceTaskId = parseInt(sourceId, 10);
	const [destParentId, destSubtaskId] = destinationId
		.split('.')
		.map((id) => parseInt(id, 10));

	// Find source task and destination parent
	const sourceTaskIndex = tasks.findIndex((t) => t.id === sourceTaskId);
	const destParentTask = tasks.find((t) => t.id === destParentId);

	if (sourceTaskIndex === -1) {
		throw new Error(`Source task with ID ${sourceTaskId} not found`);
	}
	if (!destParentTask) {
		throw new Error(
			`Destination parent task with ID ${destParentId} not found`
		);
	}

	const sourceTask = tasks[sourceTaskIndex];

	// Initialize subtasks array if it doesn't exist (based on commit fixes)
	if (!destParentTask.subtasks) {
		destParentTask.subtasks = [];
	}

	// Create new subtask from task
	const newSubtask = {
		id: destSubtaskId,
		title: sourceTask.title,
		description: sourceTask.description,
		status: sourceTask.status || 'pending',
		dependencies: sourceTask.dependencies || [],
		details: sourceTask.details || '',
		testStrategy: sourceTask.testStrategy || ''
	};

	// Find insertion position (based on commit fixes)
	let destSubtaskIndex = -1;
	if (destParentTask.subtasks.length > 0) {
		destSubtaskIndex = destParentTask.subtasks.findIndex(
			(st) => st.id === destSubtaskId
		);
		if (destSubtaskIndex === -1) {
			// Subtask doesn't exist, we'll insert at the end
			destSubtaskIndex = destParentTask.subtasks.length - 1;
		}
	}

	// Insert at specific position (based on commit fixes)
	const insertPosition = destSubtaskIndex === -1 ? 0 : destSubtaskIndex + 1;
	destParentTask.subtasks.splice(insertPosition, 0, newSubtask);

	// Remove the original task from the tasks array
	tasks.splice(sourceTaskIndex, 1);

	return {
		message: `Converted task ${sourceId} to subtask ${destinationId}`,
		movedItem: newSubtask
	};
}

function moveTaskToTask(tasks, sourceId, destinationId) {
	const sourceTaskId = parseInt(sourceId, 10);
	const destTaskId = parseInt(destinationId, 10);

	// Find source task
	const sourceTaskIndex = tasks.findIndex((t) => t.id === sourceTaskId);
	if (sourceTaskIndex === -1) {
		throw new Error(`Source task with ID ${sourceTaskId} not found`);
	}

	const sourceTask = tasks[sourceTaskIndex];

	// Check if destination exists
	const destTaskIndex = tasks.findIndex((t) => t.id === destTaskId);

	if (destTaskIndex !== -1) {
		// Destination exists - this could be overwriting or swapping
		const destTask = tasks[destTaskIndex];

		// For now, throw an error to avoid accidental overwrites
		throw new Error(
			`Task with ID ${destTaskId} already exists. Use a different destination ID.`
		);
	} else {
		// Destination doesn't exist - create new task ID
		return moveTaskToNewId(tasks, sourceTaskIndex, sourceTask, destTaskId);
	}
}

function moveSubtaskToAnotherParent(
	sourceSubtask,
	sourceParentTask,
	sourceSubtaskIndex,
	destParentTask,
	destSubtaskId
) {
	const destSubtaskId_num = parseInt(destSubtaskId, 10);

	// Create new subtask with destination ID
	const newSubtask = {
		...sourceSubtask,
		id: destSubtaskId_num
	};

	// Initialize subtasks array if it doesn't exist (based on commit fixes)
	if (!destParentTask.subtasks) {
		destParentTask.subtasks = [];
	}

	// Find insertion position
	let destSubtaskIndex = -1;
	if (destParentTask.subtasks.length > 0) {
		destSubtaskIndex = destParentTask.subtasks.findIndex(
			(st) => st.id === destSubtaskId_num
		);
		if (destSubtaskIndex === -1) {
			// Subtask doesn't exist, we'll insert at the end
			destSubtaskIndex = destParentTask.subtasks.length - 1;
		}
	}

	// Insert at the destination position (based on commit fixes)
	const insertPosition = destSubtaskIndex === -1 ? 0 : destSubtaskIndex + 1;
	destParentTask.subtasks.splice(insertPosition, 0, newSubtask);

	// Remove the subtask from the original parent
	sourceParentTask.subtasks.splice(sourceSubtaskIndex, 1);

	return newSubtask;
}

function moveTaskToNewId(tasks, sourceTaskIndex, sourceTask, destTaskId) {
	const destTaskIndex = tasks.findIndex((t) => t.id === destTaskId);

	// Create moved task with new ID
	const movedTask = {
		...sourceTask,
		id: destTaskId
	};

	// Update any dependencies that reference the old task ID
	tasks.forEach((task) => {
		if (task.dependencies && task.dependencies.includes(sourceTask.id)) {
			const depIndex = task.dependencies.indexOf(sourceTask.id);
			task.dependencies[depIndex] = destTaskId;
		}
		if (task.subtasks) {
			task.subtasks.forEach((subtask) => {
				if (
					subtask.dependencies &&
					subtask.dependencies.includes(sourceTask.id)
				) {
					const depIndex = subtask.dependencies.indexOf(sourceTask.id);
					subtask.dependencies[depIndex] = destTaskId;
				}
			});
		}
	});

	// Update dependencies within movedTask's subtasks that reference sibling subtasks
	if (Array.isArray(movedTask.subtasks)) {
		movedTask.subtasks.forEach((subtask) => {
			if (Array.isArray(subtask.dependencies)) {
				subtask.dependencies = subtask.dependencies.map((dep) => {
					// If dependency is a string like "oldParent.subId", update to "newParent.subId"
					if (typeof dep === 'string' && dep.includes('.')) {
						const [depParent, depSub] = dep.split('.');
						if (parseInt(depParent, 10) === sourceTask.id) {
							return `${destTaskId}.${depSub}`;
						}
					}
					// If dependency is a number, and matches a subtask ID in the moved task, leave as is (context is implied)
					return dep;
				});
			}
		});
	}

	// Strategy based on commit fixes: remove source first, then replace destination
	// This avoids index shifting problems

	// Remove the source task first
	tasks.splice(sourceTaskIndex, 1);

	// Adjust the destination index if the source was before the destination
	// Since we removed the source, indices after it shift down by 1
	const adjustedDestIndex =
		sourceTaskIndex < destTaskIndex ? destTaskIndex - 1 : destTaskIndex;

	// Replace the placeholder destination task with the moved task (based on commit fixes)
	if (adjustedDestIndex >= 0 && adjustedDestIndex < tasks.length) {
		tasks[adjustedDestIndex] = movedTask;
	} else {
		// Insert at the end if index is out of bounds
		tasks.push(movedTask);
	}

	log('info', `Moved task ${sourceTask.id} to new ID ${destTaskId}`);

	return {
		message: `Moved task ${sourceTask.id} to new ID ${destTaskId}`,
		movedItem: movedTask
	};
}

export default moveTask;
