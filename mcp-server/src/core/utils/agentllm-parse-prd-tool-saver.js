import path from 'path';
import { z } from 'zod';
import { AgentLLMToolSaver } from './agentllm-base-tool-saver.js';

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

	// Lightweight save override: Attempt to load existing tasks; if missing, fall back to
	// an empty in-memory structure so parse-prd can create the tag/file. This preserves
	// the base class template for most savers while allowing parse-prd to replace/create
	// the tag when tasks.json does not yet exist.
	async save(
		agentOutput,
		projectRoot,
		logWrapper,
		originalToolArgs,
		delegatedRequestParams,
		tag = 'master'
	) {
		const logger = logWrapper;
		logger.info(`${this.toolName}: Starting save operation for tag '${tag}'.`);

		try {
			// Use skipLoad so we don't fail when tasks.json / tag is missing; saver will decide behavior
			const { tasksJsonPath, allTasksData } = await this.loadTasksData(
				projectRoot,
				tag,
				logger,
				{ skipLoad: true }
			);

			// Delegate processing to processAgentOutput which mutates allTasksData in-place
			const result = await this.processAgentOutput(
				agentOutput,
				allTasksData,
				logger,
				originalToolArgs,
				delegatedRequestParams
			);

			if (!result || result.success === false) {
				return result || { success: false, error: 'processAgentOutput failed' };
			}

			// Persist and regenerate
			await this.saveTasksData(
				tasksJsonPath,
				allTasksData,
				projectRoot,
				tag,
				logger
			);
			await this.regenerateMarkdownFiles(
				tasksJsonPath,
				projectRoot,
				tag,
				logger
			);

			return {
				success: true,
				outputPath: tasksJsonPath,
				...(result.data || {})
			};
		} catch (error) {
			logger.error(`${this.toolName}: Error: ${error.message}`);
			logger.error(`${this.toolName}: Stack: ${error.stack}`);
			throw error;
		}
	}

	// Implement processAgentOutput so the base class template handles load/save/regeneration.
	// This replaces the tasks and metadata for the resolved tag in-place on allTasksData.
	async processAgentOutput(
		agentOutput,
		allTasksData,
		logWrapper,
		originalToolArgs,
		delegatedRequestParams
	) {
		logWrapper.info(`${this.toolName}: Processing agent output (parse-prd).`);
		if (!agentOutput) {
			const errorMsg = 'Invalid tasksData: agentOutput is required.';
			logWrapper.error(`${this.toolName}: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		// Validate tasks payload with Zod schema
		const validation = FlexibleTasksArraySchema.safeParse(agentOutput?.tasks);
		if (!validation.success) {
			const errorMsg = `Tasks validation failed: ${validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
			logWrapper.error(`${this.toolName}: ${errorMsg}`);
			return { success: false, error: errorMsg };
		}

		if (!agentOutput.metadata || typeof agentOutput.metadata !== 'object') {
			logWrapper.warn(
				`${this.toolName}: metadata missing from agent output; synthesizing minimal metadata.`
			);
			const projectName = originalToolArgs?.projectRoot
				? path.basename(originalToolArgs.projectRoot)
				: 'unknown-project';

			// Determine source file: prefer delegatedRequestParams.input, then originalToolArgs.input
			let sourceInput =
				delegatedRequestParams?.input ?? originalToolArgs?.input ?? undefined;
			let resolvedSourceFile = 'agent-llm';
			if (sourceInput) {
				try {
					// If input is not absolute, resolve relative to provided projectRoot if available
					const baseRoot =
						originalToolArgs?.projectRoot ??
						delegatedRequestParams?.projectRoot ??
						null;
					if (baseRoot && !path.isAbsolute(sourceInput)) {
						resolvedSourceFile = path.resolve(baseRoot, sourceInput);
					} else {
						resolvedSourceFile = sourceInput;
					}
				} catch (e) {
					resolvedSourceFile = sourceInput;
				}
			}

			agentOutput.metadata = {
				projectName,
				totalTasks: Array.isArray(agentOutput.tasks)
					? agentOutput.tasks.length
					: 0,
				sourceFile: resolvedSourceFile,
				generatedAt: new Date().toISOString()
			};
		}

		// Determine flags. Prefer delegatedRequestParams over originalToolArgs.
		const appendFlag =
			delegatedRequestParams?.append ?? originalToolArgs?.append ?? false;
		const forceFlag =
			delegatedRequestParams?.force ?? originalToolArgs?.force ?? false;

		// If there are existing tasks and neither append nor force is specified, reject to match CLI safety
		const hasExisting =
			Array.isArray(allTasksData.tasks) && allTasksData.tasks.length > 0;
		if (hasExisting && !appendFlag && !forceFlag) {
			const msg = `Tag already contains ${allTasksData.tasks.length} tasks. Use force or append to proceed.`;
			logWrapper.error(`${this.toolName}: ${msg}`);
			return { success: false, error: msg };
		}

		if (appendFlag && Array.isArray(allTasksData.tasks)) {
			// Append: combine existing tasks with agent-generated tasks
			allTasksData.tasks = [...allTasksData.tasks, ...agentOutput.tasks];
		} else {
			// Replace by default (also covers forceFlag)
			allTasksData.tasks = agentOutput.tasks;
		}

		// Always update metadata to reflect agent output (but preserve created timestamp if present on existing tag)
		allTasksData.metadata = {
			...allTasksData.metadata,
			...agentOutput.metadata,
			updated: new Date().toISOString()
		};

		return { success: true, data: { replacedTasks: agentOutput.tasks.length } };
	}
}

export const agentllmParsePrdSave = async (...args) =>
	new ParsePrdSaver().save(...args);
