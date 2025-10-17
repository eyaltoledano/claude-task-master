import path from 'path';
import fs from 'fs';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js'; // Path relative to new file
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js'; // Path relative to new file
import { UpdatedTaskSchema } from '../../../../src/schemas/update-tasks.js';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js'; // Path relative to new file
// Import the parser from the core updateTaskById script

function updateSubtask(taskToUpdateObject, parsedAgentTask, taskIdToUpdate) {
	const subId = parseInt(taskIdToUpdate.split('.')[1], 10);
	Object.assign(taskToUpdateObject, { ...parsedAgentTask, id: subId });
	return taskToUpdateObject;
}

function updateMainTask(
	taskToUpdateObject,
	parsedAgentTask,
	taskIdToUpdate,
	logWrapper
) {
	const taskIdNum = parseInt(String(taskIdToUpdate), 10);
	let finalSubtasks = parsedAgentTask.subtasks || [];
	if (taskToUpdateObject.subtasks && taskToUpdateObject.subtasks.length > 0) {
		const completedOriginalSubtasks = taskToUpdateObject.subtasks.filter(
			(st) => st.status === 'done' || st.status === 'completed'
		);
		completedOriginalSubtasks.forEach((compSub) => {
			const updatedVersion = finalSubtasks.find((st) => st.id === compSub.id);
			if (
				!updatedVersion ||
				JSON.stringify(updatedVersion) !== JSON.stringify(compSub)
			) {
				logWrapper.warn(
					`agentllmUpdatedTaskSave: Restoring completed subtask ${taskToUpdateObject.id}.${compSub.id} as agent modified/removed it.`
				);
				finalSubtasks = finalSubtasks.filter((st) => st.id !== compSub.id);
				finalSubtasks.push(compSub);
			}
		});
		const subtaskIds = new Set();
		finalSubtasks = finalSubtasks
			.filter((st) => st && st.id !== undefined)
			.map((st) => ({
				...st,
				id: typeof st.id === 'string' ? parseInt(st.id, 10) : st.id
			}))
			.filter(
				(st) =>
					Number.isFinite(st.id) &&
					!subtaskIds.has(st.id) &&
					subtaskIds.add(st.id)
			)
			.sort((a, b) => a.id - b.id);
	}
	Object.assign(taskToUpdateObject, {
		...parsedAgentTask,
		id: taskIdNum,
		subtasks: finalSubtasks
	});
	return taskToUpdateObject;
}

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
async function agentllmUpdatedTaskSave(
	agentOutput,
	taskIdToUpdate,
	projectRoot,
	logWrapper,
	originalToolArgs,
	tag = 'master'
) {
	logWrapper.info(
		`agentllmUpdatedTaskSave: Saving updated task data for ID ${taskIdToUpdate} with tag '${tag}'.`
	);

	const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);

	try {
		const allTasksData = readJSON(tasksJsonPath, projectRoot, tag);
		if (!allTasksData || !Array.isArray(allTasksData.tasks)) {
			const errorMsg = `Invalid or missing tasks data in ${tasksJsonPath} for tag '${tag}'.`;
			logWrapper.error(`agentllmUpdatedTaskSave: ${errorMsg}`);
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
			const parentTask = allTasksData.tasks.find(
				(t) => parseInt(String(t.id), 10) === parentId
			);
			if (!parentTask || !parentTask.subtasks)
				throw new Error(
					`Parent task or subtasks for ${taskIdToUpdate} not found.`
				);
			taskToUpdateObject = parentTask.subtasks.find(
				(st) => parseInt(String(st.id), 10) === subId
			);
		} else {
			taskToUpdateObject = allTasksData.tasks.find(
				(t) =>
					parseInt(String(t.id), 10) === parseInt(String(taskIdToUpdate), 10)
			);
		}

		if (!taskToUpdateObject) {
			const errorMsg = `Task/subtask ID ${taskIdToUpdate} not found for update.`;
			logWrapper.error(`agentllmUpdatedTaskSave: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		// Check if originalToolArgs indicates append mode (e.g., originalToolArgs.append === true)
		// This assumes 'append' is passed in originalToolArgs if that was the intent.
		const isAppendMode = originalToolArgs && originalToolArgs.append === true;

		// Handle string input
		if (typeof agentOutput === 'string') {
			if (isAppendMode) {
				logWrapper.info(
					'agentllmUpdatedTaskSave: Agent output is a string and appendMode is true. Formatting for append.'
				);
				const timestamp = new Date().toISOString();
				directAppendText = `<info added on ${timestamp}>\n${agentOutput.trim()}\n</info added on ${timestamp}>`;
				// Skip all other processing and go directly to append logic
			} else {
				logWrapper.info(
					'agentllmUpdatedTaskSave: Agent output is a JSON string. Parsing for full update.'
				);
				try {
					agentOutput = JSON.parse(agentOutput);
				} catch (e) {
					const errorMsg = `Invalid agentOutput JSON string: ${e.message}`;
					logWrapper.error(`agentllmUpdatedTaskSave: ${errorMsg}`);
					return { success: false, error: errorMsg };
				}
			}
		}

		// Handle object input
		if (typeof agentOutput === 'object' && agentOutput !== null) {
			logWrapper.info(
				'agentllmUpdatedTaskSave: Agent output is already an object. Processing for update or append.'
			);

			// For append mode, if agentOutput is an object but we're in append mode,
			// we should treat it as text content to append rather than a task object
			if (isAppendMode) {
				logWrapper.info(
					'agentllmUpdatedTaskSave: Append mode detected with object output. Converting to string for append.'
				);
				try {
					directAppendText = JSON.stringify(agentOutput, null, 2);
				} catch (e) {
					const errorMsg = `Failed to stringify object for append: ${e.message}`;
					logWrapper.error(`agentllmUpdatedTaskSave: ${errorMsg}`);
					return { success: false, error: errorMsg };
				}
			} else {
				// Agents sometimes return a wrapped response like { task: { ... } }
				// Extract the candidate task object accordingly.
				let candidate = null;
				if (
					agentOutput &&
					typeof agentOutput === 'object' &&
					agentOutput.task &&
					typeof agentOutput.task === 'object'
				) {
					candidate = agentOutput.task;
				} else {
					candidate = agentOutput;
				}

				// Enforce/normalize ID early so validation doesn't fail when agent omits or uses string IDs
				let normalizedId;
				if (typeof taskIdToUpdate === 'string' && taskIdToUpdate.includes('.')) {
					const [, subIdStr] = taskIdToUpdate.split('.');
					normalizedId = parseInt(subIdStr, 10);
				} else {
					normalizedId = parseInt(String(taskIdToUpdate), 10);
				}

				if (candidate && (candidate.id === undefined || candidate.id === null)) {
					candidate.id = normalizedId;
				} else if (candidate && typeof candidate.id === 'string') {
					const maybeNum = parseInt(candidate.id, 10);
					if (!isNaN(maybeNum)) candidate.id = maybeNum;
				}

				// Validate with the shared UpdatedTaskSchema to avoid corrupt tasks
				const validation = UpdatedTaskSchema.safeParse(candidate);
				if (!validation.success) {
					// Format validation errors for logging and return
					let formattedDetails = null;
					try {
						formattedDetails = validation.error.format
							? validation.error.format()
							: validation.error;
					} catch (fmtErr) {
						formattedDetails = validation.error;
					}

					const detailsString = (() => {
						try {
							return JSON.stringify(formattedDetails);
						} catch (e) {
							return String(formattedDetails);
						}
					})();

					logWrapper.error(
						`agentllmUpdatedTaskSave: Agent output validation failed: ${detailsString}`
					);

					return {
						success: false,
						error: `Agent output failed task schema validation: ${detailsString}`,
						details: formattedDetails
					};
				}

				// Use the (possibly coerced) parsed data from Zod
				parsedAgentTask = validation.data;

				// Enforce ID consistency (overwrite with numeric id derived from taskIdToUpdate)
				if (parsedAgentTask.id !== normalizedId) {
					logWrapper.warn(
						`Agent output object had ID ${parsedAgentTask.id}, expected ${normalizedId}. Overwriting ID.`
					);
					parsedAgentTask.id = normalizedId;
				}
			}
		}

		// Handle case where we don't have valid content for either append or full update
		if (!directAppendText && (!parsedAgentTask || typeof parsedAgentTask !== 'object')) {
			const errorMsg =
				'Invalid agentOutput format. Expected a string for append mode or a task object for full update.';
			logWrapper.error(
				`agentllmUpdatedTaskSave: ${errorMsg} Received type: ${typeof agentOutput}, isAppendMode: ${isAppendMode}`
			);
			return { success: false, error: errorMsg };
		}

		// If directAppendText is set, it means we are in append mode with content to append
		if (directAppendText) {
			if (
				taskToUpdateObject.status === 'done' ||
				taskToUpdateObject.status === 'completed'
			) {
				logWrapper.warn(
					`agentllmUpdatedTaskSave: Task/subtask ${taskIdToUpdate} is completed. Cannot append text.`
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
				`agentllmUpdatedTaskSave: Appended text to task/subtask ${taskIdToUpdate}.`
			);

			writeJSON(tasksJsonPath, allTasksData, projectRoot, tag); // Save the entire tasks structure
			const outputDir = path.dirname(tasksJsonPath);
			await generateTaskFiles(tasksJsonPath, outputDir, {
				mcpLog: logWrapper,
				projectRoot: projectRoot,
				tag: tag
			});
			logWrapper.info(
				`agentllmUpdatedTaskSave: Markdown task files regenerated for tag '${tag}' after append.`
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
			logWrapper.error(`agentllmUpdatedTaskSave: ${errorMsg}`);
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
				`agentllmUpdatedTaskSave: Task/subtask ${taskIdToUpdate} is completed and was not updated by agent during full update attempt.`
			);
			finalUpdatedTaskForReturn = taskToUpdateObject;
		} else {
			// Apply full update logic
			if (typeof taskIdToUpdate === 'string' && taskIdToUpdate.includes('.')) {
				// Handling subtask update (taskToUpdateObject is the subtask)
				finalUpdatedTaskForReturn = updateSubtask(
					taskToUpdateObject,
					parsedAgentTask,
					taskIdToUpdate
				);
				taskUpdated = true;
			} else {
				// Handling main task update (taskToUpdateObject is the main task)
				finalUpdatedTaskForReturn = updateMainTask(
					taskToUpdateObject,
					parsedAgentTask,
					taskIdToUpdate,
					logWrapper
				);
				taskUpdated = true;
			}
		}

		if (taskUpdated) {
			writeJSON(tasksJsonPath, allTasksData, projectRoot, tag);
			logWrapper.info(
				`agentllmUpdatedTaskSave: Successfully updated tasks.json for task/subtask ID ${taskIdToUpdate} for tag '${tag}'.`
			);

			const outputDir = path.dirname(tasksJsonPath);
			await generateTaskFiles(tasksJsonPath, outputDir, {
				mcpLog: logWrapper,
				projectRoot: projectRoot,
				tag: tag
			});
			logWrapper.info(
				`agentllmUpdatedTaskSave: Markdown task files regenerated for tag '${tag}' after update.`
			);
		}

		return {
			success: true,
			updatedTask: finalUpdatedTaskForReturn,
			wasActuallyUpdated: taskUpdated
		};
	} catch (error) {
		logWrapper.error(
			`agentllmUpdatedTaskSave: Error processing update for ID ${taskIdToUpdate}: ${error.message}`
		);
		logWrapper.error(`agentllmUpdatedTaskSave: Error stack: ${error.stack}`);
		return { success: false, error: error.message };
	}
}

export { agentllmUpdatedTaskSave };
