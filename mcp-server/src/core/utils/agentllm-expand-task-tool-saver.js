import path from 'path';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js'; // Path relative to new file
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js'; // Path relative to new file
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js'; // Path relative to new file

/**
 * Saves expanded subtask data (typically from an agent) to the parent task in tasks.json.
 *
 * @param {any} agentOutput - The data received from the agent (finalLLMOutput).
 *                            Expected to be a JSON string, an array of subtask objects, or an object with a 'subtasks' array.
 * @param {string|number} parentTaskIdNum - The ID of the task being expanded.
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {Object} logWrapper - Logger object (e.g., from MCP context).
 * @param {Object} originalTaskDetails - Details about the original task being expanded,
 *                                       including numSubtasks requested and original subtask count.
 * @param {number} originalTaskDetails.numSubtasks - The number of subtasks the agent was asked to generate.
 * @param {number} originalTaskDetails.nextSubtaskId - The starting ID for new subtasks.
 * @returns {Promise<Object>} Result object with { success: true } or { success: false, error: string }.
 */
async function agentllmExpandTaskSave(
	agentOutput,
	parentTaskIdNum,
	projectRoot,
	logWrapper,
	originalTaskDetails,
	tag = 'master'
) {
	logWrapper.info(
		`agentllmExpandTaskSave: Saving subtasks for parent task ID ${parentTaskIdNum} with tag '${tag}'.`
	);

	const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);

	try {
		const allTasksData = readJSON(tasksJsonPath, projectRoot, tag);
		const taskIndex = allTasksData.tasks.findIndex(
      		(t) => parseInt(String(t.id), 10) === parseInt(String(parentTaskIdNum), 10)
    	);
		if (taskIndex === -1) {
			const errorMsg = `Parent task with ID ${parentTaskIdNum} not found in ${tasksJsonPath} for tag '${tag}'.`;
			logWrapper.error(`agentllmExpandTaskSave: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const parentTask = allTasksData.tasks[taskIndex];

		let subtasksToSave;
		if (typeof agentOutput === 'string') {
		    logWrapper.info(
		    	'agentllmExpandTaskSave: Agent output is a string. Attempting JSON parse.'
		    );
		    try {
		    	const parsed = JSON.parse(agentOutput);
		    	subtasksToSave = Array.isArray(parsed)
		        	? parsed
		        	: Array.isArray(parsed?.subtasks)
		    			? parsed.subtasks
		            	: null;
		    } catch (e) {
		    	const errorMsg = `Invalid agentOutput string (JSON parse failed): ${e.message}`;
		        logWrapper.error(`agentllmExpandTaskSave: ${errorMsg}`);
		        return { success: false, error: errorMsg };
		      }
		} else if (Array.isArray(agentOutput)) {
			logWrapper.info(
				'agentllmExpandTaskSave: Agent output is already an array of subtasks.'
			);
			subtasksToSave = agentOutput;
		} else if (agentOutput && Array.isArray(agentOutput.subtasks)) {
			logWrapper.info(
				"agentllmExpandTaskSave: Agent output is an object with a 'subtasks' array."
			);
			subtasksToSave = agentOutput.subtasks;
			// TODO: Consider adding validation similar to what parseSubtasksFromText does.
		} else {
			const errorMsg =
				"Invalid agentOutput format. Expected a JSON string of subtasks, an array of subtasks, or an object with a 'subtasks' array.";
			logWrapper.error(
				`agentllmExpandTaskSave: ${errorMsg} Received: ${JSON.stringify(agentOutput)}`
			);
			return { success: false, error: errorMsg };
		}

		if (!Array.isArray(subtasksToSave)) {
			const errorMsg = `Subtask parsing or processing resulted in non-array: ${JSON.stringify(subtasksToSave)}`;
			logWrapper.error(`agentllmExpandTaskSave: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		logWrapper.info(
			`agentllmExpandTaskSave: Originally ${parentTask.subtasks ? parentTask.subtasks.length : 0} subtasks. Received ${subtasksToSave.length} new subtasks from agent.`
		);

		// Logic for handling subtasks: usually expand-task appends or replaces based on a 'force' flag.
		// The original expandTask (scripts/modules/...) handles force by clearing subtasks *before* calling AI.
		// So, here we should just append, as any clearing due to 'force' would have happened before delegation.
		if (!Array.isArray(parentTask.subtasks)) {
			parentTask.subtasks = [];
		}
		    // Normalize/assign IDs
		let nextId =
		(originalTaskDetails?.nextSubtaskId ??
			(parentTask.subtasks?.length || 0) + 1) | 0;
		const seenIds = new Set(
      		parentTask.subtasks.map((st) => parseInt(String(st.id), 10))
	    );
		const normalized = (subtasksToSave || [])
		.filter((st) => st && typeof st === 'object')
		.map((st) => {
			const idRaw = st.id ?? nextId++;
			const idNum =
			typeof idRaw === 'string' ? parseInt(idRaw, 10) : Number(idRaw);
			return {
			...st,
			title: String(st.title || '').trim(),
			description: st.description || '',
			status: st.status || 'todo',
			id: Number.isFinite(idNum) ? idNum : nextId++
			};
		})
		.filter((st) => st.title.length > 0 && !seenIds.has(st.id) && seenIds.add(st.id));
		parentTask.subtasks.push(...normalized);

		allTasksData.tasks[taskIndex] = parentTask;

		writeJSON(tasksJsonPath, allTasksData, projectRoot, tag);
		logWrapper.info(
			`agentllmExpandTaskSave: Successfully updated tasks.json for parent task ${parentTaskIdNum} with ${normalized.length} subtasks for tag '${tag}'.`
		);

		// Generate individual task files (optional, but good for consistency)
		// This generateTaskFiles is for the main tasks.json, not specific to subtasks here.
		// It regenerates all task files based on the updated tasks.json.
		const outputDir = path.dirname(tasksJsonPath);
		await generateTaskFiles(tasksJsonPath, outputDir, {
			mcpLog: logWrapper,
			projectRoot: projectRoot,
			tag: tag
		});
		logWrapper.info(
			`agentllmExpandTaskSave: Markdown task files regenerated for tag '${tag}' after updating subtasks.`
		);

		return { success: true, updatedParentTask: parentTask };
	} catch (error) {
		logWrapper.error(
			`agentllmExpandTaskSave: Error processing subtasks for parent task ${parentTaskIdNum}: ${error.message}`
		);
		logWrapper.error(`agentllmExpandTaskSave: Error stack: ${error.stack}`);
		return { success: false, error: error.message };
	}
}

export { agentllmExpandTaskSave };
