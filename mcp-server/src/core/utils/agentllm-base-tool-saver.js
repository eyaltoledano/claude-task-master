// mcp-server/src/core/utils/agentllm-base-tool-saver.js
import path from 'path';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js';
import { createLogger } from '../../../../scripts/modules/utils.js';
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';

export class AgentLLMToolSaver {
	constructor(toolName) {
		this.toolName = toolName;
	}

	// Common: Load tasks.json
	// options: { skipLoad: boolean } - when skipLoad is true, return an empty structure
	// instead of throwing when the file/tag is missing.
	async loadTasksData(projectRoot, tag, logWrapper, options = {}) {
		const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);
		const { skipLoad = false } = options;

		const allTasksData = readJSON(tasksJsonPath, projectRoot, tag);

		if (!allTasksData || !Array.isArray(allTasksData.tasks)) {
			const errorMsg = `Invalid or missing tasks data in ${tasksJsonPath} for tag '${tag}'.`;
			if (skipLoad) {
				// Return minimal structure to allow savers that want to create/replace the tag
				logWrapper.info(
					`${this.toolName}: ${errorMsg} - continuing due to skipLoad=true`
				);
				return { tasksJsonPath, allTasksData: { tasks: [], metadata: {} } };
			}
			logWrapper.error(`${this.toolName}: ${errorMsg}`);
			throw new Error(errorMsg);
		}

		return { tasksJsonPath, allTasksData };
	}

	// Common: Save tasks.json
	async saveTasksData(
		tasksJsonPath,
		allTasksData,
		projectRoot,
		tag,
		logWrapper
	) {
		await writeJSON(tasksJsonPath, allTasksData, projectRoot, tag);
		logWrapper.info(
			`${this.toolName}: Successfully updated tasks.json for tag '${tag}'.`
		);
	}

	// Common: Regenerate markdown files
	async regenerateMarkdownFiles(tasksJsonPath, projectRoot, tag, logWrapper) {
		const outputDir = path.dirname(tasksJsonPath);
		await generateTaskFiles(tasksJsonPath, outputDir, {
			mcpLog: logWrapper,
			projectRoot: projectRoot,
			tag: tag
		});
		logWrapper.info(
			`${this.toolName}: Markdown task files regenerated for tag '${tag}'.`
		);
	}

	// Common: Check if task is completed
	isTaskCompleted(task) {
		return task.status === 'done' || task.status === 'completed';
	}

	// Common: Find task by ID
	findTask(tasks, taskId) {
		return tasks.find(
			(t) => parseInt(String(t.id), 10) === parseInt(String(taskId), 10)
		);
	}

	// Common: Find subtask
	findSubtask(parentTask, subtaskId) {
		if (!parentTask?.subtasks) return null;
		return parentTask.subtasks.find(
			(st) => parseInt(String(st.id), 10) === parseInt(String(subtaskId), 10)
		);
	}

	// Template method - subclasses override processAgentOutput
	async save(
		agentOutput,
		projectRoot,
		logWrapper,
		originalToolArgs,
		delegatedRequestParams,
		tag = 'master'
	) {
		const logger = createLogger({ mcpLog: logWrapper });
		logger.info(`${this.toolName}: Starting save operation for tag '${tag}'.`);

		try {
			// Load tasks
			const { tasksJsonPath, allTasksData } = await this.loadTasksData(
				projectRoot,
				tag,
				logger
			);

			// Subclass-specific processing
			const result = await this.processAgentOutput(
				agentOutput,
				allTasksData,
				logWrapper,
				originalToolArgs,
				delegatedRequestParams
			);

			if (!result.success) {
				return result;
			}

			// Save tasks
			await this.saveTasksData(
				tasksJsonPath,
				allTasksData,
				projectRoot,
				tag,
				logWrapper
			);

			// Regenerate markdown
			await this.regenerateMarkdownFiles(
				tasksJsonPath,
				projectRoot,
				tag,
				logWrapper
			);

			return { success: true, ...result.data };
		} catch (error) {
			logWrapper.error(`${this.toolName}: Error: ${error.message}`);
			logWrapper.error(`${this.toolName}: Stack: ${error.stack}`);
			return { success: false, error: error.message };
		}
	}

	// Abstract method - subclasses must implement
	async processAgentOutput(
		agentOutput,
		allTasksData,
		logWrapper,
		originalToolArgs,
		delegatedRequestParams
	) {
		throw new Error('Subclasses must implement processAgentOutput');
	}
}
