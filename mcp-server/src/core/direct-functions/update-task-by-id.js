/**
 * update-task-by-id.js
 * Direct function implementation for updating a single task by ID with new information
 */

import { updateTaskById } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for updateTaskById with error handling.
 * 
 * @param {Object} args - Command arguments containing id, prompt, useResearch and file path options.
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateTaskByIdDirect(args, log) {
  try {
    log.info(`Updating task with args: ${JSON.stringify(args)}`);
    
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
    
    if (!args.prompt) {
      const errorMessage = 'No prompt specified. Please provide a prompt with new information for the task update.';
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'MISSING_PROMPT', message: errorMessage },
        fromCache: false 
      };
    }
    
    // Parse taskId - handle both string and number values
    let taskId;
    if (typeof args.id === 'string') {
      // Handle subtask IDs (e.g., "5.2")
      if (args.id.includes('.')) {
        taskId = args.id; // Keep as string for subtask IDs
      } else {
        // Parse as integer for main task IDs
        taskId = parseInt(args.id, 10);
        if (isNaN(taskId)) {
          const errorMessage = `Invalid task ID: ${args.id}. Task ID must be a positive integer or subtask ID (e.g., "5.2").`;
          log.error(errorMessage);
          return { 
            success: false, 
            error: { code: 'INVALID_TASK_ID', message: errorMessage },
            fromCache: false 
          };
        }
      }
    } else {
      taskId = args.id;
    }
    
    // Get tasks file path
    let tasksPath;
    try {
      tasksPath = findTasksJsonPath(args, log);
    } catch (error) {
      log.error(`Error finding tasks file: ${error.message}`);
      return { 
        success: false, 
        error: { code: 'TASKS_FILE_ERROR', message: error.message },
        fromCache: false 
      };
    }
    
    // Get research flag
    const useResearch = args.research === true;
    
    log.info(`Updating task with ID ${taskId} with prompt "${args.prompt}" and research: ${useResearch}`);
    
    // Execute core updateTaskById function
    await updateTaskById(tasksPath, taskId, args.prompt, useResearch);
    
    // Since updateTaskById doesn't return a value but modifies the tasks file,
    // we'll return a success message
    return {
      success: true,
      data: {
        message: `Successfully updated task with ID ${taskId} based on the prompt`,
        taskId,
        tasksPath,
        useResearch
      },
      fromCache: false // This operation always modifies state and should never be cached
    };
  } catch (error) {
    log.error(`Error updating task by ID: ${error.message}`);
    return { 
      success: false, 
      error: { code: 'UPDATE_TASK_ERROR', message: error.message || 'Unknown error updating task' },
      fromCache: false 
    };
  }
} 