/**
 * Direct function wrapper for addSubtask
 */

import { addSubtask } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Add a subtask to an existing task
 * @param {Object} args - Function arguments
 * @param {string} args.id - Parent task ID
 * @param {string} [args.taskId] - Existing task ID to convert to subtask (optional)
 * @param {string} [args.title] - Title for new subtask (when creating a new subtask)
 * @param {string} [args.description] - Description for new subtask
 * @param {string} [args.details] - Implementation details for new subtask
 * @param {string} [args.status] - Status for new subtask (default: 'pending')
 * @param {string} [args.dependencies] - Comma-separated list of dependency IDs
 * @param {string} [args.file] - Path to the tasks file
 * @param {boolean} [args.skipGenerate] - Skip regenerating task files
 * @param {string} [args.projectRoot] - Project root directory
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function addSubtaskDirect(args, log) {
  try {
    log.info(`Adding subtask with args: ${JSON.stringify(args)}`);
    
    if (!args.id) {
      return {
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: 'Parent task ID is required'
        }
      };
    }
    
    // Either taskId or title must be provided
    if (!args.taskId && !args.title) {
      return {
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: 'Either taskId or title must be provided'
        }
      };
    }

    // Find the tasks.json path
    const tasksPath = findTasksJsonPath(args, log);
    
    // Parse dependencies if provided
    let dependencies = [];
    if (args.dependencies) {
      dependencies = args.dependencies.split(',').map(id => {
        // Handle both regular IDs and dot notation
        return id.includes('.') ? id.trim() : parseInt(id.trim(), 10);
      });
    }
    
    // Convert existingTaskId to a number if provided
    const existingTaskId = args.taskId ? parseInt(args.taskId, 10) : null;
    
    // Convert parent ID to a number
    const parentId = parseInt(args.id, 10);
    
    // Determine if we should generate files
    const generateFiles = !args.skipGenerate;
    
    // Case 1: Convert existing task to subtask
    if (existingTaskId) {
      log.info(`Converting task ${existingTaskId} to a subtask of ${parentId}`);
      const result = await addSubtask(tasksPath, parentId, existingTaskId, null, generateFiles);
      return {
        success: true,
        data: {
          message: `Task ${existingTaskId} successfully converted to a subtask of task ${parentId}`,
          subtask: result
        }
      };
    } 
    // Case 2: Create new subtask
    else {
      log.info(`Creating new subtask for parent task ${parentId}`);
      
      const newSubtaskData = {
        title: args.title,
        description: args.description || '',
        details: args.details || '',
        status: args.status || 'pending',
        dependencies: dependencies
      };
      
      const result = await addSubtask(tasksPath, parentId, null, newSubtaskData, generateFiles);
      return {
        success: true,
        data: {
          message: `New subtask ${parentId}.${result.id} successfully created`,
          subtask: result
        }
      };
    }
  } catch (error) {
    log.error(`Error in addSubtaskDirect: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'CORE_FUNCTION_ERROR',
        message: error.message
      }
    };
  }
} 