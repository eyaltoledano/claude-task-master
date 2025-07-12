import path from 'path';
import fs from 'fs';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js'; // Path relative to new file
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js'; // Path relative to new file
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js'; // Path relative to new file
// No specific parser needed if agent returns a complete task object as per AiTaskDataSchema (used in core addTask)
// If agent returns a string, parsing would be needed here. Assume agent returns object for now.

/**
 * Saves a new task (data typically from an agent) to tasks.json.
 *
 * @param {Object} agentTaskData - The task data object from the agent (finalLLMOutput).
 *                                 Expected to largely conform to AiTaskDataSchema
 *                                 (title, description, details, testStrategy, dependencies?).
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {Object} logWrapper - Logger object (e.g., from MCP context).
 * @param {Object} originalToolArgs - Original arguments passed to the 'add_task' tool (e.g., prompt, user-specified title, dependencies, priority).
 * @param {Object} delegatedRequestParams - Parameters that were part of the delegation request to the agent,
 *                                          includes { newTaskId, userDependencies, userPriority } passed by core 'addTask'.
 * @returns {Promise<Object>} Result object with { success: true, newTask } or { success: false, error: string }.
 */
async function saveNewTaskFromAgent(
	agentTaskData,
	projectRoot,
	logWrapper,
	originalToolArgs,
	delegatedRequestParams
) {
	logWrapper.info(`saveNewTaskFromAgent: Saving new task data from agent.`);

	const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);

	try {
		if (!agentTaskData || typeof agentTaskData !== 'object') {
			const errorMsg = `Invalid agentTaskData structure. Expected an object. Received: ${JSON.stringify(agentTaskData)}`;
			logWrapper.error(`saveNewTaskFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		// Essential parameters from the delegation context
		const newTaskId = delegatedRequestParams?.newTaskId;
		const userDependencies = delegatedRequestParams?.userDependencies || []; // From core 'addTask'
		const userPriority = delegatedRequestParams?.userPriority || 'medium'; // From core 'addTask'

		if (typeof newTaskId !== 'number') {
			const errorMsg = `Missing or invalid newTaskId in delegatedRequestParams.`;
			logWrapper.error(`saveNewTaskFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		// Construct the new task object
		// Agent provides: title, description, details, testStrategy, optionally dependencies
		// We take some base structure and override with agent's data, then enforce some things.
		const newTask = {
			id: newTaskId,
			title:
				agentTaskData.title ||
				originalToolArgs.prompt ||
				'Untitled Task from Agent', // Ensure title exists
			description: agentTaskData.description || originalToolArgs.prompt || '',
			details: agentTaskData.details || '',
			testStrategy: agentTaskData.testStrategy || '',
			status: 'pending',
			dependencies: Array.isArray(agentTaskData.dependencies)
				? agentTaskData.dependencies
				: userDependencies,
			priority: userPriority, // Priority usually set by user or default, not AI for add_task
			subtasks: [] // New tasks start with no subtasks
		};

		// TODO: Add Zod validation for 'newTask' against a schema if desired,
		// similar to how parseUpdatedTaskFromText uses updatedTaskSchema.
		// For now, we assume the agent provides fields aligning with AiTaskDataSchema.

		let allTasksData = readJSON(tasksJsonPath); // Changed from const to let
		if (!allTasksData || !Array.isArray(allTasksData.tasks)) {
			// If tasks.json is missing or invalid, initialize it
			logWrapper.warn(
				`saveNewTaskFromAgent: Invalid or missing tasks data in ${tasksJsonPath}. Initializing new tasks array.`
			);
			allTasksData = { tasks: [] };
		}

		// Check for ID collision (shouldn't happen if newTaskId is determined correctly)
		if (allTasksData.tasks.some((t) => t.id === newTask.id)) {
			const errorMsg = `Task ID ${newTask.id} already exists. Cannot add task.`;
			logWrapper.error(`saveNewTaskFromAgent: ${errorMsg}`);
			// This indicates a flaw in newTaskId generation or state management.
			return { success: false, error: errorMsg };
		}

		allTasksData.tasks.push(newTask);
		// Sort tasks by ID for consistency, optional
		allTasksData.tasks.sort((a, b) => a.id - b.id);

		writeJSON(tasksJsonPath, allTasksData);
		logWrapper.info(
			`saveNewTaskFromAgent: Successfully added new task ID ${newTask.id} to ${tasksJsonPath}.`
		);

		const outputDir = path.dirname(tasksJsonPath);
		await generateTaskFiles(tasksJsonPath, outputDir, { mcpLog: logWrapper });
		logWrapper.info(`saveNewTaskFromAgent: Markdown task files regenerated.`);

		return { success: true, newTask };
	} catch (error) {
		logWrapper.error(
			`saveNewTaskFromAgent: Error saving new task: ${error.message}`
		);
		logWrapper.error(`saveNewTaskFromAgent: Error stack: ${error.stack}`);
		return { success: false, error: error.message };
	}
}

export { saveNewTaskFromAgent };
