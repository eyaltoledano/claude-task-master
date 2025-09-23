import path from 'path';
import {
	log,
	readJSON,
	writeJSON,
	setTasksForTag,
	traverseDependencies
} from '../utils.js';
import generateTaskFiles from './generate-task-files.js';
import {
	findCrossTagDependencies,
	getDependentTaskIds,
	validateSubtaskMove
} from '../dependency-manager.js';

/**
 * Find all dependencies recursively for a set of source tasks with depth limiting
 * @param {Array} sourceTasks - The source tasks to find dependencies for
 * @param {Array} allTasks - All available tasks from all tags
 * @param {Object} options - Options object
 * @param {number} options.maxDepth - Maximum recursion depth (default: 50)
 * @param {boolean} options.includeSelf - Whether to include self-references (default: false)
 * @returns {Array} Array of all dependency task IDs
 */
function findAllDependenciesRecursively(sourceTasks, allTasks, options = {}) {
	return traverseDependencies(sourceTasks, allTasks, {
		...options,
		direction: 'forward',
		logger: { warn: console.warn }
	});
}

/**
 * Structured error class for move operations
 */
class MoveTaskError extends Error {
	constructor(code, message, data = {}) {
		super(message);
		this.name = 'MoveTaskError';
		this.code = code;
		this.data = data;
	}
}

/**
 * Error codes for move operations
 */
const MOVE_ERROR_CODES = {
	CROSS_TAG_DEPENDENCY_CONFLICTS: 'CROSS_TAG_DEPENDENCY_CONFLICTS',
	CANNOT_MOVE_SUBTASK: 'CANNOT_MOVE_SUBTASK',
	SOURCE_TARGET_TAGS_SAME: 'SOURCE_TARGET_TAGS_SAME',
	TASK_NOT_FOUND: 'TASK_NOT_FOUND',
	SUBTASK_NOT_FOUND: 'SUBTASK_NOT_FOUND',
	PARENT_TASK_NOT_FOUND: 'PARENT_TASK_NOT_FOUND',
	PARENT_TASK_NO_SUBTASKS: 'PARENT_TASK_NO_SUBTASKS',
	DESTINATION_TASK_NOT_FOUND: 'DESTINATION_TASK_NOT_FOUND',
	TASK_ALREADY_EXISTS: 'TASK_ALREADY_EXISTS',
	INVALID_TASKS_FILE: 'INVALID_TASKS_FILE',
	ID_COUNT_MISMATCH: 'ID_COUNT_MISMATCH',
	INVALID_SOURCE_TAG: 'INVALID_SOURCE_TAG',
	INVALID_TARGET_TAG: 'INVALID_TARGET_TAG'
};

/**
 * Normalize a dependency value to its numeric parent task ID.
 * - Numbers are returned as-is (if finite)
 * - Numeric strings are parsed ("5" -> 5)
 * - Dotted strings return the parent portion ("5.2" -> 5)
 * - Empty/invalid values return null
 * - null/undefined are preserved
 * @param {number|string|null|undefined} dep
 * @returns {number|null|undefined}
 */
