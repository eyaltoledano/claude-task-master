import path from 'path';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js';
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';

/**
 * Saves scoped task data from an agent to tasks.json.
 *
 * @param {Array<Object>} agentOutput - The array of updated task objects from the agent.
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {Object} logWrapper - Logger object.
 * @param {Object} originalToolArgs - Original arguments passed to the tool.
 * @param {string} tag - The tag context.
 * @param {string} direction - The scope direction, 'up' or 'down'.
 * @returns {Promise<Object>} Result object with { success: true, updatedTasks: [] } or { success: false, error: string }.
 */
async function agentllmScopeSave(
	agentOutput,
	projectRoot,
	logWrapper,
	originalToolArgs,
	tag = 'master',
    direction
) {
	logWrapper.info(
		`agentllmScopeSave: Saving scoped-${direction} task data with tag '${tag}'.`
	);

	const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);

	try {
		const allTasksData = readJSON(tasksJsonPath, projectRoot, tag);
		if (!allTasksData || !Array.isArray(allTasksData.tasks)) {
			const errorMsg = `Invalid or missing tasks data in ${tasksJsonPath} for tag '${tag}'.`;
			logWrapper.error(`agentllmScopeSave: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		if (!Array.isArray(agentOutput)) {
			const errorMsg = 'Invalid agentOutput format. Expected an array of task objects.';
			logWrapper.error(`agentllmScopeSave: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		const updatedTasks = [];
        let taskUpdated = false;

		for (const updatedTask of agentOutput) {
			const taskIndex = allTasksData.tasks.findIndex(t => t.id === updatedTask.id);
			if (taskIndex !== -1) {
                if (allTasksData.tasks[taskIndex].status === 'done' || allTasksData.tasks[taskIndex].status === 'completed') {
                    logWrapper.warn(`agentllmScopeSave: Task ${updatedTask.id} is completed and will not be updated.`);
                    continue;
                }
				allTasksData.tasks[taskIndex] = updatedTask;
				updatedTasks.push(updatedTask);
                taskUpdated = true;
			} else {
                logWrapper.warn(`agentllmScopeSave: Task with id ${updatedTask.id} not found in tasks.json.`);
            }
		}

        if (taskUpdated) {
            writeJSON(tasksJsonPath, allTasksData, projectRoot, tag);
            logWrapper.info(
                `agentllmScopeSave: Successfully updated tasks.json for tag '${tag}'.`
            );

            const outputDir = path.dirname(tasksJsonPath);
            await generateTaskFiles(tasksJsonPath, outputDir, {
                mcpLog: logWrapper,
                projectRoot: projectRoot,
                tag: tag
            });
            logWrapper.info(
                `agentllmScopeSave: Markdown task files regenerated for tag '${tag}'.`
            );
        } else {
            logWrapper.info(`agentllmScopeSave: No tasks were updated for tag '${tag}'.`);
        }

		return {
			success: true,
			updatedTasks,
            wasActuallyUpdated: taskUpdated
		};
	} catch (error) {
		logWrapper.error(
			`agentllmScopeSave: Error processing scope-${direction}: ${error.message}`
		);
		logWrapper.error(`agentllmScopeSave: Error stack: ${error.stack}`);
		return { success: false, error: error.message };
	}
}

export { agentllmScopeSave };
