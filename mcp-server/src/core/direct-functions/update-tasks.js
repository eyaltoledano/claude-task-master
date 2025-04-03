/**
 * update-tasks.js
 * Direct function implementation for updating tasks based on new context/prompt
 */

import { updateTasks } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for updating tasks based on new context/prompt.
 * 
 * @param {Object} args - Command arguments containing fromId, prompt, useResearch and file path options.
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateTasksDirect(args, log) {
  try {
    log.info(`Updating tasks with args: ${JSON.stringify(args)}`);
    
    // Check required parameters
    if (!args.from) {
      const errorMessage = 'No from ID specified. Please provide a task ID to start updating from.';
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'MISSING_FROM_ID', message: errorMessage },
        fromCache: false 
      };
    }
    
    if (!args.prompt) {
      const errorMessage = 'No prompt specified. Please provide a prompt with new context for task updates.';
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'MISSING_PROMPT', message: errorMessage },
        fromCache: false 
      };
    }
    
    // Parse fromId - handle both string and number values
    let fromId;
    if (typeof args.from === 'string') {
      fromId = parseInt(args.from, 10);
      if (isNaN(fromId)) {
        const errorMessage = `Invalid from ID: ${args.from}. Task ID must be a positive integer.`;
        log.error(errorMessage);
        return { 
          success: false, 
          error: { code: 'INVALID_FROM_ID', message: errorMessage },
          fromCache: false 
        };
      }
    } else {
      fromId = args.from;
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
    
    log.info(`Updating tasks from ID ${fromId} with prompt "${args.prompt}" and research: ${useResearch}`);
    
    // Execute core updateTasks function
    await updateTasks(tasksPath, fromId, args.prompt, useResearch);
    
    // Since updateTasks doesn't return a value but modifies the tasks file,
    // we'll return a success message
    return {
      success: true,
      data: {
        message: `Successfully updated tasks from ID ${fromId} based on the prompt`,
        fromId,
        tasksPath,
        useResearch
      },
      fromCache: false // This operation always modifies state and should never be cached
    };
  } catch (error) {
    log.error(`Error updating tasks: ${error.message}`);
    return { 
      success: false, 
      error: { code: 'UPDATE_TASKS_ERROR', message: error.message || 'Unknown error updating tasks' },
      fromCache: false 
    };
  }
} 