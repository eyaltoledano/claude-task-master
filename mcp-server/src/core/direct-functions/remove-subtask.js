/**
 * Direct function wrapper for removeSubtask
 */

import { removeSubtask } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Remove a subtask from its parent task
 * @param {Object} args - Function arguments
 * @param {string} args.id - Subtask ID in format "parentId.subtaskId" (required)
 * @param {boolean} [args.convert] - Whether to convert the subtask to a standalone task
 * @param {string} [args.file] - Path to the tasks file
 * @param {boolean} [args.skipGenerate] - Skip regenerating task files
 * @param {string} [args.projectRoot] - Project root directory
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function removeSubtaskDirect(args, log) {
  try {
    log.info(`Removing subtask with args: ${JSON.stringify(args)}`);
    
    if (!args.id) {
      return {
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: 'Subtask ID is required and must be in format "parentId.subtaskId"'
        }
      };
    }
    
    // Validate subtask ID format
    if (!args.id.includes('.')) {
      return {
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: `Invalid subtask ID format: ${args.id}. Expected format: "parentId.subtaskId"`
        }
      };
    }

    // Find the tasks.json path
    const tasksPath = findTasksJsonPath(args, log);
    
    // Convert convertToTask to a boolean
    const convertToTask = args.convert === true;
    
    // Determine if we should generate files
    const generateFiles = !args.skipGenerate;
    
    log.info(`Removing subtask ${args.id} (convertToTask: ${convertToTask}, generateFiles: ${generateFiles})`);
    
    const result = await removeSubtask(tasksPath, args.id, convertToTask, generateFiles);
    
    if (convertToTask && result) {
      // Return info about the converted task
      return {
        success: true,
        data: {
          message: `Subtask ${args.id} successfully converted to task #${result.id}`,
          task: result
        }
      };
    } else {
      // Return simple success message for deletion
      return {
        success: true,
        data: {
          message: `Subtask ${args.id} successfully removed`
        }
      };
    }
  } catch (error) {
    log.error(`Error in removeSubtaskDirect: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'CORE_FUNCTION_ERROR',
        message: error.message
      }
    };
  }
} 