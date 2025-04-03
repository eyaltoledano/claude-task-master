/**
 * generate-task-files.js
 * Direct function implementation for generating task files from tasks.json
 */

import { generateTaskFiles } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import path from 'path';

/**
 * Direct function wrapper for generateTaskFiles with error handling.
 * 
 * @param {Object} args - Command arguments containing file and output path options.
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function generateTaskFilesDirect(args, log) {
  try {
    log.info(`Generating task files with args: ${JSON.stringify(args)}`);
    
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
    
    // Get output directory (defaults to the same directory as the tasks file)
    let outputDir = args.output;
    if (!outputDir) {
      outputDir = path.dirname(tasksPath);
    }
    
    log.info(`Generating task files from ${tasksPath} to ${outputDir}`);
    
    // Execute core generateTaskFiles function
    generateTaskFiles(tasksPath, outputDir);
    
    // Return success with file paths
    return {
      success: true,
      data: {
        message: `Successfully generated task files`,
        tasksPath,
        outputDir,
        taskFiles: 'Individual task files have been generated in the output directory'
      },
      fromCache: false // This operation always modifies state and should never be cached
    };
  } catch (error) {
    log.error(`Error generating task files: ${error.message}`);
    return { 
      success: false, 
      error: { code: 'GENERATE_TASKS_ERROR', message: error.message || 'Unknown error generating task files' },
      fromCache: false 
    };
  }
} 