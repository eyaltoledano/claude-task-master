/**
 * reference-id-service.js
 * Service for generating and managing reference IDs for tasks and subtasks
 */

import { log } from './utils.js';
import { getJiraIntegrationEnabled } from './config-manager.js';

// Prefix for user stories
const USER_STORY_PREFIX = 'US';
// Prefix for tasks
const TASK_PREFIX = 'T';

/**
 * Generate a reference ID for a user story
 * @param {number} taskId - Task ID
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {string} Reference ID for the user story (e.g., US-001)
 */
function generateUserStoryRefId(taskId, explicitRoot = null) {
	if (!getJiraIntegrationEnabled(explicitRoot)) {
		return null;
	}

	// Format the task ID with leading zeros (e.g., 001, 012, 123)
	const formattedId = String(taskId).padStart(3, '0');
	return `${USER_STORY_PREFIX}${formattedId}`;
}

/**
 * Generate a reference ID for a subtask
 * @param {number} parentTaskId - Parent task ID
 * @param {number} subtaskId - Subtask ID
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {string} Reference ID for the subtask (e.g., T001-01)
 */
function generateSubtaskRefId(parentTaskId, subtaskId, explicitRoot = null) {
	if (!getJiraIntegrationEnabled(explicitRoot)) {
		return null;
	}

	// Format the parent task ID with leading zeros (e.g., 001, 012, 123)
	const formattedParentId = String(parentTaskId).padStart(3, '0');
	// Format the subtask ID with leading zeros (e.g., 01, 02, 10)
	const formattedSubtaskId = String(subtaskId).padStart(2, '0');
	// Keep the hyphen between parent and subtask IDs
	return `${TASK_PREFIX}${formattedParentId}-${formattedSubtaskId}`;
}

/**
 * Extract reference ID from a task title
 * @param {string} title - Task title
 * @returns {string|null} Reference ID if found, null otherwise
 */
function extractRefIdFromTitle(title) {
	if (!title) return null;

	// Match patterns like US001- or T001-01- at the beginning of the title
	const match = title.match(/^((?:US\d{3})|(?:T\d{3}-\d{2}))-/);
	return match ? match[1] : null;
}

/**
 * Store reference ID in task metadata
 * @param {Object} task - Task object
 * @param {string} refId - Reference ID to store
 * @returns {Object} Updated task object
 */
function storeRefId(task, refId) {
	if (!task || !refId) return task;

	// Initialize metadata if it doesn't exist
	if (!task.metadata) {
		task.metadata = {};
	}

	// Store reference ID in metadata
	task.metadata.refId = refId;

	return task;
}

/**
 * Get reference ID from task metadata
 * @param {Object} task - Task object
 * @returns {string|null} Reference ID or null if not found
 */
function getRefId(task) {
	return task?.metadata?.refId || null;
}

/**
 * Format task title with reference ID for Jira
 * @param {Object} task - Task object
 * @returns {string} Formatted title with reference ID for Jira
 */
function formatTitleForJira(task) {
	if (!task || !task.title) return '';

	const refId = getRefId(task);
	if (!refId) return task.title;

	// Format as 'US001-Title' instead of '[US-001] Title'
	return `${refId}-${task.title}`;
}

/**
 * Find a task by reference ID in the tasks array
 * @param {Array} tasks - Array of tasks
 * @param {string} refId - Reference ID to search for
 * @returns {Object|null} Task object if found, null otherwise
 */
function findTaskByRefId(tasks, refId) {
	if (!tasks || !Array.isArray(tasks) || !refId) return null;

	// Search for the task with the matching reference ID in metadata
	for (const task of tasks) {
		const taskRefId = getRefId(task);
		if (taskRefId === refId) {
			return task;
		}

		// Also search in subtasks if available
		if (task.subtasks && Array.isArray(task.subtasks)) {
			for (const subtask of task.subtasks) {
				const subtaskRefId = getRefId(subtask);
				if (subtaskRefId === refId) {
					return subtask;
				}
			}
		}

		// Fallback to searching in titles if metadata is missing
		// This helps in migrating from old format to new format
		const oldFormatRefId = refId
			.replace(/US(\d{3})/, 'US-$1')
			.replace(/T(\d{3}-\d{2})/, 'T$1');
		for (const task of tasks) {
			const title = task.title || '';
			if (title.includes(`[${oldFormatRefId}]`)) {
				return task;
			}

			// Also check subtasks
			if (task.subtasks && Array.isArray(task.subtasks)) {
				for (const subtask of task.subtasks) {
					const subtaskTitle = subtask.title || '';
					if (subtaskTitle.includes(`[${oldFormatRefId}]`)) {
						return subtask;
					}
				}
			}
		}
	}

	return null;
}

export {
	generateUserStoryRefId,
	generateSubtaskRefId,
	extractRefIdFromTitle,
	storeRefId,
	getRefId,
	formatTitleForJira,
	findTaskByRefId
};
