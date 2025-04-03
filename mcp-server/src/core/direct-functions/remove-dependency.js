/**
 * Direct function wrapper for removeDependency
 */

import { removeDependency } from '../../../../scripts/modules/dependency-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Remove a dependency from a task
 * @param {Object} args - Function arguments
 * @param {string|number} args.id - Task ID to remove dependency from
 * @param {string|number} args.dependsOn - Task ID to remove as a dependency
 * @param {string} [args.file] - Path to the tasks file
 * @param {string} [args.projectRoot] - Project root directory
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function removeDependencyDirect(args, log) {
  try {
    log.info(`Removing dependency with args: ${JSON.stringify(args)}`);
    
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
    
    log.info(`Removing dependency: task ${taskId} no longer depends on ${dependencyId}`);
    
    // Call the core function
    await removeDependency(tasksPath, taskId, dependencyId);
    
    return {
      success: true,
      data: {
        message: `Successfully removed dependency: Task ${taskId} no longer depends on ${dependencyId}`,
        taskId: taskId,
        dependencyId: dependencyId
      }
    };
  } catch (error) {
    log.error(`Error in removeDependencyDirect: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'CORE_FUNCTION_ERROR',
        message: error.message
      }
    };
  }
} 