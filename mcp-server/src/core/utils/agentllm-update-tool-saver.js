import path from 'path';
import { z } from 'zod';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js';
import { UpdatedTaskSchema } from '../../../../src/schemas/update-tasks.js';
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';

/**
 * Try to parse various shapes of agent output into an array of task objects.
 * Accepts:
 * - Already-parsed arrays
 * - Single task object (will be wrapped into an array)
 * - Objects that contain a 'tasks' array
 * - JSON strings, possibly wrapped in code fences (```), or containing surrounding text
 * - Attempts to extract first JSON array/object substring when full parse fails
 */
function _tolerantParseAgentTasks(agentOutput, logWrapper) {
	// If already an array, return it
	if (Array.isArray(agentOutput)) return { success: true, data: agentOutput };

	// If already an object, check for common shapes
	if (typeof agentOutput === 'object' && agentOutput !== null) {
		if (Array.isArray(agentOutput.tasks))
			return { success: true, data: agentOutput.tasks };
		// Treat single task object as a one-item array
		if (typeof agentOutput.id !== 'undefined')
			return { success: true, data: [agentOutput] };
	}

	// If it's a string, try multiple tolerant parsing strategies
	if (typeof agentOutput === 'string') {
		let s = agentOutput.trim();

		// Remove common markdown/json code fences
		s = s.replace(/```(?:json)?\n?([\s\S]*?)```/gi, '$1').trim();

		// Some agents wrap JSON inside a quoted string; try to unescape common patterns
		if (/^".*"$/s.test(s) || /^'.*'$/s.test(s)) {
			// Strip outer quotes
			s = s.slice(1, -1);
			// Unescape common escape sequences
			s = s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
		}

		// First attempt: direct JSON.parse
		try {
			const parsed = JSON.parse(s);
			if (Array.isArray(parsed)) return { success: true, data: parsed };
			if (parsed && Array.isArray(parsed.tasks))
				return { success: true, data: parsed.tasks };
			if (parsed && typeof parsed.id !== 'undefined')
				return { success: true, data: [parsed] };
		} catch (e) {
			logWrapper.debug &&
				logWrapper.debug(
					`agentllmUpdateSave: Direct JSON.parse failed: ${e.message}`
				);
		}

		// Attempt to find first JSON array substring
		const firstArrayStart = s.indexOf('[');
		const lastArrayEnd = s.lastIndexOf(']');
		if (
			firstArrayStart !== -1 &&
			lastArrayEnd !== -1 &&
			lastArrayEnd > firstArrayStart
		) {
			const sub = s.substring(firstArrayStart, lastArrayEnd + 1);
			try {
				const parsed = JSON.parse(sub);
				if (Array.isArray(parsed)) return { success: true, data: parsed };
			} catch (e) {
				logWrapper.debug &&
					logWrapper.debug(
						`agentllmUpdateSave: Substring array parse failed: ${e.message}`
					);
			}
		}

		// Attempt to find first JSON object substring
		const firstObjStart = s.indexOf('{');
		const lastObjEnd = s.lastIndexOf('}');
		if (
			firstObjStart !== -1 &&
			lastObjEnd !== -1 &&
			lastObjEnd > firstObjStart
		) {
			const sub = s.substring(firstObjStart, lastObjEnd + 1);
			try {
				const parsed = JSON.parse(sub);
				if (Array.isArray(parsed)) return { success: true, data: parsed };
				if (parsed && Array.isArray(parsed.tasks))
					return { success: true, data: parsed.tasks };
				if (parsed && typeof parsed.id !== 'undefined')
					return { success: true, data: [parsed] };
			} catch (e) {
				logWrapper.debug &&
					logWrapper.debug(
						`agentllmUpdateSave: Substring object parse failed: ${e.message}`
					);
			}
		}
	}

	return {
		success: false,
		error:
			'Invalid agentOutput format. Expected a JSON string (array of tasks) or an array of task objects.'
	};
}

/**
 * Saves multiple updated task data (typically from an agent after an 'update' tool delegation) to tasks.json.
 *
 * @param {any} agentOutput - The data received from the agent. Expected to be a JSON string
 *                            representing an array of updated task objects, or already an array of tasks.
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {Object} logWrapper - Logger object (e.g., from MCP context).
 * @returns {Promise<Object>} Result object with { success: true, updatedTaskIds: string[] } or { success: false, error: string }.
 */
