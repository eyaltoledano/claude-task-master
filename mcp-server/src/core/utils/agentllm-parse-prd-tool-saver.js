import path from 'path';
import { z } from 'zod';
import { AgentLLMToolSaver } from './agentllm-base-tool-saver.js';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';

// Flexible schema for tasks array - id and title can be string or number, other fields optional
const FlexibleTaskSchema = z
	.object({
		id: z.union([z.string(), z.number()]),
		title: z.union([z.string(), z.number()])
	})
	.catchall(z.any()); // Allow any other optional fields

const FlexibleTasksArraySchema = z.array(FlexibleTaskSchema);

class ParsePrdSaver extends AgentLLMToolSaver {
	constructor() {
		super('agentllmParsePrdSave');
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

		// Validate tasks payload with Zod schema
		const validation = FlexibleTasksArraySchema.safeParse(agentOutput.tasks);
		if (!validation.success) {
			const errorMsg = `Tasks validation failed: ${validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
			logWrapper.error(`${this.toolName}: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		if (!agentOutput || !Array.isArray(agentOutput.tasks)) {
			const errorMsg =
				'Invalid tasksData structure. Expected object with "tasks" array.';
			logWrapper.error(`${this.toolName}: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		if (!agentOutput.metadata || typeof agentOutput.metadata !== 'object') {
			logWrapper.warn(
				`${this.toolName}: metadata missing from agent output; synthesizing minimal metadata.`
			);
			const projectName = projectRoot
				? path.basename(projectRoot)
				: 'unknown-project';
			agentOutput.metadata = {
				projectName,
				totalTasks: Array.isArray(agentOutput.tasks)
					? agentOutput.tasks.length
					: 0,
				sourceFile: 'agent-llm',
				generatedAt: new Date().toISOString()
			};
		}

		try {
			// Manually resolve path, bypassing the strict loadTasksData method which fails if file doesn't exist.
			const tasksJsonPath = path.resolve(projectRoot, TASKMASTER_TASKS_FILE);

			// For parse-prd, we are replacing the entire task list for the given tag.
			// The base saveTasksData method calls the tag-aware `writeJSON`, which handles
			// creating the file or merging/overwriting the data for the specified tag.
			const tagData = {
				tasks: agentOutput.tasks,
				metadata: agentOutput.metadata
			};

			await this.saveTasksData(
				tasksJsonPath,
				tagData,
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

			return { success: true, outputPath: tasksJsonPath };
		} catch (error) {
			logWrapper.error(`${this.toolName}: Error: ${error.message}`);
			logWrapper.error(`${this.toolName}: Stack: ${error.stack}`);
			return { success: false, error: error.message };
		}
	}
}

export const agentllmParsePrdSave = async (...args) =>
	new ParsePrdSaver().save(...args);
