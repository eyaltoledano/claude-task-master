/**
 * update-subtask-by-id.js
 * Direct function implementation for appending information to a specific subtask
 */

import { updateSubtaskById } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for updateSubtaskById with error handling.
 * 
 * @param {Object} args - Command arguments containing id, prompt, useResearch and file path options.
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateSubtaskByIdDirect(args, log) {
  try {
    log.info(`Updating subtask with args: ${JSON.stringify(args)}`);
    
    // Check required parameters
    if (!args.id) {
      const errorMessage = 'No subtask ID specified. Please provide a subtask ID to update.';
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'MISSING_SUBTASK_ID', message: errorMessage },
        fromCache: false 
      };
    }
    
    if (!args.prompt) {
      const errorMessage = 'No prompt specified. Please provide a prompt with information to add to the subtask.';
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'MISSING_PROMPT', message: errorMessage },
        fromCache: false 
      };
    }
    
    // Validate subtask ID format
    const subtaskId = args.id;
    if (typeof subtaskId !== 'string' || !subtaskId.includes('.')) {
      const errorMessage = `Invalid subtask ID format: ${subtaskId}. Subtask ID must be in format "parentId.subtaskId" (e.g., "5.2").`;
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'INVALID_SUBTASK_ID_FORMAT', message: errorMessage },
        fromCache: false 
      };
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
    
    log.info(`Updating subtask with ID ${subtaskId} with prompt "${args.prompt}" and research: ${useResearch}`);
    
    // Execute core updateSubtaskById function
    const updatedSubtask = await updateSubtaskById(tasksPath, subtaskId, args.prompt, useResearch);
    
    // Handle the case where the subtask couldn't be updated (e.g., already marked as done)
    if (!updatedSubtask) {
      return {
        success: false,
        error: { 
          code: 'SUBTASK_UPDATE_FAILED', 
          message: 'Failed to update subtask. It may be marked as completed, or another error occurred.' 
        },
        fromCache: false
      };
    }
    
    // Return the updated subtask information
    return {
      success: true,
      data: {
        message: `Successfully updated subtask with ID ${subtaskId}`,
        subtaskId,
        parentId: subtaskId.split('.')[0],
        subtask: updatedSubtask,
        tasksPath,
        useResearch
      },
      fromCache: false // This operation always modifies state and should never be cached
    };
  } catch (error) {
    log.error(`Error updating subtask by ID: ${error.message}`);
    return { 
      success: false, 
      error: { code: 'UPDATE_SUBTASK_ERROR', message: error.message || 'Unknown error updating subtask' },
      fromCache: false 
    };
  }
} 