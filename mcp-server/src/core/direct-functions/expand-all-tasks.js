/**
 * Direct function wrapper for expandAllTasks
 */

import { expandAllTasks } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Expand all pending tasks with subtasks
 * @param {Object} args - Function arguments
 * @param {number|string} [args.num] - Number of subtasks to generate
 * @param {boolean} [args.research] - Enable Perplexity AI for research-backed subtask generation
 * @param {string} [args.prompt] - Additional context to guide subtask generation
 * @param {boolean} [args.force] - Force regeneration of subtasks for tasks that already have them
 * @param {string} [args.file] - Path to the tasks file
 * @param {string} [args.projectRoot] - Project root directory
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function expandAllTasksDirect(args, log) {
  try {
    log.info(`Expanding all tasks with args: ${JSON.stringify(args)}`);
    
    // Find the tasks.json path
    const tasksPath = findTasksJsonPath(args, log);
    
    // Parse parameters
    const numSubtasks = args.num ? parseInt(args.num, 10) : undefined;
    const useResearch = args.research === true;
    const additionalContext = args.prompt || '';
    const forceFlag = args.force === true;
    
    log.info(`Expanding all tasks with ${numSubtasks || 'default'} subtasks each...`);
    if (useResearch) {
      log.info('Using Perplexity AI for research-backed subtask generation');
    }
    if (additionalContext) {
      log.info(`Additional context: "${additionalContext}"`);
    }
    if (forceFlag) {
      log.info('Force regeneration of subtasks is enabled');
    }
    
    // Call the core function
    await expandAllTasks(numSubtasks, useResearch, additionalContext, forceFlag);
    
    // The expandAllTasks function doesn't have a return value, so we'll create our own success response
    return {
      success: true,
      data: {
        message: "Successfully expanded all pending tasks with subtasks",
        details: {
          numSubtasks: numSubtasks,
          research: useResearch,
          prompt: additionalContext,
          force: forceFlag
        }
      }
    };
  } catch (error) {
    log.error(`Error in expandAllTasksDirect: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'CORE_FUNCTION_ERROR',
        message: error.message
      }
    };
  }
} 