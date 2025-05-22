import path from 'path';
import { log, readJSON, writeJSON } from '../utils.js';
import { isTaskDependentOn } from '../task-manager.js';
import generateTaskFiles from './generate-task-files.js';

/**
 * Move a task or subtask to a new position
 * @param {string} tasksPath - Path to tasks.json file
 * @param {string} sourceId - ID of the task/subtask to move (e.g., '5' or '5.2')
 * @param {string} destinationId - ID of the destination (e.g., '7' or '7.3')
 * @param {boolean} generateFiles - Whether to regenerate task files after moving
 * @returns {Object} Result object with moved task details
 */
async function moveTask(
	tasksPath,
	sourceId,
	destinationId,
	generateFiles = true
) {
	try {
		log('info', `Moving task/subtask ${sourceId} to ${destinationId}...`);

		// Read the existing tasks
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`Invalid or missing tasks file at ${tasksPath}`);
		}

		// Parse source ID to determine if it's a task or subtask
		const isSourceSubtask = sourceId.includes('.');
		let sourceTask,
			sourceParentTask,
			sourceSubtask,
			sourceTaskIndex,
			sourceSubtaskIndex;

		// Parse destination ID to determine the target
		const isDestinationSubtask = destinationId.includes('.');
		let destTask, destParentTask, destSubtask, destTaskIndex, destSubtaskIndex;

		// Validate source exists
		if (isSourceSubtask) {
			// Source is a subtask
			const [parentIdStr, subtaskIdStr] = sourceId.split('.');
			const parentIdNum = parseInt(parentIdStr, 10);
			const subtaskIdNum = parseInt(subtaskIdStr, 10);

			sourceParentTask = data.tasks.find((t) => t.id === parentIdNum);
			if (!sourceParentTask) {
				throw new Error(`Source parent task with ID ${parentIdNum} not found`);
			}

			if (
				!sourceParentTask.subtasks ||
				sourceParentTask.subtasks.length === 0
			) {
				throw new Error(`Source parent task ${parentIdNum} has no subtasks`);
			}

			sourceSubtaskIndex = sourceParentTask.subtasks.findIndex(
				(st) => st.id === subtaskIdNum
			);
			if (sourceSubtaskIndex === -1) {
				throw new Error(`Source subtask ${sourceId} not found`);
			}

			sourceSubtask = { ...sourceParentTask.subtasks[sourceSubtaskIndex] };
		} else {
			// Source is a task
			const sourceIdNum = parseInt(sourceId, 10);
			sourceTaskIndex = data.tasks.findIndex((t) => t.id === sourceIdNum);
			if (sourceTaskIndex === -1) {
				throw new Error(`Source task with ID ${sourceIdNum} not found`);
			}

			sourceTask = { ...data.tasks[sourceTaskIndex] };
		}

		// Validate destination exists
		if (isDestinationSubtask) {
			// Destination is a subtask (target will be the parent of this subtask)
			const [parentIdStr, subtaskIdStr] = destinationId.split('.');
			const parentIdNum = parseInt(parentIdStr, 10);
			const subtaskIdNum = parseInt(subtaskIdStr, 10);

			destParentTask = data.tasks.find((t) => t.id === parentIdNum);
			if (!destParentTask) {
				throw new Error(
					`Destination parent task with ID ${parentIdNum} not found`
				);
			}

			if (!destParentTask.subtasks || destParentTask.subtasks.length === 0) {
				throw new Error(
					`Destination parent task ${parentIdNum} has no subtasks`
				);
			}

			destSubtaskIndex = destParentTask.subtasks.findIndex(
				(st) => st.id === subtaskIdNum
			);
			if (destSubtaskIndex === -1) {
				throw new Error(`Destination subtask ${destinationId} not found`);
			}

			destSubtask = destParentTask.subtasks[destSubtaskIndex];
		} else {
			// Destination is a task
			const destIdNum = parseInt(destinationId, 10);
			destTaskIndex = data.tasks.findIndex((t) => t.id === destIdNum);

			if (destTaskIndex === -1) {
				// Create placeholder for destination if it doesn't exist
				log('info', `Creating placeholder for destination task ${destIdNum}`);
				const newTask = {
					id: destIdNum,
					title: `Task ${destIdNum}`,
					description: '',
					status: 'pending',
					priority: 'medium',
					details: '',
					testStrategy: ''
				};

				// Find correct position to insert the new task
				let insertIndex = 0;
				while (
					insertIndex < data.tasks.length &&
					data.tasks[insertIndex].id < destIdNum
				) {
					insertIndex++;
				}

				// Insert the new task at the appropriate position
				data.tasks.splice(insertIndex, 0, newTask);
				destTaskIndex = insertIndex;
				destTask = data.tasks[destTaskIndex];
			} else {
				destTask = data.tasks[destTaskIndex];

				// Check if destination task is already a "real" task with content
				// Only allow moving to destination IDs that don't have meaningful content
				if (
					destTask.title !== `Task ${destTask.id}` ||
					destTask.description !== '' ||
					destTask.details !== ''
				) {
					throw new Error(
						`Cannot move to task ID ${destIdNum} as it already contains content. Choose a different destination ID.`
					);
				}
			}
		}

		// Validate that we aren't trying to move a task to itself
		if (sourceId === destinationId) {
			throw new Error('Cannot move a task/subtask to itself');
		}

		// Prevent moving a parent to its own subtask
		if (!isSourceSubtask && isDestinationSubtask) {
			const destParentId = parseInt(destinationId.split('.')[0], 10);
			if (parseInt(sourceId, 10) === destParentId) {
				throw new Error('Cannot move a parent task to one of its own subtasks');
			}
		}

		// Check for circular dependency when moving tasks
		if (!isSourceSubtask && !isDestinationSubtask) {
			const sourceIdNum = parseInt(sourceId, 10);
			const destIdNum = parseInt(destinationId, 10);

			// Check if destination is dependent on source
			if (isTaskDependentOn(data.tasks, destTask, sourceIdNum)) {
				throw new Error(
					`Cannot move task ${sourceId} to task ${destinationId} as it would create a circular dependency`
				);
			}
		}

		let movedTask;

		// Handle different move scenarios
		if (!isSourceSubtask && !isDestinationSubtask) {
			// Check if destination is a placeholder we just created
			if (
				destTask.title === `Task ${destTask.id}` &&
				destTask.description === '' &&
				destTask.details === ''
			) {
				// Case 0: Move task to a new position/ID (destination is a placeholder)
				movedTask = moveTaskToNewId(
					data,
					sourceTask,
					sourceTaskIndex,
					destTask,
					destTaskIndex
				);
			} else {
				// Case 1: Move standalone task to become a subtask of another task
				movedTask = moveTaskToTask(data, sourceTask, sourceTaskIndex, destTask);
			}
		} else if (!isSourceSubtask && isDestinationSubtask) {
			// Case 2: Move standalone task to become a subtask at a specific position
			movedTask = moveTaskToSubtaskPosition(
				data,
				sourceTask,
				sourceTaskIndex,
				destParentTask,
				destSubtaskIndex
			);
		} else if (isSourceSubtask && !isDestinationSubtask) {
			// Case 3: Move subtask to become a standalone task
			movedTask = moveSubtaskToTask(
				data,
				sourceSubtask,
				sourceParentTask,
				sourceSubtaskIndex,
				destTask
			);
		} else if (isSourceSubtask && isDestinationSubtask) {
			// Case 4: Move subtask to another parent or position
			// First check if it's the same parent
			const sourceParentId = parseInt(sourceId.split('.')[0], 10);
			const destParentId = parseInt(destinationId.split('.')[0], 10);

			if (sourceParentId === destParentId) {
				// Case 4a: Move subtask within the same parent (reordering)
				movedTask = reorderSubtask(
					sourceParentTask,
					sourceSubtaskIndex,
					destSubtaskIndex
				);
			} else {
				// Case 4b: Move subtask to a different parent
				movedTask = moveSubtaskToAnotherParent(
					sourceSubtask,
					sourceParentTask,
					sourceSubtaskIndex,
					destParentTask,
					destSubtaskIndex
				);
			}
		}

		// Write the updated tasks back to the file
		writeJSON(tasksPath, data);

		// Generate task files if requested
		if (generateFiles) {
			log('info', 'Regenerating task files...');
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));
		}

		return movedTask;
	} catch (error) {
		log('error', `Error moving task/subtask: ${error.message}`);
		throw error;
	}
}

