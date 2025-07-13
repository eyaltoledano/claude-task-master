import path from 'path';
import fs from 'fs';
import {
	readJSON,
	writeJSON,
	findTaskById,
	getCurrentTag,
	ensureTagMetadata
} from '../../../../scripts/modules/utils.js';
import generateTaskFiles from '../../../../scripts/modules/task-manager/generate-task-files.js';

// For handleSaveToFile, we might need to extract it from performResearch or replicate its core.
// For now, let's replicate a simplified version.

/**
 * Formats and saves research content to a file.
 * Simplified version of handleSaveToFile from performResearch.
 * @param {string} researchText - The main research text from the agent.
 * @param {string} query - The original research query.
 * @param {string} projectRoot - Absolute path to the project root.
 * @param {Object} log - Logger object.
 * @returns {Promise<string|null>} Path to saved file or null if error.
 */
async function saveResearchToFile(researchText, query, projectRoot, log) {
	try {
		const researchDir = path.join(
			projectRoot,
			'.taskmaster',
			'docs',
			'research'
		);
		if (!fs.existsSync(researchDir)) {
			fs.mkdirSync(researchDir, { recursive: true });
		}

		const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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

		fs.writeFileSync(filePath, fileContent, 'utf8');
		log.info(
			`handleAgentResearchResult (saveToFile): Research saved to: ${path.relative(projectRoot, filePath)}`
		);
		return filePath;
	} catch (error) {
		log.error(
			`handleAgentResearchResult (saveToFile): Error saving research file: ${error.message}`
		);
		return null;
	}
}

/**
 * Handles saving research output received from an agent to a task and/or file.
 * This is called by the MCP server core after an agent_llm callback for a 'research' tool delegation.
 *
 * @param {string} agentResearchText - The plain text research content from the agent.
 * @param {object} originalResearchArgs - The arguments from the initial 'research' tool call.
 *                                      Expected to contain: query, saveTo, saveToFile, detailLevel, projectRoot.
 * @param {string} projectRoot - Absolute path to the project root (can also be in originalResearchArgs).
 * @param {object} log - Logger object.
 * @param {object} sessionContext - The session context from the original MCP call (for internalUpdateContext).
 * @returns {Promise<{success: boolean, taskUpdated: boolean, filePath: string|null, error?: string}>}
 */
