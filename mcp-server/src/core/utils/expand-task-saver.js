import path from 'path';
import fs from 'fs';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js'; // Path relative to new file
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js'; // Path relative to new file
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js'; // Path relative to new file
import { parseSubtasksFromText } from '../../../../scripts/modules/task-manager/expand-task.js'; // For parsing if agent returns text

/**
 * Saves expanded subtask data (typically from an agent) to the parent task in tasks.json.
 *
 * @param {any} agentOutput - The data received from the agent (finalLLMOutput).
 *                            Expected to be an array of subtask objects, or a string that parseSubtasksFromText can handle.
 * @param {string|number} parentTaskId - The ID of the task being expanded.
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {Object} logWrapper - Logger object (e.g., from MCP context).
 * @param {Object} originalTaskDetails - Details about the original task being expanded,
 *                                       including numSubtasks requested and original subtask count.
 * @param {number} originalTaskDetails.numSubtasks - The number of subtasks the agent was asked to generate.
 * @param {number} originalTaskDetails.nextSubtaskId - The starting ID for new subtasks.
 * @returns {Promise<Object>} Result object with { success: true } or { success: false, error: string }.
 */
async function saveExpandedTaskData(
	agentOutput,
	parentTaskIdNum,
	projectRoot,
	logWrapper,
	originalTaskDetails
) {
	logWrapper.info(
		`saveExpandedTaskData: Saving subtasks for parent task ID ${parentTaskIdNum}.`
	);

	const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);

	try {
		const allTasksData = readJSON(tasksJsonPath);
		if (!allTasksData || !Array.isArray(allTasksData.tasks)) {
			const errorMsg = `Invalid or missing tasks data in ${tasksJsonPath}.`;
			logWrapper.error(`saveExpandedTaskData: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const taskIndex = allTasksData.tasks.findIndex(
			(t) => t.id === parentTaskIdNum
		);
		if (taskIndex === -1) {
			const errorMsg = `Parent task with ID ${parentTaskIdNum} not found in ${tasksJsonPath}.`;
			logWrapper.error(`saveExpandedTaskData: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const parentTask = allTasksData.tasks[taskIndex];

		let subtasksToSave;
		if (typeof agentOutput === 'string') {
			logWrapper.info(
				'saveExpandedTaskData: Agent output is a string, attempting to parse with parseSubtasksFromText.'
			);
			// The parseSubtasksFromText function needs: text, startId, expectedCount, parentTaskId (for logging), logger
			// We need to ensure these values are correctly passed or determined.
			// originalTaskDetails should contain numSubtasks (expectedCount) and nextSubtaskId (startId)
			subtasksToSave = parseSubtasksFromText(
				agentOutput,
				originalTaskDetails.nextSubtaskId,
				originalTaskDetails.numSubtasks,
				parentTaskIdNum,
				logWrapper
			);
		} else if (Array.isArray(agentOutput)) {
			logWrapper.info(
				'saveExpandedTaskData: Agent output is already an array of subtasks.'
			);
			// If agentOutput is already an array of subtasks (e.g., if generateObjectService was used by agent)
			// We might still want to validate/normalize them here if parseSubtasksFromText usually does that.
			// For now, assume they are in the correct format if it's an array.
			// TODO: Consider adding validation similar to what parseSubtasksFromText does if agent provides raw array.
			subtasksToSave = agentOutput;
		} else if (agentOutput && Array.isArray(agentOutput.subtasks)) {
			logWrapper.info(
				"saveExpandedTaskData: Agent output is an object with a 'subtasks' array."
			);
			subtasksToSave = agentOutput.subtasks;
			// TODO: Consider adding validation similar to what parseSubtasksFromText does.
		} else {
			const errorMsg =
				"Invalid agentOutput format. Expected a JSON string of subtasks, an array of subtasks, or an object with a 'subtasks' array.";
			logWrapper.error(
				`saveExpandedTaskData: ${errorMsg} Received: ${JSON.stringify(agentOutput)}`
			);
			return { success: false, error: errorMsg };
		}

		if (!Array.isArray(subtasksToSave)) {
			const errorMsg = `Subtask parsing or processing resulted in non-array: ${JSON.stringify(subtasksToSave)}`;
			logWrapper.error(`saveExpandedTaskData: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		logWrapper.info(
			`saveExpandedTaskData: Originally ${parentTask.subtasks ? parentTask.subtasks.length : 0} subtasks. Received ${subtasksToSave.length} new subtasks from agent.`
		);

		// Logic for handling subtasks: usually expand-task appends or replaces based on a 'force' flag.
		// The original expandTask (scripts/modules/...) handles force by clearing subtasks *before* calling AI.
		// So, here we should just append, as any clearing due to 'force' would have happened before delegation.
		if (!Array.isArray(parentTask.subtasks)) {
			parentTask.subtasks = [];
		}
		parentTask.subtasks.push(...subtasksToSave);

		allTasksData.tasks[taskIndex] = parentTask;

		writeJSON(tasksJsonPath, allTasksData);
		logWrapper.info(
			`saveExpandedTaskData: Successfully updated tasks.json for parent task ${parentTaskIdNum} with ${subtasksToSave.length} subtasks.`
		);

		// Generate individual task files (optional, but good for consistency)
		// This generateTaskFiles is for the main tasks.json, not specific to subtasks here.
		// It regenerates all task files based on the updated tasks.json.
		const outputDir = path.dirname(tasksJsonPath);
		await generateTaskFiles(tasksJsonPath, outputDir, { mcpLog: logWrapper });
		logWrapper.info(
			`saveExpandedTaskData: Markdown task files regenerated after updating subtasks.`
		);

		return { success: true, updatedParentTask: parentTask };
	} catch (error) {
		logWrapper.error(
			`saveExpandedTaskData: Error processing subtasks for parent task ${parentTaskIdNum}: ${error.message}`
		);
		logWrapper.error(`saveExpandedTaskData: Error stack: ${error.stack}`);
		return { success: false, error: error.message };
	}
}

export { saveExpandedTaskData };