function normalizeDependency(dep) {
	if (dep === null || dep === undefined) return dep;
	if (typeof dep === 'number') return Number.isFinite(dep) ? dep : null;
	if (typeof dep === 'string') {
		const trimmed = dep.trim();
		if (trimmed === '') return null;
		const parentPart = trimmed.includes('.') ? trimmed.split('.')[0] : trimmed;
		const parsed = parseInt(parentPart, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

/**
 * Normalize an array of dependency values to numeric IDs.
 * Preserves null/undefined input (returns as-is) and filters out invalid entries.
 * @param {Array<any>|null|undefined} deps
 * @returns {Array<number>|null|undefined}
 */
function normalizeDependencies(deps) {
	if (deps === null || deps === undefined) return deps;
	if (!Array.isArray(deps)) return deps;
	return deps
		.map((d) => normalizeDependency(d))
		.filter((n) => Number.isFinite(n));
}

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
	const { projectRoot, tag } = options;
	// Check if we have comma-separated IDs (batch move)
	const sourceIds = sourceId.split(',').map((id) => id.trim());
	const destinationIds = destinationId.split(',').map((id) => id.trim());

	if (sourceIds.length !== destinationIds.length) {
		throw new MoveTaskError(
			MOVE_ERROR_CODES.ID_COUNT_MISMATCH,
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
			await generateTaskFiles(tasksPath, path.dirname(tasksPath), {
				tag: tag,
				projectRoot: projectRoot
			});
		}

		return {
			message: `Successfully moved ${sourceIds.length} tasks/subtasks`,
			moves: results
		};
	}

	// Single move logic
	// Read the raw data without tag resolution to preserve tagged structure
	let rawData = readJSON(tasksPath, projectRoot, tag);

	// Handle the case where readJSON returns resolved data with _rawTaggedData
	if (rawData && rawData._rawTaggedData) {
		// Use the raw tagged data and discard the resolved view
		rawData = rawData._rawTaggedData;
	}

	// Ensure the tag exists in the raw data
	if (!rawData || !rawData[tag] || !Array.isArray(rawData[tag].tasks)) {
		throw new MoveTaskError(
			MOVE_ERROR_CODES.INVALID_TASKS_FILE,
			`Invalid tasks file or tag "${tag}" not found at ${tasksPath}`
		);
	}

	// Get the tasks for the current tag
	const tasks = rawData[tag].tasks;

	log(
		'info',
		`Moving task/subtask ${sourceId} to ${destinationId} (tag: ${tag})`
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
	rawData[tag].tasks = tasks;

	// Always write the data object, never the _rawTaggedData directly
	// The writeJSON function will filter out _rawTaggedData automatically
	writeJSON(tasksPath, rawData, options.projectRoot, tag);

	if (generateFiles) {
		await generateTaskFiles(tasksPath, path.dirname(tasksPath), {
			tag: tag,
			projectRoot: projectRoot
		});
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
		throw new MoveTaskError(
			MOVE_ERROR_CODES.PARENT_TASK_NOT_FOUND,
			`Source parent task with ID ${sourceParentId} not found`
		);
	}
	if (!destParentTask) {
		throw new MoveTaskError(
			MOVE_ERROR_CODES.PARENT_TASK_NOT_FOUND,
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
		throw new MoveTaskError(
			MOVE_ERROR_CODES.SUBTASK_NOT_FOUND,
			`Source subtask ${sourceId} not found`
		);
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
		throw new MoveTaskError(
			MOVE_ERROR_CODES.PARENT_TASK_NOT_FOUND,
			`Source parent task with ID ${sourceParentId} not found`
		);
	}
	if (!sourceParentTask.subtasks) {
		throw new MoveTaskError(
			MOVE_ERROR_CODES.PARENT_TASK_NO_SUBTASKS,
			`Source parent task ${sourceParentId} has no subtasks`
		);
	}

	// Find source subtask
	const sourceSubtaskIndex = sourceParentTask.subtasks.findIndex(
		(st) => st.id === sourceSubtaskId
	);
	if (sourceSubtaskIndex === -1) {
		throw new MoveTaskError(
			MOVE_ERROR_CODES.SUBTASK_NOT_FOUND,
			`Source subtask ${sourceId} not found`
		);
	}

	const sourceSubtask = sourceParentTask.subtasks[sourceSubtaskIndex];

	// Check if destination task exists
	const existingDestTask = tasks.find((t) => t.id === destTaskId);
	if (existingDestTask) {
		throw new MoveTaskError(
			MOVE_ERROR_CODES.TASK_ALREADY_EXISTS,
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
		throw new MoveTaskError(
			MOVE_ERROR_CODES.TASK_NOT_FOUND,
			`Source task with ID ${sourceTaskId} not found`
		);
	}
	if (!destParentTask) {
		throw new MoveTaskError(
			MOVE_ERROR_CODES.PARENT_TASK_NOT_FOUND,
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
		throw new MoveTaskError(
			MOVE_ERROR_CODES.TASK_NOT_FOUND,
			`Source task with ID ${sourceTaskId} not found`
		);
	}

	const sourceTask = tasks[sourceTaskIndex];

	// Check if destination exists
	const destTaskIndex = tasks.findIndex((t) => t.id === destTaskId);

	if (destTaskIndex !== -1) {
		// Destination exists - this could be overwriting or swapping
		const destTask = tasks[destTaskIndex];

		// For now, throw an error to avoid accidental overwrites
		throw new MoveTaskError(
			MOVE_ERROR_CODES.TASK_ALREADY_EXISTS,
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

/**
 * Get all tasks from all tags with tag information
 * @param {Object} rawData - The raw tagged data object
 * @returns {Array} A flat array of all task objects with tag property
 */
function getAllTasksWithTags(rawData) {
	let allTasks = [];
	for (const tagName in rawData) {
		if (
			Object.prototype.hasOwnProperty.call(rawData, tagName) &&
			rawData[tagName] &&
			Array.isArray(rawData[tagName].tasks)
		) {
			const tasksWithTag = rawData[tagName].tasks.map((task) => ({
				...task,
				tag: tagName
			}));
			allTasks = allTasks.concat(tasksWithTag);
		}
	}
	return allTasks;
}

/**
 * Validate move operation parameters and data
 * @param {string} tasksPath - Path to tasks.json file
 * @param {Array} taskIds - Array of task IDs to move
 * @param {string} sourceTag - Source tag name
 * @param {string} targetTag - Target tag name
 * @param {Object} context - Context object
 * @returns {Object} Validation result with rawData and sourceTasks
 */
async function validateMove(tasksPath, taskIds, sourceTag, targetTag, context) {
	const { projectRoot } = context;

	// Read the raw data without tag resolution to preserve tagged structure
	let rawData = readJSON(tasksPath, projectRoot, sourceTag);

	// Handle the case where readJSON returns resolved data with _rawTaggedData
	if (rawData && rawData._rawTaggedData) {
		rawData = rawData._rawTaggedData;
	}

	// Validate source tag exists
	if (
		!rawData ||
		!rawData[sourceTag] ||
		!Array.isArray(rawData[sourceTag].tasks)
	) {
		throw new MoveTaskError(
			MOVE_ERROR_CODES.INVALID_SOURCE_TAG,
			`Source tag "${sourceTag}" not found or invalid`
		);
	}

	// Create target tag if it doesn't exist
	if (!rawData[targetTag]) {
		rawData[targetTag] = { tasks: [] };
		log('info', `Created new tag "${targetTag}"`);
	}

	// Normalize all IDs to strings once for consistent comparison
	const normalizedSearchIds = taskIds.map((id) => String(id));

	const sourceTasks = rawData[sourceTag].tasks.filter((t) => {
		const normalizedTaskId = String(t.id);
		return normalizedSearchIds.includes(normalizedTaskId);
	});

	// Validate subtask movement
	taskIds.forEach((taskId) => {
		validateSubtaskMove(taskId, sourceTag, targetTag);
	});

	return { rawData, sourceTasks };
}

/**
 * Load and prepare task data for move operation
 * @param {Object} validation - Validation result from validateMove
 * @returns {Object} Prepared data with rawData, sourceTasks, and allTasks
 */
async function prepareTaskData(validation) {
	const { rawData, sourceTasks } = validation;

	// Get all tasks for validation
	const allTasks = getAllTasksWithTags(rawData);

	return { rawData, sourceTasks, allTasks };
}

/**
 * Resolve dependencies and determine tasks to move
 * @param {Array} sourceTasks - Source tasks to move
 * @param {Array} allTasks - All available tasks from all tags
 * @param {Object} options - Move options
 * @param {Array} taskIds - Original task IDs
 * @param {string} sourceTag - Source tag name
 * @param {string} targetTag - Target tag name
 * @returns {Object} Tasks to move and dependency resolution info
 */
async function resolveDependencies(
	sourceTasks,
	allTasks,
	options,
	taskIds,
	sourceTag,
	targetTag
) {
	const { withDependencies = false, ignoreDependencies = false } = options;

	// Scope allTasks to the source tag to avoid cross-tag contamination when
	// computing dependency chains for --with-dependencies
	const tasksInSourceTag = Array.isArray(allTasks)
		? allTasks.filter((t) => t && t.tag === sourceTag)
		: [];

	// Handle --with-dependencies flag first (regardless of cross-tag dependencies)
	if (withDependencies) {
		// Move dependent tasks along with main tasks
		// Find ALL dependencies recursively, but only using tasks from the source tag
		const allDependentTaskIdsRaw = findAllDependenciesRecursively(
			sourceTasks,
			tasksInSourceTag,
			{ maxDepth: 100, includeSelf: false }
		);

		// Filter dependent IDs to those that actually exist in the source tag
		const sourceTagIds = new Set(
			tasksInSourceTag.map((t) =>
				typeof t.id === 'string' ? parseInt(t.id, 10) : t.id
			)
		);
		const allDependentTaskIds = allDependentTaskIdsRaw.filter((depId) => {
			// Only numeric task IDs are eligible to be moved (subtasks cannot be moved cross-tag)
			const normalizedId = normalizeDependency(depId);
			return Number.isFinite(normalizedId) && sourceTagIds.has(normalizedId);
		});

		const allTaskIdsToMove = [...new Set([...taskIds, ...allDependentTaskIds])];

		log(
			'info',
			`Moving ${allTaskIdsToMove.length} tasks (including dependencies): ${allTaskIdsToMove.join(', ')}`
		);

		return {
			tasksToMove: allTaskIdsToMove,
			dependencyResolution: {
				type: 'with-dependencies',
				dependentTasks: allDependentTaskIds
			}
		};
	}

	// Find cross-tag dependencies (these shouldn't exist since dependencies are only within tags)
	const crossTagDependencies = findCrossTagDependencies(
		sourceTasks,
		sourceTag,
		targetTag,
		allTasks
	);

	if (crossTagDependencies.length > 0) {
		if (ignoreDependencies) {
			// Break cross-tag dependencies (edge case - shouldn't normally happen)
			sourceTasks.forEach((task) => {
				const sourceTagTasks = tasksInSourceTag;
				const targetTagTasks = Array.isArray(allTasks)
					? allTasks.filter((t) => t && t.tag === targetTag)
					: [];
				task.dependencies = task.dependencies.filter((depId) => {
					const parentTaskId = normalizeDependency(depId);

					// If dependency resolves to a task in the source tag, drop it (would be cross-tag after move)
					if (
						Number.isFinite(parentTaskId) &&
						sourceTagTasks.some((t) => t.id === parentTaskId)
					) {
						return false;
					}

					// If dependency resolves to a task in the target tag, keep it
					if (
						Number.isFinite(parentTaskId) &&
						targetTagTasks.some((t) => t.id === parentTaskId)
					) {
						return true;
					}

					// Otherwise, keep as-is (unknown/unresolved dependency)
					return true;
				});
			});

			log(
				'warn',
				`Removed ${crossTagDependencies.length} cross-tag dependencies`
			);

			return {
				tasksToMove: taskIds,
				dependencyResolution: {
					type: 'ignored-dependencies',
					conflicts: crossTagDependencies
				}
			};
		} else {
			// Block move and show error
			throw new MoveTaskError(
				MOVE_ERROR_CODES.CROSS_TAG_DEPENDENCY_CONFLICTS,
				`Cannot move tasks: ${crossTagDependencies.length} cross-tag dependency conflicts found`,
				{
					conflicts: crossTagDependencies,
					sourceTag,
					targetTag,
					taskIds
				}
			);
		}
	}

	return {
		tasksToMove: taskIds,
		dependencyResolution: { type: 'no-conflicts' }
	};
}

/**
 * Execute the actual move operation
 * @param {Array} tasksToMove - Array of task IDs to move
 * @param {string} sourceTag - Source tag name
 * @param {string} targetTag - Target tag name
 * @param {Object} rawData - Raw data object
 * @param {Object} context - Context object
 * @param {string} tasksPath - Path to tasks.json file
 * @returns {Object} Move operation result
 */
async function executeMoveOperation(
	tasksToMove,
	sourceTag,
	targetTag,
	rawData,
	context,
	tasksPath
) {
	const { projectRoot } = context;
	const movedTasks = [];

	// Move each task from source to target tag
	for (const taskId of tasksToMove) {
		// Normalize taskId to number for comparison
		const normalizedTaskId =
			typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;

		const sourceTaskIndex = rawData[sourceTag].tasks.findIndex(
			(t) => t.id === normalizedTaskId
		);

		if (sourceTaskIndex === -1) {
			throw new MoveTaskError(
				MOVE_ERROR_CODES.TASK_NOT_FOUND,
				`Task ${taskId} not found in source tag "${sourceTag}"`
			);
		}

		const taskToMove = rawData[sourceTag].tasks[sourceTaskIndex];

		// Check for ID conflicts in target tag
		const existingTaskIndex = rawData[targetTag].tasks.findIndex(
			(t) => t.id === normalizedTaskId
		);
		if (existingTaskIndex !== -1) {
			throw new MoveTaskError(
				MOVE_ERROR_CODES.TASK_ALREADY_EXISTS,
				`Task ${taskId} already exists in target tag "${targetTag}"`,
				{
					conflictingId: normalizedTaskId,
					targetTag,
					suggestions: [
						'Choose a different target tag without conflicting IDs',
						'Move a different set of IDs (avoid existing ones)',
						'If needed, move within-tag to a new ID first, then cross-tag move'
					]
				}
			);
		}

		// Remove from source tag
		rawData[sourceTag].tasks.splice(sourceTaskIndex, 1);

		// Preserve task metadata and add to target tag
		const taskWithPreservedMetadata = preserveTaskMetadata(
			taskToMove,
			sourceTag,
			targetTag
		);
		rawData[targetTag].tasks.push(taskWithPreservedMetadata);

		movedTasks.push({
			id: taskId,
			fromTag: sourceTag,
			toTag: targetTag
		});

		log('info', `Moved task ${taskId} from "${sourceTag}" to "${targetTag}"`);
	}

	return { rawData, movedTasks };
}

/**
 * Finalize the move operation by saving data and returning result
 * @param {Object} moveResult - Result from executeMoveOperation
 * @param {string} tasksPath - Path to tasks.json file
 * @param {Object} context - Context object
 * @param {string} sourceTag - Source tag name
 * @param {string} targetTag - Target tag name
 * @returns {Object} Final result object
 */
async function finalizeMove(
	moveResult,
	tasksPath,
	context,
	sourceTag,
	targetTag,
	dependencyResolution
) {
	const { projectRoot } = context;
	const { rawData, movedTasks } = moveResult;

	// Write the updated data
	writeJSON(tasksPath, rawData, projectRoot, null);

	const response = {
		message: `Successfully moved ${movedTasks.length} tasks from "${sourceTag}" to "${targetTag}"`,
		movedTasks
	};

	// If we intentionally broke cross-tag dependencies, provide tips to validate & fix
	if (
		dependencyResolution &&
		dependencyResolution.type === 'ignored-dependencies'
	) {
		response.tips = [
			'Run "task-master validate-dependencies" to check for dependency issues.',
			'Run "task-master fix-dependencies" to automatically repair dangling dependencies.'
		];
	}

	return response;
}

/**
 * Move tasks between different tags with dependency handling
 * @param {string} tasksPath - Path to tasks.json file
 * @param {Array} taskIds - Array of task IDs to move
 * @param {string} sourceTag - Source tag name
 * @param {string} targetTag - Target tag name
 * @param {Object} options - Move options
 * @param {boolean} options.withDependencies - Move dependent tasks along with main task
 * @param {boolean} options.ignoreDependencies - Break cross-tag dependencies during move
 * @param {Object} context - Context object containing projectRoot and tag information
 * @returns {Object} Result object with moved task details
 */
async function moveTasksBetweenTags(
	tasksPath,
	taskIds,
	sourceTag,
	targetTag,
	options = {},
	context = {}
) {
	// 1. Validation phase
	const validation = await validateMove(
		tasksPath,
		taskIds,
		sourceTag,
		targetTag,
		context
	);

	// 2. Load and prepare data
	const { rawData, sourceTasks, allTasks } = await prepareTaskData(validation);

	// 3. Handle dependencies
	const { tasksToMove, dependencyResolution } = await resolveDependencies(
		sourceTasks,
		allTasks,
		options,
		taskIds,
		sourceTag,
		targetTag
	);

	// 4. Execute move
	const moveResult = await executeMoveOperation(
		tasksToMove,
		sourceTag,
		targetTag,
		rawData,
		context,
		tasksPath
	);

	// 5. Save and return
	return await finalizeMove(
		moveResult,
		tasksPath,
		context,
		sourceTag,
		targetTag,
		dependencyResolution
	);
}

/**
 * Detect ID conflicts in target tag
 * @param {Array} taskIds - Array of task IDs to check
 * @param {string} targetTag - Target tag name
 * @param {Object} rawData - Raw data object
 * @returns {Array} Array of conflicting task IDs
 */
function detectIdConflicts(taskIds, targetTag, rawData) {
	const conflicts = [];

	if (!rawData[targetTag] || !Array.isArray(rawData[targetTag].tasks)) {
		return conflicts;
	}

	taskIds.forEach((taskId) => {
		// Normalize taskId to number for comparison
		const normalizedTaskId =
			typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
		const existingTask = rawData[targetTag].tasks.find(
			(t) => t.id === normalizedTaskId
		);
		if (existingTask) {
			conflicts.push(taskId);
		}
	});

	return conflicts;
}

/**
 * Preserve task metadata during cross-tag moves
 * @param {Object} task - Task object
 * @param {string} sourceTag - Source tag name
 * @param {string} targetTag - Target tag name
 * @returns {Object} Task object with preserved metadata
 */
function preserveTaskMetadata(task, sourceTag, targetTag) {
	// Update the tag property to reflect the new location
	task.tag = targetTag;

	// Add move history to task metadata
	if (!task.metadata) {
		task.metadata = {};
	}

	if (!task.metadata.moveHistory) {
		task.metadata.moveHistory = [];
	}

	task.metadata.moveHistory.push({
		fromTag: sourceTag,
		toTag: targetTag,
		timestamp: new Date().toISOString()
	});

	return task;
}

export default moveTask;
export {
	moveTasksBetweenTags,
	getAllTasksWithTags,
	detectIdConflicts,
	preserveTaskMetadata,
	MoveTaskError,
	MOVE_ERROR_CODES
};
