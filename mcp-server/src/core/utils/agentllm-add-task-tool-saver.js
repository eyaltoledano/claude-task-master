// agentllm-add-task-tool-saver.js
import { AgentLLMToolSaver } from './agentllm-base-tool-saver.js';

class AddTaskSaver extends AgentLLMToolSaver {
	constructor() {
		super('agentllmAddTaskSave');
	}

	async processAgentOutput(
		agentOutput,
		allTasksData,
		logWrapper,
		originalToolArgs,
		delegatedRequestParams
	) {
		const {
			newTaskId,
			userDependencies = [],
			userPriority = 'medium'
		} = delegatedRequestParams;

		const validPriorities = ['low', 'medium', 'high', 'urgent'];
		const priority = validPriorities.includes(userPriority) ? userPriority : 'medium';
		const parsedId =
			typeof newTaskId === 'string' ? parseInt(newTaskId, 10) : newTaskId;
		if (!Number.isFinite(parsedId) || parsedId <= 0) {
			return {
				success: false,
				error: `Missing or invalid newTaskId: ${newTaskId}`
			};
		}

		const newTask = {
			id: parsedId,
			title: String(
				agentOutput.title || originalToolArgs?.prompt || 'Untitled Task'
			).trim(),
			description: String(
				agentOutput.description || originalToolArgs?.prompt || ''
			).trim(),
			details: agentOutput.details || '',
			testStrategy: agentOutput.testStrategy || '',
			status: 'pending',
			dependencies: Array.isArray(agentOutput.dependencies)
				? agentOutput.dependencies
				: userDependencies,
			priority: priority,
			subtasks: []
		};

		if (
			allTasksData.tasks.some(
				(t) => parseInt(String(t.id), 10) === parseInt(String(newTask.id), 10)
			)
		) {
			return { success: false, error: `Task ID ${newTask.id} already exists` };
		}

		allTasksData.tasks.push(newTask);
		allTasksData.tasks.sort(
			(a, b) => parseInt(String(a.id), 10) - parseInt(String(b.id), 10)
		);
		return { success: true, data: { newTask } };
	}
}

export const agentllmAddTaskSave = async (...args) =>
	new AddTaskSaver().save(...args);
