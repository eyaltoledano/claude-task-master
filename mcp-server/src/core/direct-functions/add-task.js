/**
 * add-task.js
 * Direct function implementation for adding a new task
 */

import { addTask } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for adding a new task with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.prompt - Description of the task to add
 * @param {Array<number>} [args.dependencies=[]] - Task dependencies as array of IDs
 * @param {string} [args.priority='medium'] - Task priority (high, medium, low)
 * @param {string} [args.file] - Path to the tasks file
 * @param {string} [args.projectRoot] - Project root directory
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function addTaskDirect(args, log) {
  try {
    // Find the tasks.json path
    const tasksPath = findTasksJsonPath(args, log);
    
    // Check required parameters
    if (!args.prompt) {
      log.error('Missing required parameter: prompt');
      return {
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'The prompt parameter is required for adding a task'
        }
      };
    }
    
    // Extract and prepare parameters
    const prompt = args.prompt;
    const dependencies = Array.isArray(args.dependencies) 
      ? args.dependencies 
      : (args.dependencies ? String(args.dependencies).split(',').map(id => parseInt(id.trim(), 10)) : []);
    const priority = args.priority || 'medium';
    
    log.info(`Adding new task with prompt: "${prompt}", dependencies: [${dependencies.join(', ')}], priority: ${priority}`);
    
    // Call the addTask function
    const newTaskId = await addTask(tasksPath, prompt, dependencies, priority);
    
    return {
      success: true,
      data: {
        taskId: newTaskId,
        message: `Successfully added new task #${newTaskId}`
      }
    };
  } catch (error) {
    log.error(`Error in addTaskDirect: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'ADD_TASK_ERROR',
        message: error.message
      }
    };
  }
} 