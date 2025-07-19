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
async function agentllmParsePrdSave(
	tasksData,
	projectRoot,
	logWrapper,
	tag = 'master'
) {
	if (!tasksData || !Array.isArray(tasksData.tasks) || !tasksData.metadata) {
		const errorMsg =
			'Invalid tasksData structure. Expected object with "tasks" array and "metadata".';
		logWrapper.error(`agentllmParsePrdSave: ${errorMsg}`);
		return { success: false, error: errorMsg };
	}

	const outputPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);
	const outputDir = path.dirname(outputPath);

	try {
		if (!fs.existsSync(outputDir)) {
			logWrapper.info(
				`agentllmParsePrdSave: Creating output directory: ${outputDir}`
			);
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Based on the existing logic of parse-prd, we should be saving the tasks
		// under a specific tag in the tasks.json file.
		// The `writeJSON` utility from scripts/modules/utils.js handles the logic
		// of reading the existing file, updating the specific tag, and writing it back.
		const outputToSave = {
			[tag]: {
				tasks: tasksData.tasks,
				metadata: tasksData.metadata
			}
		};

		// The `writeJSON` function in utils.js is designed to intelligently merge
		// the new data with existing data in tasks.json.
		writeJSON(outputPath, outputToSave, projectRoot, tag);
		logWrapper.info(
			`agentllmParsePrdSave: Tasks successfully written to ${outputPath} for tag '${tag}'`
		);

		// Pass the tag to generateTaskFiles
		await generateTaskFiles(outputPath, outputDir, {
			mcpLog: logWrapper,
			projectRoot: projectRoot,
			tag: tag
		});
		logWrapper.info(
			`agentllmParsePrdSave: Markdown task files generated for tag '${tag}' from ${outputPath}`
		);

		return { success: true, outputPath };
	} catch (error) {
		logWrapper.error(
			`agentllmParsePrdSave: Error saving tasks or generating markdown: ${error.message}`
		);
		logWrapper.error(`agentllmParsePrdSave: Error stack: ${error.stack}`);
		return { success: false, error: error.message };
	}
}

export { agentllmParsePrdSave };