/**
 * Move a standalone task to become a subtask of another task
 * @param {Object} data - Tasks data object
 * @param {Object} sourceTask - Source task to move
 * @param {number} sourceTaskIndex - Index of source task in data.tasks
 * @param {Object} destTask - Destination task
 * @returns {Object} Moved task object
 */
function moveTaskToTask(data, sourceTask, sourceTaskIndex, destTask) {
	// Initialize subtasks array if it doesn't exist
	if (!destTask.subtasks) {
		destTask.subtasks = [];
	}

	// Find the highest subtask ID to determine the next ID
	const highestSubtaskId =
		destTask.subtasks.length > 0
			? Math.max(...destTask.subtasks.map((st) => st.id))
			: 0;
	const newSubtaskId = highestSubtaskId + 1;

	// Create the new subtask from the source task
	const newSubtask = {
		...sourceTask,
		id: newSubtaskId,
		parentTaskId: destTask.id
	};

	// Add to destination's subtasks
	destTask.subtasks.push(newSubtask);

	// Remove the original task from the tasks array
	data.tasks.splice(sourceTaskIndex, 1);

	log(
		'info',
		`Moved task ${sourceTask.id} to become subtask ${destTask.id}.${newSubtaskId}`
	);

	return newSubtask;
}

/**
 * Move a standalone task to become a subtask at a specific position
 * @param {Object} data - Tasks data object
 * @param {Object} sourceTask - Source task to move
 * @param {number} sourceTaskIndex - Index of source task in data.tasks
 * @param {Object} destParentTask - Destination parent task
 * @param {number} destSubtaskIndex - Index of the subtask before which to insert
 * @returns {Object} Moved task object
 */
