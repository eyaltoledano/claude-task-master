/**
 * Direct function wrapper for expandAllTasks
 */

import { expandAllTasks } from '../../../../scripts/modules/task-manager.js';
import { enableSilentMode, disableSilentMode, isSilentMode } from '../../../../scripts/modules/utils.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import { getAnthropicClientForMCP } from '../utils/ai-client-utils.js';
import path from 'path';
import fs from 'fs';

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
 * @param {Object} context - Context object containing session
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function expandAllTasksDirect(args, log, context = {}) {
  const { session } = context; // Only extract session, not reportProgress
  
  try {
    log.info(`Expanding all tasks with args: ${JSON.stringify(args)}`);
    
    // Enable silent mode early to prevent any console output
    enableSilentMode();
    
    try {
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
        
        // Initialize AI client for research-backed expansion
        try {
          await getAnthropicClientForMCP(session, log);
        } catch (error) {
          // Ensure silent mode is disabled before returning error
          disableSilentMode();
          
          log.error(`Failed to initialize AI client: ${error.message}`);
          return {
            success: false,
            error: {
              code: 'AI_CLIENT_ERROR',
              message: `Cannot initialize AI client: ${error.message}`
            }
          };
        }
      }
      
      if (additionalContext) {
        log.info(`Additional context: "${additionalContext}"`);
      }
      if (forceFlag) {
        log.info('Force regeneration of subtasks is enabled');
      }
      
      // Call the core function with session context for AI operations
      // and outputFormat as 'json' to prevent UI elements
      const result = await expandAllTasks(
        tasksPath,
        numSubtasks, 
        useResearch, 
        additionalContext, 
        forceFlag, 
        { mcpLog: log, session },
        'json' // Use JSON output format to prevent UI elements
      );
      
      // The expandAllTasks function now returns a result object
      return {
        success: true,
        data: {
          message: "Successfully expanded all pending tasks with subtasks",
          details: {
            numSubtasks: numSubtasks,
            research: useResearch,
            prompt: additionalContext,
            force: forceFlag,
            tasksExpanded: result.expandedCount,
            totalEligibleTasks: result.tasksToExpand
          }
        }
      };
    } finally {
      // Restore normal logging in finally block to ensure it runs even if there's an error
      disableSilentMode();
    }
  } catch (error) {
    // Ensure silent mode is disabled if an error occurs
    if (isSilentMode()) {
      disableSilentMode();
    }
    
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