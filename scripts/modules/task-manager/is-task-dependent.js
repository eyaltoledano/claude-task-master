/**
 * Check if a task is dependent on another task (directly or indirectly)
 * Used to prevent circular dependencies
 * @param {Array} allTasks - Array of all tasks
 * @param {Object} task - The task to check
 * @param {number} targetTaskId - The task ID to check dependency against
 * @returns {boolean} Whether the task depends on the target task
 */
function isTaskDependentOn(allTasks, task, targetTaskId) {
	// If the task is a subtask, check if its parent is the target
	if (task.parentTaskId === targetTaskId) {
		return true;
	}

	// Check direct dependencies
	if (task.dependencies && task.dependencies.includes(targetTaskId)) {
		return true;
	}

	// Check dependencies of dependencies (recursive)
	if (task.dependencies) {
		for (const depId of task.dependencies) {
			const depTask = allTasks.find((t) => t.id === depId);
			if (depTask && isTaskDependentOn(allTasks, depTask, targetTaskId)) {
				return true;
			}
		}
	}

	// Check subtasks for dependencies
	if (task.subtasks) {
		for (const subtask of task.subtasks) {
			if (isTaskDependentOn(allTasks, subtask, targetTaskId)) {
				return true;
			}
		}
	}

	return false;
}

export default isTaskDependentOn;
