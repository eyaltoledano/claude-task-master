import path from 'path';
import fs from 'fs';
import { writeJSON } from '../../../../scripts/modules/utils.js'; // Path relative to new file
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js'; // Path relative to new file
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js'; // Path relative to new file

/**
 * Saves tasks data (typically from an agent) to tasks.json and generates markdown files.
 * @param {Object} tasksData - The tasks data object, expected to have 'tasks' and 'metadata' properties.
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {Object} logWrapper - Logger object (e.g., from MCP context or mcpLog).
 * @returns {Promise<Object>} - Result object with { success: true, outputPath } or { success: false, error: string }.
 */
async function saveTasksFromAgentData(tasksData, projectRoot, logWrapper) {
	if (!tasksData || !Array.isArray(tasksData.tasks) || !tasksData.metadata) {
		const errorMsg =
			'Invalid tasksData structure. Expected object with "tasks" array and "metadata".';
		logWrapper.error(`saveTasksFromAgentData: ${errorMsg}`);
		return { success: false, error: errorMsg };
	}

	const outputPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);
	const outputDir = path.dirname(outputPath);

	try {
		if (!fs.existsSync(outputDir)) {
			logWrapper.info(
				`saveTasksFromAgentData: Creating output directory: ${outputDir}`
			);
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Ensure tasksData includes metadata if it's meant to be saved in tasks.json
		// The original parsePRD in task-manager.js saves { tasks: finalTasks }
		// If metadata is also needed in tasks.json, adjust outputToSave.
		// For now, assuming tasksData IS the object {tasks: [...], metadata: {...}}
		// and we want to save it as is, or select parts of it.
		// Based on parsePRD from task-manager/parse-prd.js, it saves { tasks: finalTasks }
		// So, we should probably do the same:
		const outputToSave = {
			tasks: tasksData.tasks
			// Metadata will not be saved in tasks.json to maintain original format
		};
		// If only tasks should be saved as per original writeJSON in task-manager/parse-prd.js:
		// const outputToSave = { tasks: tasksData.tasks };

		writeJSON(outputPath, outputToSave);
		logWrapper.info(
			`saveTasksFromAgentData: Tasks successfully written to ${outputPath}`
		);

		await generateTaskFiles(outputPath, outputDir, { mcpLog: logWrapper });
		logWrapper.info(
			`saveTasksFromAgentData: Markdown task files generated for tasks from ${outputPath}`
		);

		return { success: true, outputPath };
	} catch (error) {
		logWrapper.error(
			`saveTasksFromAgentData: Error saving tasks or generating markdown: ${error.message}`
		);
		logWrapper.error(`saveTasksFromAgentData: Error stack: ${error.stack}`);
		return { success: false, error: error.message };
	}
}

export { saveTasksFromAgentData };
