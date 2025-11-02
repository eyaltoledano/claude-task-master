import path from 'path';
import fs from 'fs';
import { AgentLLMToolSaver } from './agentllm-base-tool-saver.js';

class ResearchSaver extends AgentLLMToolSaver {
	constructor() {
		super('agentllmResearchSave');
	}

	async saveResearchToFile(researchText, query, projectRoot, logWrapper) {
		try {
			const researchDir = path.join(
				projectRoot,
				'.taskmaster',
				'docs',
				'research'
			);
			try {
				await fs.promises.access(researchDir);
			} catch {
				await fs.promises.mkdir(researchDir, { recursive: true });
			}

			const timestamp = new Date().toISOString().split('T')[0];
			const querySlug = query
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, '')
				.replace(/\s+/g, '-')
				.replace(/-+/g, '-')
				.substring(0, 50)
				.replace(/^-+|-+$/g, '');
			const filename = `${timestamp}_${querySlug}.md`;
			const filePath = path.join(researchDir, filename);
			const fileContent = `# Research Query: ${query}\n\n## Date: ${new Date().toLocaleDateString()}\n\n${researchText}`;

			await fs.promises.writeFile(filePath, fileContent, 'utf8');
			logWrapper.info(
				`${this.toolName} (saveToFile): Research saved to: ${path.relative(projectRoot, filePath)}`
			);
			return filePath;
		} catch (error) {
			logWrapper.error(
				`${this.toolName} (saveToFile): Error saving research file: ${error.message}`
			);
			return null;
		}
	}

	async processAgentOutput(
		agentOutput,
		allTasksData,
		logWrapper,
		originalToolArgs
	) {
		const { query, saveTo, detailLevel } = originalToolArgs;
		let taskUpdated = false;

		if (saveTo) {
			const isSubtask = String(saveTo).includes('.');
			const timestampForTag = new Date().toISOString();
			let researchContent = `\n\n<info added on ${timestampForTag}>\n`;
			if (query) researchContent += `Original Query: ${query.trim()}\n`;
			if (detailLevel) researchContent += `Detail Level: ${detailLevel}\n\n`;
			researchContent += `${agentOutput.trim()}\n</info added on ${timestampForTag}>`;

			if (isSubtask) {
				const [parentIdStr, subtaskIdStr] = String(saveTo).split('.');
				const parentId = parseInt(parentIdStr, 10);
				const subId = parseInt(subtaskIdStr, 10);
				const parentTask = this.findTask(allTasksData.tasks, parentId);
				const subtask = this.findSubtask(parentTask, subId);
				if (subtask) {
					if (subtask.completed === true || subtask.status === 'completed') {
						return {
							success: true,
							data: { taskUpdated: false, skipped: true }
						};
					}
					subtask.details = (subtask.details || '') + researchContent;
					taskUpdated = true;
				} else {
					return { success: false, error: `Subtask ${saveTo} not found.` };
				}
			} else {
				const taskId = parseInt(String(saveTo), 10);
				const task = this.findTask(allTasksData.tasks, taskId);
				if (task) {
					if (this.isTaskCompleted(task)) {
						return {
							success: true,
							data: { taskUpdated: false, skipped: true }
						};
					}
					task.details = (task.details || '') + researchContent;
					taskUpdated = true;
				} else {
					return { success: false, error: `Task ${saveTo} not found.` };
				}
			}
		}
		return { success: true, data: { taskUpdated } };
	}

	async save(
		agentOutput,
		projectRoot,
		logWrapper,
		originalToolArgs,
		delegatedRequestParams,
		tag = 'master'
	) {
		logWrapper.info(
			`${this.toolName}: Starting save operation for tag '${tag}'.`
		);
		let savedFilePath = null;
		const { saveToFile, query, saveTo } = originalToolArgs;

		if (saveToFile) {
			savedFilePath = await this.saveResearchToFile(
				agentOutput,
				query,
				projectRoot,
				logWrapper
			);
		}

		if (!saveTo) {
			return { success: true, filePath: savedFilePath, taskUpdated: false };
		}

		try {
			const { tasksJsonPath, allTasksData } = await this.loadTasksData(
				projectRoot,
				tag,
				logWrapper
			);
			const result = await this.processAgentOutput(
				agentOutput,
				allTasksData,
				logWrapper,
				originalToolArgs
			);

			if (!result.success) {
				return result;
			}

			if (result.data.taskUpdated) {
				await this.saveTasksData(
					tasksJsonPath,
					allTasksData,
					projectRoot,
					tag,
					logWrapper
				);
				await this.regenerateMarkdownFiles(
					tasksJsonPath,
					projectRoot,
					tag,
					logWrapper
				);
			}

			return {
				success: true,
				filePath: savedFilePath,
				taskUpdated: result.data.taskUpdated
			};
		} catch (error) {
			logWrapper.error(`${this.toolName}: Error: ${error.message}`);
			logWrapper.error(`${this.toolName}: Stack: ${error.stack}`);
			return { success: false, error: error.message };
		}
	}
}

export const agentllmResearchSave = async (
	agentResearchText,
	originalResearchArgs,
	projectRoot,
	log,
	sessionContext,
	tag
) => {
	const saver = new ResearchSaver();
	return saver.save(
		agentResearchText,
		projectRoot,
		log,
		originalResearchArgs,
		null,
		tag
	);
};
