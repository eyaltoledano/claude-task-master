/**
 * add-dependency.js
 * Direct function implementation for adding a dependency to a task
 */

import { addDependency } from '../../../../scripts/modules/dependency-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for addDependency with error handling.
 * 
 * @param {Object} args - Command arguments
 * @param {string|number} args.id - Task ID to add dependency to
 * @param {string|number} args.dependsOn - Task ID that will become a dependency
 * @param {string} [args.file] - Path to the tasks file
 * @param {string} [args.projectRoot] - Project root directory
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Result object with success status and data/error information
 */
export async function addDependencyDirect(args, log) {
  try {
    log.info(`Adding dependency with args: ${JSON.stringify(args)}`);
    
    // Validate required parameters
    if (!args.id) {
      return {
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: 'Task ID (id) is required'
        }
      };
    }
    
    if (!args.dependsOn) {
      return {
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: 'Dependency ID (dependsOn) is required'
        }
      };
    }
    
    // Find the tasks.json path
    const tasksPath = findTasksJsonPath(args, log);
    
    // Format IDs for the core function
    const taskId = args.id.includes && args.id.includes('.') ? args.id : parseInt(args.id, 10);
    const dependencyId = args.dependsOn.includes && args.dependsOn.includes('.') ? args.dependsOn : parseInt(args.dependsOn, 10);
    
    log.info(`Adding dependency: task ${taskId} will depend on ${dependencyId}`);
    
    // Call the core function
    await addDependency(tasksPath, taskId, dependencyId);
    
    return {
      success: true,
      data: {
        message: `Successfully added dependency: Task ${taskId} now depends on ${dependencyId}`,
        taskId: taskId,
        dependencyId: dependencyId
      }
    };
  } catch (error) {
    log.error(`Error in addDependencyDirect: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'CORE_FUNCTION_ERROR',
        message: error.message
      }
    };
  }
} 