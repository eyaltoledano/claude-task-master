/**
 * TaskStatusManager - Systematic task status management following dev_workflow.mdc patterns
 * 
 * Handles task status updates throughout the development workflow:
 * - Start implementation (pending -> in-progress)
 * - Progress logging (update subtask details)
 * - Implementation completion (in-progress -> done)
 * - PR creation (log PR URL)
 * - Merge completion (ensure status is done)
 */

import { log } from '../../utils.js';

const logger = {
    info: (msg) => log('info', msg),
    error: (msg) => log('error', msg),
    debug: (msg) => log('debug', msg),
    success: (msg) => log('success', msg)
};

export class TaskStatusManager {
    constructor(directBackend) {
        this.directBackend = directBackend;
    }

    /**
     * Update task/subtask status for a specific workflow step
     */
    async updateStatusForWorkflowStep(taskId, step, additionalInfo = {}) {
        try {
            switch(step) {
                case 'start-implementation':
                    return await this.setTaskStatus(taskId, 'in-progress');
                
                case 'commit-progress':
                    return await this.updateSubtask(
                        taskId, 
                        `Progress committed: ${additionalInfo.commitMessage}`
                    );
                
                case 'complete-implementation':
                    return await this.setTaskStatus(taskId, 'done');
                
                case 'pr-created':
                    return await this.updateTask(
                        taskId, 
                        `PR created: ${additionalInfo.prUrl}\n\nPR is ready for review and merge.`
                    );
                
                case 'merged-locally': {
                    const mergeMessage = `Changes merged locally to ${additionalInfo.targetBranch}\n\nMerge commit: ${additionalInfo.mergeCommit}`;
                    await this.updateTask(taskId, mergeMessage);
                    return await this.setTaskStatus(taskId, 'done');
                }
                
                case 'pr-merged':
                    await this.updateTask(taskId, `PR merged: ${additionalInfo.prUrl}`);
                    return await this.setTaskStatus(taskId, 'done');

                default:
                    logger.debug(`Unknown workflow step: ${step}`);
                    return { success: false, error: `Unknown workflow step: ${step}` };
            }
        } catch (error) {
            logger.error(`Failed to update status for workflow step ${step}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Set task or subtask status
     */
    async setTaskStatus(taskId, status) {
        try {
            logger.debug(`Setting status for ${taskId} to ${status}`);
            
            const result = await this.directBackend.setSubtaskStatus(taskId, status);
            
            if (result.success) {
                logger.success(`Task ${taskId} status updated to ${status}`);
            } else {
                logger.error(`Failed to update task ${taskId} status:`, result.error);
            }
            
            return result;
        } catch (error) {
            logger.error(`Error setting task status for ${taskId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update subtask with progress information
     */
    async updateSubtask(subtaskId, progressMessage) {
        try {
            logger.debug(`Updating subtask ${subtaskId} with progress`);
            
            const result = await this.directBackend.updateSubtask(subtaskId, progressMessage);
            
            if (result.success) {
                logger.success(`Subtask ${subtaskId} updated with progress`);
            } else {
                logger.error(`Failed to update subtask ${subtaskId}:`, result.error);
            }
            
            return result;
        } catch (error) {
            logger.error(`Error updating subtask ${subtaskId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update task with information
     */
    async updateTask(taskId, message) {
        try {
            logger.debug(`Updating task ${taskId} with information`);
            
            const result = await this.directBackend.updateTask(taskId, message);
            
            if (result.success) {
                logger.success(`Task ${taskId} updated with information`);
            } else {
                logger.error(`Failed to update task ${taskId}:`, result.error);
            }
            
            return result;
        } catch (error) {
            logger.error(`Error updating task ${taskId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle workflow completion - comprehensive status update
     */
    async handleWorkflowCompletion(taskId, completionType, completionInfo = {}) {
        try {
            logger.info(`Handling workflow completion for ${taskId}: ${completionType}`);

            const updates = [];

            switch(completionType) {
                case 'pr-created':
                    updates.push(
                        await this.updateStatusForWorkflowStep(taskId, 'pr-created', completionInfo)
                    );
                    break;

                case 'merged-locally':
                    updates.push(
                        await this.updateStatusForWorkflowStep(taskId, 'merged-locally', completionInfo)
                    );
                    break;

                case 'pr-merged':
                    updates.push(
                        await this.updateStatusForWorkflowStep(taskId, 'pr-merged', completionInfo)
                    );
                    break;

                default:
                    logger.debug(`Unknown completion type: ${completionType}`);
                    return { success: false, error: `Unknown completion type: ${completionType}` };
            }

            const allSuccessful = updates.every(update => update.success);

            return {
                success: allSuccessful,
                updates,
                completionType,
                taskId
            };

        } catch (error) {
            logger.error(`Error handling workflow completion for ${taskId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Validate task readiness for workflow step
     */
    async validateTaskReadiness(taskId, workflowStep) {
        try {
            logger.debug(`Validating task ${taskId} readiness for ${workflowStep}`);

            // Get task details
            const taskResult = await this.directBackend.getTask(taskId);
            
            if (!taskResult.success) {
                return { ready: false, reason: 'task-not-found', error: taskResult.error };
            }

            const task = taskResult.data;

            switch(workflowStep) {
                case 'start-implementation':
                    return {
                        ready: task.status === 'pending',
                        reason: task.status !== 'pending' ? 'task-not-pending' : null,
                        currentStatus: task.status
                    };

                case 'complete-implementation':
                    return {
                        ready: task.status === 'in-progress',
                        reason: task.status !== 'in-progress' ? 'task-not-in-progress' : null,
                        currentStatus: task.status
                    };

                case 'pr-creation':
                    return {
                        ready: ['in-progress', 'done'].includes(task.status),
                        reason: !['in-progress', 'done'].includes(task.status) ? 'task-not-ready-for-pr' : null,
                        currentStatus: task.status
                    };

                default:
                    return { ready: true, reason: null };
            }

        } catch (error) {
            logger.error(`Error validating task readiness for ${taskId}:`, error);
            return { ready: false, reason: 'validation-error', error: error.message };
        }
    }
} 