/**
 * show-task.js
 * Direct function implementation for showing task details
 */

import { findTaskById } from '../../../../scripts/modules/utils.js';
import { readJSON } from '../../../../scripts/modules/utils.js';
import { getCachedOrExecute } from '../../tools/utils.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for showing task details with error handling and caching.
 *
 * @param {Object} args - Command arguments
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Task details result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }
 */
export async function showTaskDirect(args, log) {
  let tasksPath;
  try {
    // Find the tasks path first - needed for cache key and execution
    tasksPath = findTasksJsonPath(args, log);
  } catch (error) {
    log.error(`Tasks file not found: ${error.message}`);
    return { 
      success: false, 
      error: { 
        code: 'FILE_NOT_FOUND_ERROR', 
        message: error.message 
      }, 
      fromCache: false 
    };
  }

  // Validate task ID
  const taskId = args.id;
  if (!taskId) {
    log.error('Task ID is required');
    return { 
      success: false, 
      error: { 
        code: 'INPUT_VALIDATION_ERROR', 
        message: 'Task ID is required' 
      }, 
      fromCache: false 
    };
  }

  // Generate cache key using task path and ID
  const cacheKey = `showTask:${tasksPath}:${taskId}`;
  
  // Define the action function to be executed on cache miss
  const coreShowTaskAction = async () => {
    try {
      log.info(`Retrieving task details for ID: ${taskId} from ${tasksPath}`);
      
      // Read tasks data
      const data = readJSON(tasksPath);
      if (!data || !data.tasks) {
        return { 
          success: false, 
          error: { 
            code: 'INVALID_TASKS_FILE', 
            message: `No valid tasks found in ${tasksPath}` 
          } 
        };
      }
      
      // Find the specific task
      const task = findTaskById(data.tasks, taskId);
      
      if (!task) {
        return { 
          success: false, 
          error: { 
            code: 'TASK_NOT_FOUND', 
            message: `Task with ID ${taskId} not found` 
          } 
        };
      }
      
      // Return the task data with the full tasks array for reference
      // (needed for formatDependenciesWithStatus function in UI)
      log.info(`Successfully found task ${taskId}`);
      return { 
        success: true, 
        data: { 
          task, 
          allTasks: data.tasks 
        } 
      };
    } catch (error) {
      log.error(`Error showing task: ${error.message}`);
      return { 
        success: false, 
        error: { 
          code: 'CORE_FUNCTION_ERROR', 
          message: error.message || 'Failed to show task details' 
        } 
      };
    }
  };

  // Use the caching utility
  try {
    const result = await getCachedOrExecute({
      cacheKey,
      actionFn: coreShowTaskAction,
      log
    });
    log.info(`showTaskDirect completed. From cache: ${result.fromCache}`);
    return result; // Returns { success, data/error, fromCache }
  } catch (error) {
    // Catch unexpected errors from getCachedOrExecute itself
    log.error(`Unexpected error during getCachedOrExecute for showTask: ${error.message}`);
    return { 
      success: false, 
      error: { 
        code: 'UNEXPECTED_ERROR', 
        message: error.message 
      }, 
      fromCache: false 
    };
  }
} 