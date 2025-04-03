/**
 * list-tasks.js
 * Direct function implementation for listing tasks
 */

import { listTasks } from '../../../../scripts/modules/task-manager.js';
import { getCachedOrExecute } from '../../tools/utils.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for listTasks with error handling and caching.
 *
 * @param {Object} args - Command arguments (projectRoot is expected to be resolved).
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Task list result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }.
 */
export async function listTasksDirect(args, log) {
  let tasksPath;
  try {
    // Find the tasks path first - needed for cache key and execution
    tasksPath = findTasksJsonPath(args, log);
  } catch (error) {
    if (error.code === 'TASKS_FILE_NOT_FOUND') {
      log.error(`Tasks file not found: ${error.message}`);
      // Return the error structure expected by the calling tool/handler
      return { success: false, error: { code: error.code, message: error.message }, fromCache: false };
    }
    log.error(`Unexpected error finding tasks file: ${error.message}`);
    // Re-throw for outer catch or return structured error
     return { success: false, error: { code: 'FIND_TASKS_PATH_ERROR', message: error.message }, fromCache: false };
  }

  // Generate cache key *after* finding tasksPath
  const statusFilter = args.status || 'all';
  const withSubtasks = args.withSubtasks || false;
  const cacheKey = `listTasks:${tasksPath}:${statusFilter}:${withSubtasks}`;
  
  // Define the action function to be executed on cache miss
  const coreListTasksAction = async () => {
    try {
      log.info(`Executing core listTasks function for path: ${tasksPath}, filter: ${statusFilter}, subtasks: ${withSubtasks}`);
      const resultData = listTasks(tasksPath, statusFilter, withSubtasks, 'json');

      if (!resultData || !resultData.tasks) {
        log.error('Invalid or empty response from listTasks core function');
        return { success: false, error: { code: 'INVALID_CORE_RESPONSE', message: 'Invalid or empty response from listTasks core function' } };
      }
      log.info(`Core listTasks function retrieved ${resultData.tasks.length} tasks`);
      return { success: true, data: resultData };

    } catch (error) {
      log.error(`Core listTasks function failed: ${error.message}`);
      return { success: false, error: { code: 'LIST_TASKS_CORE_ERROR', message: error.message || 'Failed to list tasks' } };
    }
  };

  // Use the caching utility
  try {
      const result = await getCachedOrExecute({
          cacheKey,
          actionFn: coreListTasksAction,
          log
      });
      log.info(`listTasksDirect completed. From cache: ${result.fromCache}`);
      return result; // Returns { success, data/error, fromCache }
  } catch(error) {
      // Catch unexpected errors from getCachedOrExecute itself (though unlikely)
      log.error(`Unexpected error during getCachedOrExecute for listTasks: ${error.message}`);
      console.error(error.stack);
      return { success: false, error: { code: 'CACHE_UTIL_ERROR', message: error.message }, fromCache: false };
  }
} 