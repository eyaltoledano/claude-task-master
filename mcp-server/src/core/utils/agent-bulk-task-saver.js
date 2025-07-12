import path from 'path';
import fs from 'fs';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js';
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';
// Import the array parser from the core updateTasks (plural) script
import { parseUpdatedTasksFromText } from '../../../../scripts/modules/task-manager/update-tasks.js'; // Note: this is a direct import

/**
 * Saves multiple updated task data (typically from an agent after an 'update' tool delegation) to tasks.json.
 *
 * @param {any} agentOutput - The data received from the agent. Expected to be a JSON string
 *                            representing an array of updated task objects, or already an array of tasks.
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {Object} logWrapper - Logger object (e.g., from MCP context).
 * @returns {Promise<Object>} Result object with { success: true, updatedTaskIds: string[] } or { success: false, error: string }.
 */
async function saveMultipleTasksFromAgent(
	agentOutput,
	projectRoot,
	logWrapper
) {
	logWrapper.info(
		`saveMultipleTasksFromAgent: Saving multiple updated tasks from agent data.`
	);

	const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);

	try {
		let parsedAgentTasksArray;
		if (typeof agentOutput === 'string') {
			logWrapper.info(
				'saveMultipleTasksFromAgent: Agent output is a string, attempting to parse with parseUpdatedTasksFromText.'
			);
			try {
				// parseUpdatedTasksFromText expects: (text, expectedCount, logFn, isMCP)
				// We don't have an expectedCount here easily, so pass null or undefined.
				// It will use the length of the parsed array or warn if count is off.
				parsedAgentTasksArray = parseUpdatedTasksFromText(
					agentOutput,
					null,
					logWrapper,
					true /* isMCP */
				);
			} catch (parseError) {
				logWrapper.error(
					`saveMultipleTasksFromAgent: Failed to parse agentOutput string: ${parseError.message}`
				);
				return {
					success: false,
					error: `Failed to parse agentOutput string: ${parseError.message}`
				};
			}
		} else if (Array.isArray(agentOutput)) {
			logWrapper.info(
				'saveMultipleTasksFromAgent: Agent output is already an array. Validating structure (basic).'
			);
			// TODO: Add more robust Zod validation here if agentOutput is an array directly.
			// For now, assume it matches the structure `parseUpdatedTasksFromText` would produce.
			// The `parseUpdatedTasksFromText` itself does Zod validation on its output.
			// We might need to run each item through `updatedTaskSchema` from `update-tasks.js` if not using the parser.
			// For simplicity, we'll rely on the agent providing valid task objects if it's an array.
			// A more robust solution would be to validate each task object using the Zod schema from `update-tasks.js`.
			if (
				agentOutput.some(
					(task) =>
						typeof task.id === 'undefined' || typeof task.title === 'undefined'
				)
			) {
				const errorMsg =
					'Agent output array contains invalid task objects (missing id or title).';
				logWrapper.error(`saveMultipleTasksFromAgent: ${errorMsg}`);
				return { success: false, error: errorMsg };
			}
			parsedAgentTasksArray = agentOutput;
		} else {
			const errorMsg =
				'Invalid agentOutput format. Expected a JSON string (array of tasks) or an array of task objects.';
			logWrapper.error(
				`saveMultipleTasksFromAgent: ${errorMsg} Received type: ${typeof agentOutput}`
			);
			return { success: false, error: errorMsg };
		}

		if (!Array.isArray(parsedAgentTasksArray)) {
			const errorMsg = `Task data from agent is invalid after parsing/processing: Expected array, got ${typeof parsedAgentTasksArray}`;
			logWrapper.error(`saveMultipleTasksFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		if (parsedAgentTasksArray.length === 0) {
			logWrapper.info(
				'saveMultipleTasksFromAgent: Agent returned an empty array of tasks. No updates to apply.'
			);
			return {
				success: true,
				updatedTaskIds: [],
				message: 'Agent returned no tasks to update.'
			};
		}

		logWrapper.info(
			`saveMultipleTasksFromAgent: Parsed ${parsedAgentTasksArray.length} tasks from agent output.`
		);

		const allTasksData = readJSON(tasksJsonPath);
		if (!allTasksData || !Array.isArray(allTasksData.tasks)) {
			const errorMsg = `Invalid or missing tasks data in ${tasksJsonPath}.`;
			logWrapper.error(`saveMultipleTasksFromAgent: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const agentTasksMap = new Map(
			parsedAgentTasksArray.map((task) => [task.id, task])
		);
		const updatedTaskIds = [];
		let actualUpdatesMade = 0;

		allTasksData.tasks.forEach((originalTask, index) => {
			if (agentTasksMap.has(originalTask.id)) {
				const agentTask = agentTasksMap.get(originalTask.id);

				if (
					originalTask.status === 'done' ||
					originalTask.status === 'completed'
				) {
					logWrapper.warn(
						`saveMultipleTasksFromAgent: Task ${originalTask.id} is completed. Agent's update for this task will be ignored to preserve completed state.`
					);
					// Optionally, check if agentTask differs significantly and log more details.
				} else {
					logWrapper.info(
						`saveMultipleTasksFromAgent: Updating task ID ${originalTask.id}.`
					);
					updatedTaskIds.push(String(originalTask.id)); // Store ID of task being updated
					actualUpdatesMade++;

					// Preserve completed subtasks from originalTask
					let finalSubtasks = agentTask.subtasks || [];
					if (originalTask.subtasks && originalTask.subtasks.length > 0) {
						const completedOriginalSubtasks = originalTask.subtasks.filter(
							(st) => st.status === 'done' || st.status === 'completed'
						);
						completedOriginalSubtasks.forEach((compSub) => {
							const updatedVersionInAgentTask = finalSubtasks.find(
								(st) => st.id === compSub.id
							);
							if (
								!updatedVersionInAgentTask ||
								JSON.stringify(updatedVersionInAgentTask) !==
									JSON.stringify(compSub)
							) {
								logWrapper.warn(
									`saveMultipleTasksFromAgent: Restoring completed subtask ${originalTask.id}.${compSub.id} as agent modified/removed it.`
								);
								finalSubtasks = finalSubtasks.filter(
									(st) => st.id !== compSub.id
								);
								finalSubtasks.push(compSub);
							}
						});
						// Deduplicate and sort subtasks
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

					// Merge agent's task into the original task from tasks.json
					allTasksData.tasks[index] = {
						...originalTask, // Start with original to preserve fields agent might not send
						...agentTask, // Override with agent's changes
						id: originalTask.id, // Ensure original ID is kept
						subtasks: finalSubtasks // Use the carefully merged subtasks
					};
				}
			}
		});

		if (actualUpdatesMade > 0) {
			writeJSON(tasksJsonPath, allTasksData);
			logWrapper.info(
				`saveMultipleTasksFromAgent: Successfully updated ${actualUpdatesMade} tasks in ${tasksJsonPath}.`
			);

			const outputDir = path.dirname(tasksJsonPath);
			await generateTaskFiles(tasksJsonPath, outputDir, { mcpLog: logWrapper });
			logWrapper.info(
				`saveMultipleTasksFromAgent: Markdown task files regenerated.`
			);
		} else {
			logWrapper.info(
				'saveMultipleTasksFromAgent: No effective updates were made to tasks.json (either no matching tasks or tasks were completed).'
			);
		}

		return { success: true, updatedTaskIds, updatesApplied: actualUpdatesMade };
	} catch (error) {
		logWrapper.error(
			`saveMultipleTasksFromAgent: Error processing update for multiple tasks: ${error.message}`
		);
		logWrapper.error(`saveMultipleTasksFromAgent: Error stack: ${error.stack}`);
		return { success: false, error: error.message };
	}
}

export { saveMultipleTasksFromAgent };
