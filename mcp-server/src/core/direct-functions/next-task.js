/**
 * next-task.js
 * Direct function implementation for finding the next task to work on
 */

import { findNextTask } from '../../../../scripts/modules/task-manager.js';
import { readJSON } from '../../../../scripts/modules/utils.js';
import { getCachedOrExecute } from '../../tools/utils.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for finding the next task to work on with error handling and caching.
 *
 * @param {Object} args - Command arguments
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Next task result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }
 */
export async function nextTaskDirect(args, log) {
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

  // Generate cache key using task path
  const cacheKey = `nextTask:${tasksPath}`;
  
  // Define the action function to be executed on cache miss
  const coreNextTaskAction = async () => {
    try {
      log.info(`Finding next task from ${tasksPath}`);
      
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
      
      // Find the next task
      const nextTask = findNextTask(data.tasks);
      
      if (!nextTask) {
        log.info('No eligible next task found. All tasks are either completed or have unsatisfied dependencies');
        return { 
          success: true, 
          data: { 
            message: 'No eligible next task found. All tasks are either completed or have unsatisfied dependencies',
            nextTask: null,
            allTasks: data.tasks 
          } 
        };
      }
      
      // Return the next task data with the full tasks array for reference
      log.info(`Successfully found next task ${nextTask.id}: ${nextTask.title}`);
      return { 
        success: true, 
        data: { 
          nextTask, 
          allTasks: data.tasks 
        } 
      };
    } catch (error) {
      log.error(`Error finding next task: ${error.message}`);
      return { 
        success: false, 
        error: { 
          code: 'CORE_FUNCTION_ERROR', 
          message: error.message || 'Failed to find next task' 
        } 
      };
    }
  };

  // Use the caching utility
  try {
    const result = await getCachedOrExecute({
      cacheKey,
      actionFn: coreNextTaskAction,
      log
    });
    log.info(`nextTaskDirect completed. From cache: ${result.fromCache}`);
    return result; // Returns { success, data/error, fromCache }
  } catch (error) {
    // Catch unexpected errors from getCachedOrExecute itself
    log.error(`Unexpected error during getCachedOrExecute for nextTask: ${error.message}`);
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