async function agentllmUpdateSave(
	agentOutput,
	projectRoot,
	logWrapper,
	tag = 'master'
) {
	logWrapper.info(
		`agentllmUpdateSave: Saving multiple updated tasks from agent data for tag '${tag}'.`
	);

	const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);

	try {
		const parseResult = _tolerantParseAgentTasks(agentOutput, logWrapper);
		if (!parseResult.success) {
			logWrapper.error(
				`agentllmUpdateSave: ${parseResult.error} Received type: ${typeof agentOutput}`
			);
			return { success: false, error: parseResult.error };
		}

		const parsedAgentTasksArray = parseResult.data;

		// Validate each task against a tolerant schema based on the shared UpdatedTaskSchema
		const AgentTaskSchema = UpdatedTaskSchema.partial().extend({
			id: z.union([z.string(), z.number()]),
			title: z.string()
		});

		const validationResults = parsedAgentTasksArray.map((item) =>
			AgentTaskSchema.safeParse(item)
		);
		const failedValidations = validationResults.filter((v) => !v.success);

		if (failedValidations.length > 0) {
			failedValidations.forEach((result) => {
				if (!result.success) {
					const errorDetails = result.error.errors;
					logWrapper.error(
						`agentllmUpdateSave: Invalid agent task item. Error: ${JSON.stringify(errorDetails)}`
					);
				}
			});
			return { success: false, error: 'Invalid agent task items' };
		}

		if (parsedAgentTasksArray.length === 0) {
			logWrapper.info(
				'agentllmUpdateSave: Agent returned an empty array of tasks. No updates to apply.'
			);
			return {
				success: true,
				updatedTaskIds: [],
				message: 'Agent returned no tasks to update.'
			};
		}

		logWrapper.info(
			`agentllmUpdateSave: Parsed ${parsedAgentTasksArray.length} tasks from agent output.`
		);

		const allTasksData = readJSON(tasksJsonPath, projectRoot, tag);
		if (!allTasksData || !Array.isArray(allTasksData.tasks)) {
			const errorMsg = `Invalid or missing tasks data in ${tasksJsonPath} for tag '${tag}'.`;
			logWrapper.error(`agentllmUpdateSave: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const agentTasksMap = new Map(
			parsedAgentTasksArray.map((task) => {
				const idNum = parseInt(String(task.id), 10);
				return [idNum, { ...task, id: idNum }];
			})
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
						`agentllmUpdateSave: Task ${originalTask.id} is completed. Agent's update for this task will be ignored to preserve completed state.`
					);
					// Optionally, check if agentTask differs significantly and log more details.
					// Track skipped completed tasks
					updatedTaskIds.push({
						id: String(originalTask.id),
						skipped: true,
						reason: 'task_completed'
					});
				} else {
					logWrapper.info(
						`agentllmUpdateSave: Updating task ID ${originalTask.id}.`
					);
					updatedTaskIds.push({
						id: String(originalTask.id),
						skipped: false,
						reason: 'updated_successfully'
					});
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
									`agentllmUpdateSave: Restoring completed subtask ${originalTask.id}.${compSub.id} as agent modified/removed it.`
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
			writeJSON(tasksJsonPath, allTasksData, projectRoot, tag);
			logWrapper.info(
				`agentllmUpdateSave: Successfully updated ${actualUpdatesMade} tasks in ${tasksJsonPath} for tag '${tag}'.`
			);

			const outputDir = path.dirname(tasksJsonPath);
			await generateTaskFiles(tasksJsonPath, outputDir, {
				mcpLog: logWrapper,
				projectRoot: projectRoot,
				tag: tag
			});
			logWrapper.info(
				`agentllmUpdateSave: Markdown task files regenerated for tag '${tag}'.`
			);
		} else {
			logWrapper.info(
				'agentllmUpdateSave: No effective updates were made to tasks.json (either no matching tasks or tasks were completed).'
			);
		}

		return { success: true, updatedTaskIds, updatesApplied: actualUpdatesMade };
	} catch (error) {
		logWrapper.error(
			`agentllmUpdateSave: Error processing update for multiple tasks: ${error.message}`
		);
		logWrapper.error(`agentllmUpdateSave: Error stack: ${error.stack}`);
		return { success: false, error: error.message };
	}
}

export { agentllmUpdateSave };
