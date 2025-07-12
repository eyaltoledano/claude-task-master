import path from 'path';
import fs from 'fs';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js';
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';

/**
 * Appends details (typically from an agent) to a specific subtask in tasks.json.
 *
 * @param {string} agentOutputString - The plain text string from the agent.
 * @param {string} subtaskIdToUpdate - The ID of the subtask (e.g., "1.5").
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {Object} logWrapper - Logger object.
 * @param {Object} originalToolArgs - Original arguments passed to the 'update_subtask' tool (contains the original prompt).
 * @returns {Promise<Object>} Result object with { success: true, updatedSubtaskId } or { success: false, error: string }.
 */
async function saveSubtaskDetailsFromAgent(
	agentOutputString,
	subtaskIdToUpdate,
	projectRoot,
	logWrapper,
	originalToolArgs
) {
	logWrapper.info(
		`saveSubtaskDetailsFromAgent: Appending details to subtask ID ${subtaskIdToUpdate}.`
	);

	if (typeof agentOutputString !== 'string') {
		const errorMsg =
			'Invalid agentOutputString format. Expected a plain text string.';
		logWrapper.error(
			`saveSubtaskDetailsFromAgent: ${errorMsg} Received type: ${typeof agentOutputString}`
		);
		return { success: false, error: errorMsg };
	}

	if (!agentOutputString || agentOutputString.trim() === '') {
		logWrapper.warn(
			`saveSubtaskDetailsFromAgent: Agent output string is empty for subtask ${subtaskIdToUpdate}. No details will be appended.`
		);
		return {
			success: true,
			updatedSubtaskId: subtaskIdToUpdate,
			message: 'Agent output was empty, no details appended.'
		};
	}

	const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);

	try {
		const allTasksData = readJSON(tasksJsonPath);
		if (!allTasksData || !Array.isArray(allTasksData.tasks)) {
			const errorMsg = `Invalid or missing tasks data in ${tasksJsonPath}.`;
			logWrapper.error(`saveSubtaskDetailsFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const [parentIdStr, subIdStr] = subtaskIdToUpdate.split('.');
		const parentId = parseInt(parentIdStr, 10);
		const subId = parseInt(subIdStr, 10);

		if (isNaN(parentId) || isNaN(subId)) {
			const errorMsg = `Invalid subtask ID format: ${subtaskIdToUpdate}. Could not parse parent/sub IDs.`;
			logWrapper.error(`saveSubtaskDetailsFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const parentTaskIndex = allTasksData.tasks.findIndex(
			(t) => t.id === parentId
		);
		if (parentTaskIndex === -1) {
			const errorMsg = `Parent task ${parentId} for subtask ${subtaskIdToUpdate} not found.`;
			logWrapper.error(`saveSubtaskDetailsFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const parentTask = allTasksData.tasks[parentTaskIndex];
		if (!parentTask.subtasks || !Array.isArray(parentTask.subtasks)) {
			const errorMsg = `Parent task ${parentId} has no subtasks array for subtask ${subtaskIdToUpdate}.`;
			logWrapper.error(`saveSubtaskDetailsFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const subtaskIndex = parentTask.subtasks.findIndex((st) => st.id === subId);
		if (subtaskIndex === -1) {
			const errorMsg = `Subtask ${subtaskIdToUpdate} not found within parent task ${parentId}.`;
			logWrapper.error(`saveSubtaskDetailsFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const subtask = parentTask.subtasks[subtaskIndex];

		if (subtask.status === 'done' || subtask.status === 'completed') {
			logWrapper.warn(
				`saveSubtaskDetailsFromAgent: Subtask ${subtaskIdToUpdate} is already '${subtask.status}'. Details will not be appended.`
			);
			return {
				success: true,
				updatedSubtaskId: subtaskIdToUpdate,
				message: `Subtask was already ${subtask.status}. No details appended.`
			};
		}

		// Format and append the agent's output string
		const timestamp = new Date().toISOString();
		const formattedBlock = `<info added on ${timestamp}>
${agentOutputString.trim()}
</info added on ${timestamp}>`;

		subtask.details =
			(subtask.details ? subtask.details.trim() + '\n\n' : '') + formattedBlock;
		logWrapper.info(
			`saveSubtaskDetailsFromAgent: Appended details to subtask ${subtaskIdToUpdate}.`
		);

		// Optionally, update description based on original prompt length (mimicking original updateSubtaskById logic)
		const originalUserPrompt = originalToolArgs?.prompt || '';
		if (subtask.description && originalUserPrompt.length < 100) {
			subtask.description += ` [Updated: ${new Date().toLocaleDateString()}]`;
			logWrapper.info(
				`saveSubtaskDetailsFromAgent: Appended update marker to description for subtask ${subtaskIdToUpdate}.`
			);
		}

		allTasksData.tasks[parentTaskIndex].subtasks[subtaskIndex] = subtask;

		writeJSON(tasksJsonPath, allTasksData);
		logWrapper.info(
			`saveSubtaskDetailsFromAgent: Successfully updated tasks.json for subtask ID ${subtaskIdToUpdate}.`
		);

		const outputDir = path.dirname(tasksJsonPath);
		await generateTaskFiles(tasksJsonPath, outputDir, { mcpLog: logWrapper });
		logWrapper.info(
			`saveSubtaskDetailsFromAgent: Markdown task files regenerated.`
		);

		return {
			success: true,
			updatedSubtaskId: subtaskIdToUpdate,
			appendedDetails: formattedBlock
		};
	} catch (error) {
		logWrapper.error(
			`saveSubtaskDetailsFromAgent: Error processing update for subtask ID ${subtaskIdToUpdate}: ${error.message}`
		);
		logWrapper.error(
			`saveSubtaskDetailsFromAgent: Error stack: ${error.stack}`
		);
		return { success: false, error: error.message };
	}
}

export { saveSubtaskDetailsFromAgent };
