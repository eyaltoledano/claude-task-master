import { AgentLLMToolSaver } from './agentllm-base-tool-saver.js';
import { z } from 'zod';
import { UpdatedTaskSchema } from '../../../../src/schemas/update-tasks.js';

class UpdateToolSaver extends AgentLLMToolSaver {
    constructor() {
        super('agentllmUpdateSave');
    }

    _tolerantParseAgentTasks(agentOutput, logWrapper) {
        if (Array.isArray(agentOutput)) return { success: true, data: agentOutput };
        if (typeof agentOutput === 'object' && agentOutput !== null) {
            if (Array.isArray(agentOutput.tasks)) return { success: true, data: agentOutput.tasks };
            if (typeof agentOutput.id !== 'undefined') return { success: true, data: [agentOutput] };
        }
        if (typeof agentOutput === 'string') {
            let s = agentOutput.trim().replace(/```(?:json)?\n?([\s\S]*?)```/gi, '$1').trim();
            if (/^".*"$/s.test(s) || /^'.*'$/s.test(s)) {
                s = s.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
            }
            try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) return { success: true, data: parsed };
                if (parsed && Array.isArray(parsed.tasks)) return { success: true, data: parsed.tasks };
                if (parsed && typeof parsed.id !== 'undefined') return { success: true, data: [parsed] };
            } catch (e) {
                logWrapper.debug && logWrapper.debug(`${this.toolName}: Direct JSON.parse failed: ${e.message}`);
            }
            const firstArrayStart = s.indexOf('[');
            const lastArrayEnd = s.lastIndexOf(']');
            if (firstArrayStart !== -1 && lastArrayEnd !== -1 && lastArrayEnd > firstArrayStart) {
                const sub = s.substring(firstArrayStart, lastArrayEnd + 1);
                try {
                    const parsed = JSON.parse(sub);
                    if (Array.isArray(parsed)) return { success: true, data: parsed };
                } catch (e) {
                    logWrapper.debug && logWrapper.debug(`${this.toolName}: Substring array parse failed: ${e.message}`);
                }
            }
            const firstObjStart = s.indexOf('{');
            const lastObjEnd = s.lastIndexOf('}');
            if (firstObjStart !== -1 && lastObjEnd !== -1 && lastObjEnd > firstObjStart) {
                const sub = s.substring(firstObjStart, lastObjEnd + 1);
                try {
                    const parsed = JSON.parse(sub);
                    if (Array.isArray(parsed)) return { success: true, data: parsed };
                    if (parsed && Array.isArray(parsed.tasks)) return { success: true, data: parsed.tasks };
                    if (parsed && typeof parsed.id !== 'undefined') return { success: true, data: [parsed] };
                } catch (e) {
                    logWrapper.debug && logWrapper.debug(`${this.toolName}: Substring object parse failed: ${e.message}`);
                }
            }
        }
        return { success: false, error: 'Invalid agentOutput format. Expected a JSON string (array of tasks) or an array of task objects.' };
    }

    async processAgentOutput(agentOutput, allTasksData, logWrapper) {
        const parseResult = this._tolerantParseAgentTasks(agentOutput, logWrapper);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error };
        }
        const parsedAgentTasksArray = parseResult.data;
        const AgentTaskSchema = UpdatedTaskSchema.partial().extend({ id: z.union([z.string(), z.number()]), title: z.string() });
        const validationResults = parsedAgentTasksArray.map(item => AgentTaskSchema.safeParse(item));
        const failedValidations = validationResults.filter(v => !v.success);
        if (failedValidations.length > 0) {
            failedValidations.forEach(result => {
                if (!result.success) {
                    const details = (result.error && 'issues' in result.error && result.error.issues) || result.error;
                    logWrapper.error(`${this.toolName}: Invalid agent task item. Error: ${JSON.stringify(details)}`);
                }
            });
            return { success: false, error: 'Invalid agent task items' };
        }

        const agentTasksMap = new Map(parsedAgentTasksArray.map(task => [parseInt(String(task.id), 10), { ...task, id: parseInt(String(task.id), 10) }]));
        const updatedTaskIds = [];
        let actualUpdatesMade = 0;

        allTasksData.tasks.forEach((originalTask, index) => {
            if (agentTasksMap.has(originalTask.id)) {
                const agentTask = agentTasksMap.get(originalTask.id);
                if (this.isTaskCompleted(originalTask)) {
                    updatedTaskIds.push({ id: String(originalTask.id), skipped: true, reason: 'task_completed' });
                } else {
                    updatedTaskIds.push({ id: String(originalTask.id), skipped: false, reason: 'updated_successfully' });
                    actualUpdatesMade++;
                    let finalSubtasks = agentTask.subtasks || [];
                    if (originalTask.subtasks && originalTask.subtasks.length > 0) {
                        const completedOriginalSubtasks = originalTask.subtasks.filter(st => this.isTaskCompleted(st));
                        completedOriginalSubtasks.forEach(compSub => {
                            const updatedVersionInAgentTask = finalSubtasks.find(st => Number(st.id) === Number(compSub.id));
                            if (!updatedVersionInAgentTask || JSON.stringify(updatedVersionInAgentTask) !== JSON.stringify(compSub)) {
                                logWrapper.warn(`${this.toolName}: Restoring completed subtask ${originalTask.id}.${compSub.id} as agent modified/removed it.`);
                                finalSubtasks = finalSubtasks.filter(st => Number(st.id) !== Number(compSub.id));
                                finalSubtasks.push(compSub);
                            }
                        });
                        const subtaskIds = new Set();
                        finalSubtasks = finalSubtasks.filter(st => {
                            const key = Number(st.id);
                            if (!subtaskIds.has(key)) {
                                subtaskIds.add(key);
                                return true;
                            }
                            return false;
                        }).sort((a, b) => Number(a.id) - Number(b.id));
                    }
                    allTasksData.tasks[index] = { ...originalTask, ...agentTask, id: originalTask.id, subtasks: finalSubtasks };
                }
            }
        });

        return { success: true, data: { updatedTaskIds, updatesApplied: actualUpdatesMade } };
    }
}

export const agentllmUpdateSave = async (agentOutput, projectRoot, logWrapper, tag = 'master') => {
    const saver = new UpdateToolSaver();
    return saver.save(agentOutput, projectRoot, logWrapper, null, null, tag);
};
