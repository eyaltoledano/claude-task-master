import { AgentLLMToolSaver } from './agentllm-base-tool-saver.js';

class ExpandTaskSaver extends AgentLLMToolSaver {
	constructor() {
		super('agentllmExpandTaskSave');
	}

	async processAgentOutput(
		agentOutput,
		allTasksData,
		logWrapper,
		originalToolArgs,
		delegatedRequestParams
	) {
		const { parentTaskIdNum, originalTaskDetails } = delegatedRequestParams;
		const parentTask = this.findTask(allTasksData.tasks, parentTaskIdNum);

		if (!parentTask) {
			return {
				success: false,
				error: `Parent task with ID ${parentTaskIdNum} not found.`
			};
		}

		let subtasksToSave;
		if (typeof agentOutput === 'string') {
			try {
				const parsed = JSON.parse(agentOutput);
				subtasksToSave = Array.isArray(parsed)
					? parsed
					: Array.isArray(parsed?.subtasks)
						? parsed.subtasks
						: null;
			} catch (e) {
				return {
					success: false,
					error: `Invalid agentOutput string (JSON parse failed): ${e.message}`
				};
			}
		} else if (Array.isArray(agentOutput)) {
			subtasksToSave = agentOutput;
		} else if (agentOutput && Array.isArray(agentOutput.subtasks)) {
			subtasksToSave = agentOutput.subtasks;
		} else {
			return {
				success: false,
				error:
					"Invalid agentOutput format. Expected a JSON string of subtasks, an array of subtasks, or an object with a 'subtasks' array."
			};
		}

		if (!Array.isArray(subtasksToSave)) {
			return {
				success: false,
				error: `Subtask parsing or processing resulted in non-array: ${JSON.stringify(subtasksToSave)}`
			};
		}

		if (!Array.isArray(parentTask.subtasks)) {
			parentTask.subtasks = [];
		}

		let baseNext =
			originalTaskDetails?.nextSubtaskId ??
			(parentTask.subtasks?.length || 0) + 1;
		baseNext = Number.isFinite(Number(baseNext))
			? Number(baseNext)
			: (parentTask.subtasks?.length || 0) + 1;
		let nextId = Math.trunc(baseNext);
		const seenIds = new Set(
			parentTask.subtasks.map((st) => parseInt(String(st.id), 10))
		);
		const normalized = (subtasksToSave || [])
			.filter((st) => st && typeof st === 'object')
			.map((st) => {
				const idRaw = st.id ?? nextId++;
				const idNum =
					typeof idRaw === 'string' ? parseInt(idRaw, 10) : Number(idRaw);
				return {
					...st,
					title: String(st.title || '').trim(),
					description: st.description || '',
					status: st.status || 'todo',
					id: Number.isFinite(idNum) ? idNum : nextId++
				};
			})
			.filter(
				(st) => st.title.length > 0 && !seenIds.has(st.id) && seenIds.add(st.id)
			);
		parentTask.subtasks.push(...normalized);

		return { success: true, data: { updatedParentTask: parentTask } };
	}
}

export const agentllmExpandTaskSave = async (
	agentOutput,
	parentTaskIdNum,
	projectRoot,
	logWrapper,
	originalTaskDetails,
	tag = 'master'
) => {
	const saver = new ExpandTaskSaver();
	const delegatedRequestParams = { parentTaskIdNum, originalTaskDetails };
	return saver.save(
		agentOutput,
		projectRoot,
		logWrapper,
		null,
		delegatedRequestParams,
		tag
	);
};
