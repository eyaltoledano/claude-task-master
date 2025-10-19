import { AgentLLMToolSaver } from './agentllm-base-tool-saver.js';
import { z } from 'zod';

const taskSchema = z.object({
    id: z.union([z.number(), z.string()]),
    title: z.string()
});

class ScopeSaver extends AgentLLMToolSaver {
    constructor() {
        super('agentllmScopeSave');
    }

    async processAgentOutput(agentOutput, allTasksData, logWrapper, originalToolArgs, delegatedRequestParams) {
        if (!Array.isArray(agentOutput)) {
            return { success: false, error: 'Invalid agentOutput format. Expected an array of task objects.' };
        }

        for (const task of agentOutput) {
            const validationResult = taskSchema.safeParse(task);
            if (!validationResult.success) {
                const errorMsg = `Invalid task object in agentOutput: ${JSON.stringify(task)}. Issues: ${validationResult.error.message}`;
                return { success: false, error: errorMsg };
            }
        }

        const updatedTasks = [];
        let taskUpdated = false;

        for (const updatedTask of agentOutput) {
        const targetId = parseInt(String(updatedTask.id), 10);
        if (Number.isNaN(targetId)) {
            logWrapper.warn(
            `agentllmScopeSave: Invalid task id "${updatedTask.id}" (non-numeric). Skipping.`
            );
            continue;
        }
            const task = this.findTask(allTasksData.tasks, targetId);
            if (task) {
                if (this.isTaskCompleted(task)) {
                    logWrapper.warn(`agentllmScopeSave: Task ${updatedTask.id} is completed and will not be updated.`);
                    continue;
                }
                const merged = { ...task, ...updatedTask };
                const taskIndex = allTasksData.tasks.findIndex(t => t.id === targetId);
                allTasksData.tasks[taskIndex] = merged;
                updatedTasks.push(merged);
                taskUpdated = true;
            } else {
                logWrapper.warn(`agentllmScopeSave: Task with id ${updatedTask.id} not found in tasks.json.`);
            }
        }

        return { success: true, data: { updatedTasks, wasActuallyUpdated: taskUpdated } };
    }
}

export const agentllmScopeSave = async (agentOutput, projectRoot, logWrapper, originalToolArgs, tag = 'master', direction) => {
    const saver = new ScopeSaver();
    return saver.save(agentOutput, projectRoot, logWrapper, originalToolArgs, { direction }, tag);
};
