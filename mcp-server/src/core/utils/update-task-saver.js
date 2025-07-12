import path from 'path';
import fs from 'fs';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js'; // Path relative to new file
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js'; // Path relative to new file
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js'; // Path relative to new file
// Import the parser from the core updateTaskById script
import { parseUpdatedTaskFromText } from '../../../../scripts/modules/task-manager/update-task-by-id.js';

/**
 * Saves updated task data (typically from an agent) to tasks.json.
 * This includes parsing the agent's output and applying updates carefully,
 * especially preserving completed subtasks.
 *
 * @param {any} agentOutput - The data received from the agent (finalLLMOutput).
 *                            Expected to be a JSON string of the updated task object.
 * @param {string|number} taskIdToUpdate - The ID of the task being updated (can be "parent.sub" string or number).
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {Object} logWrapper - Logger object (e.g., from MCP context).
 * @param {Object} originalToolArgs - Original arguments passed to the 'update_task' tool. (Currently not used here but good for future if needed for context)
 * @returns {Promise<Object>} Result object with { success: true, updatedTask } or { success: false, error: string }.
 */
async function saveUpdatedTaskFromAgent(
	agentOutput,
	taskIdToUpdate,
	projectRoot,
	logWrapper,
	originalToolArgs
) {
	logWrapper.info(
		`saveUpdatedTaskFromAgent: Saving updated task data for ID ${taskIdToUpdate}.`
	);

	const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);

	try {
		const allTasksData = readJSON(tasksJsonPath);
		if (!allTasksData || !Array.isArray(allTasksData.tasks)) {
			const errorMsg = `Invalid or missing tasks data in ${tasksJsonPath}.`;
			logWrapper.error(`saveUpdatedTaskFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		let parsedAgentTask; // This will hold the object to merge (if full update) or be null (if append)
		let taskToUpdateObject; // This will hold the reference to the task/subtask in allTasksData.tasks
		let directAppendText = null; // Holds text for direct append if applicable

		// Find the task/subtask first to get its current details for append mode
		if (typeof taskIdToUpdate === 'string' && taskIdToUpdate.includes('.')) {
			const [parentIdStr, subIdStr] = taskIdToUpdate.split('.');
			const parentId = parseInt(parentIdStr, 10);
			const subId = parseInt(subIdStr, 10);
			const parentTask = allTasksData.tasks.find((t) => t.id === parentId);
			if (!parentTask || !parentTask.subtasks)
				throw new Error(
					`Parent task or subtasks for ${taskIdToUpdate} not found.`
				);
			taskToUpdateObject = parentTask.subtasks.find((st) => st.id === subId);
		} else {
			taskToUpdateObject = allTasksData.tasks.find(
				(t) => t.id === parseInt(String(taskIdToUpdate), 10)
			);
		}

		if (!taskToUpdateObject) {
			const errorMsg = `Task/subtask ID ${taskIdToUpdate} not found for update.`;
			logWrapper.error(`saveUpdatedTaskFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		// Check if originalToolArgs indicates append mode (e.g., originalToolArgs.append === true)
		// This assumes 'append' is passed in originalToolArgs if that was the intent.
		const isAppendMode = originalToolArgs && originalToolArgs.append === true;

		if (typeof agentOutput === 'string') {
			if (isAppendMode) {
				logWrapper.info(
					'saveUpdatedTaskFromAgent: Agent output is a string and appendMode is true. Formatting for append.'
				);
				const timestamp = new Date().toISOString();
				directAppendText = `<info added on ${timestamp}>\n${agentOutput.trim()}\n</info added on ${timestamp}>`;
				// parsedAgentTask remains undefined, as we'll modify taskToUpdateObject directly
			} else {
				logWrapper.info(
					'saveUpdatedTaskFromAgent: Agent output is a string and not appendMode. Attempting to parse with parseUpdatedTaskFromText.'
				);
				const idForParser =
					typeof taskIdToUpdate === 'string' && taskIdToUpdate.includes('.')
						? taskIdToUpdate
						: parseInt(String(taskIdToUpdate), 10);
				parsedAgentTask = parseUpdatedTaskFromText(
					agentOutput,
					idForParser,
					logWrapper,
					true /* isMCP */
				);
			}
		} else if (typeof agentOutput === 'object' && agentOutput !== null) {
			logWrapper.info(
				'saveUpdatedTaskFromAgent: Agent output is already an object. Validating and using directly.'
			);
			// If agent returns an object, we might still want to run it through a Zod schema or similar validation.
			// For now, assuming it matches the structure `parseUpdatedTaskFromText` would produce.
			// The `parseUpdatedTaskFromText` itself does Zod validation.
			// We'd need to replicate that validation or trust the agent / have the agent use the Zod schema.
			// Let's assume for now the agent provides a valid task object as per schema if not string.
			// TODO: Add Zod validation here if agentOutput is an object.
			// For simplicity, if it's an object, we'll assume it's the task object directly.
			// This part might need refinement based on how agents will actually return structured objects.
			parsedAgentTask = agentOutput;
			if (parsedAgentTask.id !== taskIdToUpdate) {
				// Ensure ID consistency
				logWrapper.warn(
					`Agent output object had ID ${parsedAgentTask.id}, expected ${taskIdToUpdate}. Overwriting ID.`
				);
				parsedAgentTask.id = taskIdToUpdate;
			}
		} else {
			const errorMsg =
				'Invalid agentOutput format. Expected a JSON string or a task object.';
			logWrapper.error(
				`saveUpdatedTaskFromAgent: ${errorMsg} Received type: ${typeof agentOutput}`
			);
			return { success: false, error: errorMsg };
		}

		// If directAppendText is set, it means we are in append mode with a string from agent
		if (directAppendText) {
			if (
				taskToUpdateObject.status === 'done' ||
				taskToUpdateObject.status === 'completed'
			) {
				logWrapper.warn(
					`saveUpdatedTaskFromAgent: Task/subtask ${taskIdToUpdate} is completed. Cannot append text.`
				);
				return {
					success: true,
					updatedTask: taskToUpdateObject,
					wasActuallyUpdated: false
				};
			}
			taskToUpdateObject.details =
				(taskToUpdateObject.details
					? taskToUpdateObject.details + '\n\n'
					: '') + directAppendText;
			logWrapper.info(
				`saveUpdatedTaskFromAgent: Appended text to task/subtask ${taskIdToUpdate}.`
			);

			writeJSON(tasksJsonPath, allTasksData); // Save the entire tasks structure
			const outputDir = path.dirname(tasksJsonPath);
			await generateTaskFiles(tasksJsonPath, outputDir, { mcpLog: logWrapper });
			logWrapper.info(
				`saveUpdatedTaskFromAgent: Markdown task files regenerated after append.`
			);
			return {
				success: true,
				updatedTask: taskToUpdateObject,
				wasActuallyUpdated: true
			};
		}

		// If not direct append, then parsedAgentTask should be an object (either from parsing or direct object input)
		if (!parsedAgentTask || typeof parsedAgentTask !== 'object') {
			// This case implies that it was not append mode, but parsing failed or agentOutput was not a valid object.
			const errorMsg = `Task data from agent is invalid for full update after parsing/processing: ${JSON.stringify(parsedAgentTask)}`;
			logWrapper.error(`saveUpdatedTaskFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		// Logic to find and update the task (main task or subtask) using parsedAgentTask for a full update
		let taskUpdated = false;
		let finalUpdatedTaskForReturn = null; // This will be taskToUpdateObject after modifications

		if (
			taskToUpdateObject.status === 'done' ||
			taskToUpdateObject.status === 'completed'
		) {
			logWrapper.warn(
				`saveUpdatedTaskFromAgent: Task/subtask ${taskIdToUpdate} is completed and was not updated by agent during full update attempt.`
			);
			finalUpdatedTaskForReturn = taskToUpdateObject;
		} else {
			// Apply full update logic
			if (typeof taskIdToUpdate === 'string' && taskIdToUpdate.includes('.')) {
				// Handling subtask update (taskToUpdateObject is the subtask)
				const [parentIdStr, subIdStr] = taskIdToUpdate.split('.');
				const parentId = parseInt(parentIdStr, 10);
				const subId = parseInt(subIdStr, 10);
				const parentTaskIndex = allTasksData.tasks.findIndex(
					(t) => t.id === parentId
				);
				// No need to find subtaskIndex again, taskToUpdateObject is the subtask reference

				Object.assign(taskToUpdateObject, { ...parsedAgentTask, id: subId }); // Merge and ensure ID
				finalUpdatedTaskForReturn = taskToUpdateObject;
				taskUpdated = true;
			} else {
				// Handling main task update (taskToUpdateObject is the main task)
				const taskIdNum = parseInt(String(taskIdToUpdate), 10);
				// Preserve completed subtasks from originalTask if agent's task doesn't have them or mishandles them
				let finalSubtasks = parsedAgentTask.subtasks || [];
				if (
					taskToUpdateObject.subtasks &&
					taskToUpdateObject.subtasks.length > 0
				) {
					const completedOriginalSubtasks = taskToUpdateObject.subtasks.filter(
						(st) => st.status === 'done' || st.status === 'completed'
					);
					completedOriginalSubtasks.forEach((compSub) => {
						const updatedVersion = finalSubtasks.find(
							(st) => st.id === compSub.id
						);
						if (
							!updatedVersion ||
							JSON.stringify(updatedVersion) !== JSON.stringify(compSub)
						) {
							logWrapper.warn(
								`saveUpdatedTaskFromAgent: Restoring completed subtask ${taskToUpdateObject.id}.${compSub.id} as agent modified/removed it.`
							);
							finalSubtasks = finalSubtasks.filter(
								(st) => st.id !== compSub.id
							);
							finalSubtasks.push(compSub);
						}
					});
					const subtaskIds = new Set();
					finalSubtasks = finalSubtasks
						.filter((st) => {
							if (!subtaskIds.has(st.id)) {
								subtaskIds.add(st.id);
								return true;
							}
							return false;
						})
						.sort((a, b) => a.id - b.id);
				}
				Object.assign(taskToUpdateObject, {
					...parsedAgentTask,
					id: taskIdNum,
					subtasks: finalSubtasks
				});
				finalUpdatedTaskForReturn = taskToUpdateObject;
				taskUpdated = true;
			}
		}

		if (taskUpdated) {
			writeJSON(tasksJsonPath, allTasksData);
			logWrapper.info(
				`saveUpdatedTaskFromAgent: Successfully updated tasks.json for task/subtask ID ${taskIdToUpdate}.`
			);

			const outputDir = path.dirname(tasksJsonPath);
			await generateTaskFiles(tasksJsonPath, outputDir, { mcpLog: logWrapper });
			logWrapper.info(
				`saveUpdatedTaskFromAgent: Markdown task files regenerated after update.`
			);
		}

		return {
			success: true,
			updatedTask: finalUpdatedTaskForReturn,
			wasActuallyUpdated: taskUpdated
		};
	} catch (error) {
		logWrapper.error(
			`saveUpdatedTaskFromAgent: Error processing update for ID ${taskIdToUpdate}: ${error.message}`
		);
		logWrapper.error(`saveUpdatedTaskFromAgent: Error stack: ${error.stack}`);
		return { success: false, error: error.message };
	}
}

export { saveUpdatedTaskFromAgent };
