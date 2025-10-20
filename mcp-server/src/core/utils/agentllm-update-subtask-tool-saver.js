import { AgentLLMToolSaver } from './agentllm-base-tool-saver.js';

class UpdateSubtaskSaver extends AgentLLMToolSaver {
	constructor() {
		super('agentllmUpdateSubtaskSave');
	}

	async processAgentOutput(
		agentOutput,
		allTasksData,
		logWrapper,
		originalToolArgs,
		delegatedRequestParams
	) {
		const { subtaskIdToUpdate } = delegatedRequestParams;

		if (typeof agentOutput !== 'string' || !agentOutput.trim()) {
			return {
				success: true,
				data: {
					updatedSubtaskId: subtaskIdToUpdate,
					message: 'Agent output was empty, no details appended.'
				}
			};
		}

		const [parentIdStr, subIdStr] = subtaskIdToUpdate.split('.');
		const parentId = parseInt(parentIdStr, 10);
		const subId = parseInt(subIdStr, 10);

		if (Number.isNaN(parentId) || Number.isNaN(subId)) {
			return {
				success: false,
				error: `Invalid subtask ID format: ${subtaskIdToUpdate}. Could not parse parent/sub IDs.`
			};
		}

		const parentTask = this.findTask(allTasksData.tasks, parentId);
		if (!parentTask) {
			return {
				success: false,
				error: `Parent task ${parentId} for subtask ${subtaskIdToUpdate} not found.`
			};
		}

		const subtask = this.findSubtask(parentTask, subId);
		if (!subtask) {
			return {
				success: false,
				error: `Subtask ${subtaskIdToUpdate} not found within parent task ${parentId}.`
			};
		}

		if (this.isTaskCompleted(subtask)) {
			return {
				success: true,
				data: {
					updatedSubtaskId: subtaskIdToUpdate,
					message: `Subtask was already ${subtask.status}. No details appended.`
				}
			};
		}

		const timestamp = new Date().toISOString();
		const formattedBlock = `<info added on ${timestamp}>\n${agentOutput.trim()}\n</info added on ${timestamp}>`;
		const existing =
			typeof subtask.details === 'string' ? subtask.details.trim() : '';
		subtask.details = (existing ? existing + '\n\n' : '') + formattedBlock;

		const originalUserPrompt = originalToolArgs?.prompt || '';
		if (
			typeof subtask.description === 'string' &&
			originalUserPrompt.length < 100
		) {
			const dateISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
			subtask.description = subtask.description + ` [Updated: ${dateISO}]`;
		}

		return {
			success: true,
			data: {
				updatedSubtaskId: subtaskIdToUpdate,
				appendedDetails: formattedBlock
			}
		};
	}
}

export const agentllmUpdateSubtaskSave = async (
	agentOutputString,
	subtaskIdToUpdate,
	projectRoot,
	logWrapper,
	originalToolArgs,
	tag = 'master'
) => {
	const saver = new UpdateSubtaskSaver();
	const delegatedRequestParams = { subtaskIdToUpdate };
	return saver.save(
		agentOutputString,
		projectRoot,
		logWrapper,
		originalToolArgs,
		delegatedRequestParams,
		tag
	);
};