function moveTaskToSubtaskPosition(
	data,
	sourceTask,
	sourceTaskIndex,
	destParentTask,
	destSubtaskIndex
) {
	// Initialize subtasks array if it doesn't exist
	if (!destParentTask.subtasks) {
		destParentTask.subtasks = [];
	}

	// Find the highest subtask ID to determine the next ID
	const highestSubtaskId =
		destParentTask.subtasks.length > 0
			? Math.max(...destParentTask.subtasks.map((st) => st.id))
			: 0;
	const newSubtaskId = highestSubtaskId + 1;

	// Create the new subtask from the source task
	const newSubtask = {
		...sourceTask,
		id: newSubtaskId,
		parentTaskId: destParentTask.id
	};

	// Insert at specific position
	destParentTask.subtasks.splice(destSubtaskIndex + 1, 0, newSubtask);

	// Remove the original task from the tasks array
	data.tasks.splice(sourceTaskIndex, 1);

	log(
		'info',
		`Moved task ${sourceTask.id} to become subtask ${destParentTask.id}.${newSubtaskId}`
	);

	return newSubtask;
}

/**
 * Move a subtask to become a standalone task
 * @param {Object} data - Tasks data object
 * @param {Object} sourceSubtask - Source subtask to move
 * @param {Object} sourceParentTask - Parent task of the source subtask
 * @param {number} sourceSubtaskIndex - Index of source subtask in parent's subtasks
 * @param {Object} destTask - Destination task (for position reference)
 * @returns {Object} Moved task object
 */
function moveSubtaskToTask(
	data,
	sourceSubtask,
	sourceParentTask,
	sourceSubtaskIndex,
	destTask
) {
	// Find the highest task ID to determine the next ID
	const highestId = Math.max(...data.tasks.map((t) => t.id));
	const newTaskId = highestId + 1;

	// Create the new task from the subtask
	const newTask = {
		...sourceSubtask,
		id: newTaskId,
		priority: sourceParentTask.priority || 'medium' // Inherit priority from parent
	};
	delete newTask.parentTaskId;

	// Add the parent task as a dependency if not already present
	if (!newTask.dependencies) {
		newTask.dependencies = [];
	}
	if (!newTask.dependencies.includes(sourceParentTask.id)) {
		newTask.dependencies.push(sourceParentTask.id);
	}

	// Find the destination index to insert the new task
	const destTaskIndex = data.tasks.findIndex((t) => t.id === destTask.id);

	// Insert the new task after the destination task
	data.tasks.splice(destTaskIndex + 1, 0, newTask);

	// Remove the subtask from the parent
	sourceParentTask.subtasks.splice(sourceSubtaskIndex, 1);

	// If parent has no more subtasks, remove the subtasks array
	if (sourceParentTask.subtasks.length === 0) {
		delete sourceParentTask.subtasks;
	}

	log(
		'info',
		`Moved subtask ${sourceParentTask.id}.${sourceSubtask.id} to become task ${newTaskId}`
	);

	return newTask;
}

/**
 * Reorder a subtask within the same parent
 * @param {Object} parentTask - Parent task containing the subtask
 * @param {number} sourceIndex - Current index of the subtask
 * @param {number} destIndex - Destination index for the subtask
 * @returns {Object} Moved subtask object
 */
function reorderSubtask(parentTask, sourceIndex, destIndex) {
	// Get the subtask to move
	const subtask = parentTask.subtasks[sourceIndex];

	// Remove the subtask from its current position
	parentTask.subtasks.splice(sourceIndex, 1);

	// Insert the subtask at the new position
	// If destIndex was after sourceIndex, it's now one less because we removed an item
	const adjustedDestIndex = sourceIndex < destIndex ? destIndex - 1 : destIndex;
	parentTask.subtasks.splice(adjustedDestIndex, 0, subtask);

	log(
		'info',
		`Reordered subtask ${parentTask.id}.${subtask.id} within parent task ${parentTask.id}`
	);

	return subtask;
}