export async function handleAgentResearchResult(
	agentResearchText,
	originalResearchArgs,
	projectRoot,
	log,
	sessionContext
) {
	let taskUpdated = false;
	let savedFilePath = null;
	let overallSuccess = true;
	let errors = [];

	const { query, saveTo, saveToFile, detailLevel } = originalResearchArgs;

	log.info(
		`handleAgentResearchResult: Processing agent research. saveTo: ${saveTo}, saveToFile: ${saveToFile}`
	);

	if (
		!agentResearchText ||
		typeof agentResearchText !== 'string' ||
		agentResearchText.trim() === ''
	) {
		log.warn(
			'handleAgentResearchResult: Agent research text is empty or invalid. Nothing to save.'
		);
		return {
			success: false,
			taskUpdated,
			filePath: savedFilePath,
			error: 'Agent provided no research content.'
		};
	}

	if (saveToFile) {
		log.info(`handleAgentResearchResult: Attempting to save research to file.`);
		try {
			savedFilePath = await saveResearchToFile(
				agentResearchText,
				query,
				projectRoot,
				log
			);
			if (!savedFilePath) {
				errors.push('Failed to save research to file.');
			}
		} catch (e) {
			log.error(
				`handleAgentResearchResult: Error in saveResearchToFile: ${e.message}`
			);
			errors.push(`File save error: ${e.message}`);
		}
	}

	if (saveTo) {
		log.info(
			`handleAgentResearchResult: Attempting direct save to task/subtask ID '${saveTo}' in tasks.json.`
		);
		try {
			const isSubtask = String(saveTo).includes('.');
			const timestampForTag = new Date().toISOString();
			let researchContent = `\n\n<info added on ${timestampForTag}>\n`;
			if (query) researchContent += `Original Query: ${query.trim()}\n`;
			if (detailLevel) researchContent += `Detail Level: ${detailLevel}\n\n`;
			researchContent += `${agentResearchText.trim()}\n</info added on ${timestampForTag}>`;

			const tasksPath = path.join(
				projectRoot,
				'.taskmaster',
				'tasks',
				'tasks.json'
			);
			const resolvedTag = sessionContext?.tag || getCurrentTag(projectRoot);

			log.debug(
				`handleAgentResearchResult: Reading tasks from ${tasksPath} for tag '${resolvedTag}'`
			);
			const rawTasksDataFromFile = readJSON(
				tasksPath,
				projectRoot,
				resolvedTag
			);

			if (!rawTasksDataFromFile) {
				throw new Error(
					`Could not read tasks data from ${tasksPath} for tag ${resolvedTag}.`
				);
			}

			let allTagsData = rawTasksDataFromFile._rawTaggedData
				? { ...rawTasksDataFromFile._rawTaggedData }
				: { ...rawTasksDataFromFile };
			let currentTagTasksData = allTagsData[resolvedTag];

			if (!currentTagTasksData) {
				allTagsData[resolvedTag] = { tasks: [], metadata: {} };
				currentTagTasksData = allTagsData[resolvedTag];
				ensureTagMetadata(currentTagTasksData, {
					description: `Tasks for tag ${resolvedTag}`
				});
				log.info(
					`handleAgentResearchResult: Initialized new tag '${resolvedTag}' in tasks data structure.`
				);
			}
			if (!Array.isArray(currentTagTasksData.tasks)) {
				currentTagTasksData.tasks = [];
				log.warn(
					`handleAgentResearchResult: Tag '${resolvedTag}' existed without a tasks array or was invalid. Initialized/reset tasks array.`
				);
			}

			let itemModified = false;

			if (isSubtask) {
				const [parentIdStr, subtaskIdStr] = String(saveTo).split('.');
				const parentId = parseInt(parentIdStr, 10);
				const subId = parseInt(subtaskIdStr, 10);

				const parentTaskResult = findTaskById(
					currentTagTasksData.tasks,
					parentId
				);
				const parentTask = parentTaskResult?.task;

				if (parentTask && Array.isArray(parentTask.subtasks)) {
					const subtask = parentTask.subtasks.find((st) => st.id === subId);
					if (subtask) {
						subtask.details = (subtask.details || '') + researchContent;
						itemModified = true;
						log.info(
							`handleAgentResearchResult: Appended research to subtask ${saveTo} in tasks.json.`
						);
					} else {
						log.error(
							`handleAgentResearchResult: Subtask ${saveTo} not found in tasks.json.`
						);
						errors.push(`Subtask ${saveTo} not found.`);
					}
				} else {
					log.error(
						`handleAgentResearchResult: Parent task for subtask ${saveTo} (ID: ${parentId}) not found or has no subtasks array in tasks.json.`
					);
					errors.push(`Parent task for subtask ${saveTo} not found.`);
				}
			} else {
				const taskId = parseInt(String(saveTo), 10);
				const taskResult = findTaskById(currentTagTasksData.tasks, taskId);
				const task = taskResult?.task;
				if (task) {
					task.details = (task.details || '') + researchContent;
					itemModified = true;
					log.info(
						`handleAgentResearchResult: Appended research to task ${saveTo} in tasks.json.`
					);
				} else {
					log.error(
						`handleAgentResearchResult: Task ${saveTo} not found in tasks.json.`
					);
					errors.push(`Task ${saveTo} not found.`);
				}
			}

			if (itemModified) {
				ensureTagMetadata(currentTagTasksData);
				writeJSON(tasksPath, allTagsData, projectRoot, resolvedTag);
				taskUpdated = true;
				log.info(
					`handleAgentResearchResult: Successfully wrote updated tasks data to ${tasksPath} for tag '${resolvedTag}'.`
				);

				// Regenerate individual task files
				try {
					const taskFilesOutputDir = path.join(
						projectRoot,
						'.taskmaster',
						'tasks'
					);
					log.info(
						`handleAgentResearchResult: Regenerating task files in ${taskFilesOutputDir} for tag ${resolvedTag}.`
					);
					await generateTaskFiles(tasksPath, taskFilesOutputDir, {
						mcpLog: log,
						tag: resolvedTag
					});
					log.info(
						`handleAgentResearchResult: Successfully regenerated task files for tag ${resolvedTag}.`
					);
				} catch (genFilesError) {
					log.error(
						`handleAgentResearchResult: Error regenerating task files for tag ${resolvedTag}: ${genFilesError.message}`
					);
					// Optionally, add to main errors or decide if this is critical
					// errors.push(`Failed to regenerate task files: ${genFilesError.message}`);
				}
			}
		} catch (saveError) {
			log.error(
				`handleAgentResearchResult: Error during direct save to task/subtask ${saveTo} in tasks.json: ${saveError.message}`
			);
			log.error(
				`handleAgentResearchResult: Save error stack: ${saveError.stack}`
			);
			errors.push(`Task save error: ${saveError.message}`);
		}
	}

	if (errors.length > 0) {
		overallSuccess = false;
	}

	return {
		success: overallSuccess,
		taskUpdated,
		filePath: savedFilePath,
		error: errors.length > 0 ? errors.join('; ') : undefined
	};
}
