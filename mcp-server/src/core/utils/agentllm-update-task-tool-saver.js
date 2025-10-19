import { AgentLLMToolSaver } from './agentllm-base-tool-saver.js';
import { UpdatedTaskSchema } from '../../../../src/schemas/update-tasks.js';

class UpdateTaskSaver extends AgentLLMToolSaver {
    constructor() {
        super('agentllmUpdatedTaskSave');
    }

    _updateSubtask(taskToUpdateObject, parsedAgentTask) {
        const subId = parseInt(taskToUpdateObject.id, 10);
        Object.assign(taskToUpdateObject, { ...parsedAgentTask, id: subId });
        return taskToUpdateObject;
    }

    _updateMainTask(taskToUpdateObject, parsedAgentTask, logWrapper) {
        const taskIdNum = parseInt(String(taskToUpdateObject.id), 10);
        let finalSubtasks = parsedAgentTask.subtasks || [];
        if (taskToUpdateObject.subtasks && taskToUpdateObject.subtasks.length > 0) {
            const completedOriginalSubtasks = taskToUpdateObject.subtasks.filter(st => this.isTaskCompleted(st));
            completedOriginalSubtasks.forEach(compSub => {
                const updatedVersion = finalSubtasks.find(
                    (st) =>
                    parseInt(String(st.id), 10) === parseInt(String(compSub.id), 10)
                );
                if (!updatedVersion || JSON.stringify(updatedVersion) !== JSON.stringify(compSub)) {
                    logWrapper.warn(`${this.toolName}: Restoring completed subtask ${taskToUpdateObject.id}.${compSub.id} as agent modified/removed it.`);
                    finalSubtasks = finalSubtasks.filter(
                    (st) =>
                        parseInt(String(st.id), 10) !== parseInt(String(compSub.id), 10)
                    );
                    finalSubtasks.push(compSub);
                }
            });
            const subtaskIds = new Set();
            finalSubtasks = finalSubtasks
                .filter(st => st && st.id !== undefined)
                .map(st => ({ ...st, id: typeof st.id === 'string' ? parseInt(st.id, 10) : st.id }))
                .filter(st => Number.isFinite(st.id) && !subtaskIds.has(st.id) && subtaskIds.add(st.id))
                .sort((a, b) => a.id - b.id);
        }
        Object.assign(taskToUpdateObject, { ...parsedAgentTask, id: taskIdNum, subtasks: finalSubtasks });
        return taskToUpdateObject;
    }

    async processAgentOutput(agentOutput, allTasksData, logWrapper, originalToolArgs, delegatedRequestParams) {
        const { taskIdToUpdate } = delegatedRequestParams;
        const isAppendMode = originalToolArgs && originalToolArgs.append === true;

        let taskToUpdateObject;
        const isSubtask = typeof taskIdToUpdate === 'string' && taskIdToUpdate.includes('.');
        if (isSubtask) {
            const [parentIdStr, subIdStr] = taskIdToUpdate.split('.');
            const parentId = parseInt(parentIdStr, 10);
            const subId = parseInt(subIdStr, 10);
            const parentTask = this.findTask(allTasksData.tasks, parentId);
            if (!parentTask) return { success: false, error: `Parent task or subtasks for ${taskIdToUpdate} not found.` };
            taskToUpdateObject = this.findSubtask(parentTask, subId);
        } else {
            taskToUpdateObject = this.findTask(allTasksData.tasks, taskIdToUpdate);
        }

        if (!taskToUpdateObject) {
            return { success: false, error: `Task/subtask ID ${taskIdToUpdate} not found for update.` };
        }

        if (this.isTaskCompleted(taskToUpdateObject)) {
            return { success: true, data: { updatedTask: taskToUpdateObject, wasActuallyUpdated: false } };
        }

        if (isAppendMode) {
            const textToAppend = typeof agentOutput === 'string' ? agentOutput : JSON.stringify(agentOutput, null, 2);
            const timestamp = new Date().toISOString();
            const directAppendText = `<info added on ${timestamp}>\n${textToAppend.trim()}\n</info added on ${timestamp}>`;
            taskToUpdateObject.details = (taskToUpdateObject.details ? taskToUpdateObject.details + '\n\n' : '') + directAppendText;
            return { success: true, data: { updatedTask: taskToUpdateObject, wasActuallyUpdated: true } };
        }

        let parsedAgentTask;
        if (typeof agentOutput === 'string') {
            try {
                agentOutput = JSON.parse(agentOutput);
            } catch (e) {
                return { success: false, error: `Invalid agentOutput JSON string: ${e.message}` };
            }
        }
        
        if (typeof agentOutput === 'object' && agentOutput !== null) {
            let candidate = (agentOutput.task && typeof agentOutput.task === 'object') ? agentOutput.task : agentOutput;
            const validation = UpdatedTaskSchema.safeParse(candidate);
            if (!validation.success) {
                return { success: false, error: `Agent output failed task schema validation: ${JSON.stringify(validation.error.format())}` };
            }
            parsedAgentTask = validation.data;
        } else {
            return { success: false, error: 'Invalid agentOutput format.' };
        }

        let finalUpdatedTaskForReturn;
        if (isSubtask) {
            finalUpdatedTaskForReturn = this._updateSubtask(taskToUpdateObject, parsedAgentTask);
        } else {
            finalUpdatedTaskForReturn = this._updateMainTask(taskToUpdateObject, parsedAgentTask, logWrapper);
        }

        return { success: true, data: { updatedTask: finalUpdatedTaskForReturn, wasActuallyUpdated: true } };
    }
}

export const agentllmUpdatedTaskSave = async (agentOutput, taskIdToUpdate, projectRoot, logWrapper, originalToolArgs, tag = 'master') => {
    const saver = new UpdateTaskSaver();
    const delegatedRequestParams = { taskIdToUpdate };
    return saver.save(agentOutput, projectRoot, logWrapper, originalToolArgs, delegatedRequestParams, tag);
};
