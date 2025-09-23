/**
 * Checks if a task with the given ID exists
 * @param {Array} tasks - Array of tasks to search
 * @param {string|number} taskId - ID of task or subtask to check
 * @returns {boolean} Whether the task exists
 */
function taskExists(tasks, taskId) {
	// Handle subtask IDs (e.g., "1.2")
	if (typeof taskId === 'string' && taskId.includes('.')) {
		const parts = taskId.split('.');
		// Validate that it's a proper subtask format (parentId.subtaskId)
		if (parts.length !== 2 || !parts[0] || !parts[1]) {
			// Invalid format - treat as regular task ID
			const id = parseInt(taskId, 10);
			return tasks.some((t) => t.id === id);
		}

		const [parentIdStr, subtaskIdStr] = parts;
		const parentId = parseInt(parentIdStr, 10);
		const subtaskId = parseInt(subtaskIdStr, 10);

		// Find the parent task
		const parentTask = tasks.find((t) => t.id === parentId);

		// If parent exists, check if subtask exists
		return (
			parentTask &&
			parentTask.subtasks &&
			parentTask.subtasks.some((st) => st.id === subtaskId)
		);
	}

	// Handle regular task IDs
	const id = parseInt(taskId, 10);
	return tasks.some((t) => t.id === id);
}

export default taskExists;
