/**
 * set-task-status.js
 * Direct function implementation for setting task status
 */

import { setTaskStatus } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for setTaskStatus with error handling.
 * 
 * @param {Object} args - Command arguments containing id, status and file path options.
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function setTaskStatusDirect(args, log) {
  try {
    log.info(`Setting task status with args: ${JSON.stringify(args)}`);
    
    // Check required parameters
    if (!args.id) {
      const errorMessage = 'No task ID specified. Please provide a task ID to update.';
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'MISSING_TASK_ID', message: errorMessage },
        fromCache: false 
      };
    }
    
    if (!args.status) {
      const errorMessage = 'No status specified. Please provide a new status value.';
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'MISSING_STATUS', message: errorMessage },
        fromCache: false 
      };
    }
    
    // Get tasks file path
    let tasksPath;
    try {
      // The enhanced findTasksJsonPath will now search in parent directories if needed
      tasksPath = findTasksJsonPath(args, log);
      log.info(`Found tasks file at: ${tasksPath}`);
    } catch (error) {
      log.error(`Error finding tasks file: ${error.message}`);
      return { 
        success: false, 
        error: { 
          code: 'TASKS_FILE_ERROR', 
          message: `${error.message}\n\nPlease ensure you are in a Task Master project directory or use the --project-root parameter to specify the path to your project.`
        },
        fromCache: false 
      };
    }
    
    // Execute core setTaskStatus function
    // We need to handle the arguments correctly - this function expects tasksPath, taskIdInput, newStatus
    const taskId = args.id;
    const newStatus = args.status;
    
    log.info(`Setting task ${taskId} status to "${newStatus}"`);
    
    // Execute the setTaskStatus function with source=mcp to avoid console output
    await setTaskStatus(tasksPath, taskId, newStatus);
    
    // Return success data
    return {
      success: true,
      data: {
        message: `Successfully updated task ${taskId} status to "${newStatus}"`,
        taskId,
        status: newStatus,
        tasksPath
      },
      fromCache: false // This operation always modifies state and should never be cached
    };
  } catch (error) {
    log.error(`Error setting task status: ${error.message}`);
    return { 
      success: false, 
      error: { code: 'SET_STATUS_ERROR', message: error.message || 'Unknown error setting task status' },
      fromCache: false 
    };
  }
} 