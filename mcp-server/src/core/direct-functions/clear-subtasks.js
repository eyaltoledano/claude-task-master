/**
 * Direct function wrapper for clearSubtasks
 */

import { clearSubtasks } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import fs from 'fs';

/**
 * Clear subtasks from specified tasks
 * @param {Object} args - Function arguments
 * @param {string} [args.id] - Task IDs (comma-separated) to clear subtasks from
 * @param {boolean} [args.all] - Clear subtasks from all tasks
 * @param {string} [args.file] - Path to the tasks file
 * @param {string} [args.projectRoot] - Project root directory
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function clearSubtasksDirect(args, log) {
  try {
    log.info(`Clearing subtasks with args: ${JSON.stringify(args)}`);
    
    // Either id or all must be provided
    if (!args.id && !args.all) {
      return {
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: 'Either task IDs with id parameter or all parameter must be provided'
        }
      };
    }

    // Find the tasks.json path
    const tasksPath = findTasksJsonPath(args, log);
    
    // Check if tasks.json exists
    if (!fs.existsSync(tasksPath)) {
      return {
        success: false,
        error: {
          code: 'FILE_NOT_FOUND_ERROR',
          message: `Tasks file not found at ${tasksPath}`
        }
      };
    }
    
    let taskIds;
    
    // If all is specified, get all task IDs
    if (args.all) {
      log.info('Clearing subtasks from all tasks');
      const data = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
      if (!data || !data.tasks || data.tasks.length === 0) {
        return {
          success: false,
          error: {
            code: 'INPUT_VALIDATION_ERROR',
            message: 'No valid tasks found in the tasks file'
          }
        };
      }
      taskIds = data.tasks.map(t => t.id).join(',');
    } else {
      // Use the provided task IDs
      taskIds = args.id;
    }
    
    log.info(`Clearing subtasks from tasks: ${taskIds}`);
    
    // Call the core function
    clearSubtasks(tasksPath, taskIds);
    
    // Read the updated data to provide a summary
    const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
    const taskIdArray = taskIds.split(',').map(id => parseInt(id.trim(), 10));
    
    // Build a summary of what was done
    const clearedTasksCount = taskIdArray.length;
    const taskSummary = taskIdArray.map(id => {
      const task = updatedData.tasks.find(t => t.id === id);
      return task ? { id, title: task.title } : { id, title: 'Task not found' };
    });
    
    return {
      success: true,
      data: {
        message: `Successfully cleared subtasks from ${clearedTasksCount} task(s)`,
        tasksCleared: taskSummary
      }
    };
  } catch (error) {
    log.error(`Error in clearSubtasksDirect: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'CORE_FUNCTION_ERROR',
        message: error.message
      }
    };
  }
} 