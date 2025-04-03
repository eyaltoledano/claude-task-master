/**
 * Direct function wrapper for validateDependenciesCommand
 */

import { validateDependenciesCommand } from '../../../../scripts/modules/dependency-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import fs from 'fs';

/**
 * Validate dependencies in tasks.json
 * @param {Object} args - Function arguments
 * @param {string} [args.file] - Path to the tasks file
 * @param {string} [args.projectRoot] - Project root directory
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function validateDependenciesDirect(args, log) {
  try {
    log.info(`Validating dependencies in tasks...`);
    
    // Find the tasks.json path
    const tasksPath = findTasksJsonPath(args, log);
    
    // Verify the file exists
    if (!fs.existsSync(tasksPath)) {
      return {
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: `Tasks file not found at ${tasksPath}`
        }
      };
    }
    
    // Call the original command function
    await validateDependenciesCommand(tasksPath);
    
    return {
      success: true,
      data: {
        message: 'Dependencies validated successfully',
        tasksPath
      }
    };
  } catch (error) {
    log.error(`Error validating dependencies: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message
      }
    };
  }
} 