/**
 * Move a subtask to a different parent
 * @param {Object} sourceSubtask - Source subtask to move
 * @param {Object} sourceParentTask - Parent task of the source subtask
 * @param {number} sourceSubtaskIndex - Index of source subtask in parent's subtasks
 * @param {Object} destParentTask - Destination parent task
 * @param {number} destSubtaskIndex - Index of the subtask before which to insert
 * @returns {Object} Moved subtask object
 */
function moveSubtaskToAnotherParent(
	sourceSubtask,
	sourceParentTask,
	sourceSubtaskIndex,
	destParentTask,
	destSubtaskIndex
) {
	// Find the highest subtask ID in the destination parent
	const highestSubtaskId =
		destParentTask.subtasks.length > 0
			? Math.max(...destParentTask.subtasks.map((st) => st.id))
			: 0;
	const newSubtaskId = highestSubtaskId + 1;

	// Create the new subtask with updated parent reference
	const newSubtask = {
		...sourceSubtask,
		id: newSubtaskId,
		parentTaskId: destParentTask.id
	};

	// If the subtask depends on its original parent, keep that dependency
	if (!newSubtask.dependencies) {
		newSubtask.dependencies = [];
	}
	if (!newSubtask.dependencies.includes(sourceParentTask.id)) {
		newSubtask.dependencies.push(sourceParentTask.id);
	}

	// Insert at the destination position
	destParentTask.subtasks.splice(destSubtaskIndex + 1, 0, newSubtask);

	// Remove the subtask from the original parent
	sourceParentTask.subtasks.splice(sourceSubtaskIndex, 1);

	// If original parent has no more subtasks, remove the subtasks array
	if (sourceParentTask.subtasks.length === 0) {
		delete sourceParentTask.subtasks;
	}

	log(
		'info',
		`Moved subtask ${sourceParentTask.id}.${sourceSubtask.id} to become subtask ${destParentTask.id}.${newSubtaskId}`
	);

	return newSubtask;
}

/**
 * Move a standalone task to a new ID position
 * @param {Object} data - Tasks data object
 * @param {Object} sourceTask - Source task to move
 * @param {number} sourceTaskIndex - Index of source task in data.tasks
 * @param {Object} destTask - Destination placeholder task
 * @param {number} destTaskIndex - Index of destination task in data.tasks
 * @returns {Object} Moved task object
 */
function moveTaskToNewId(
	data,
	sourceTask,
	sourceTaskIndex,
	destTask,
	destTaskIndex
) {
	// Create a copy of the source task with the new ID
	const movedTask = {
		...sourceTask,
		id: destTask.id
	};

	// Get numeric IDs for comparison
	const sourceIdNum = parseInt(sourceTask.id, 10);
	const destIdNum = parseInt(destTask.id, 10);

	// Handle subtasks if present
	if (sourceTask.subtasks && sourceTask.subtasks.length > 0) {
		// Update subtasks to reference the new parent ID if needed
		movedTask.subtasks = sourceTask.subtasks.map((subtask) => ({
			...subtask,
			parentTaskId: destIdNum
		}));
	}

	// Update any dependencies in other tasks that referenced the old ID
	data.tasks.forEach((task) => {
		if (task.dependencies && task.dependencies.includes(sourceIdNum)) {
			// Replace the old ID with the new ID
			const depIndex = task.dependencies.indexOf(sourceIdNum);
			task.dependencies[depIndex] = destIdNum;
		}

		// Also check for subtask dependencies that might reference this task
		if (task.subtasks && task.subtasks.length > 0) {
			task.subtasks.forEach((subtask) => {
				if (
					subtask.dependencies &&
					subtask.dependencies.includes(sourceIdNum)
				) {
					const depIndex = subtask.dependencies.indexOf(sourceIdNum);
					subtask.dependencies[depIndex] = destIdNum;
				}
			});
		}
	});

	// Remove the original task from its position
	data.tasks.splice(sourceTaskIndex, 1);

	// If we're moving to a position after the original, adjust the destination index
	// since removing the original shifts everything down by 1
	const adjustedDestIndex =
		sourceTaskIndex < destTaskIndex ? destTaskIndex - 1 : destTaskIndex;

	// Remove the placeholder destination task
	data.tasks.splice(adjustedDestIndex, 1);

	// Insert the moved task at the destination position
	data.tasks.splice(adjustedDestIndex, 0, movedTask);

	log('info', `Moved task ${sourceIdNum} to new ID ${destIdNum}`);

	return movedTask;
}

export default moveTask;
