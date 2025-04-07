/**
 * update-tasks.js
 * Direct function implementation for updating tasks based on new context/prompt
 */

import { updateTasks } from '../../../../scripts/modules/task-manager.js';
import { enableSilentMode, disableSilentMode } from '../../../../scripts/modules/utils.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import { 
  getAnthropicClientForMCP, 
  getPerplexityClientForMCP 
} from '../utils/ai-client-utils.js';

/**
 * Direct function wrapper for updating tasks based on new context/prompt.
 * 
 * @param {Object} args - Command arguments containing fromId, prompt, useResearch and file path options.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateTasksDirect(args, log, context = {}) {
  const { session } = context; // Only extract session, not reportProgress
  
  try {
    log.info(`Updating tasks with args: ${JSON.stringify(args)}`);
    
    // Check for the common mistake of using 'id' instead of 'from'
    if (args.id !== undefined && args.from === undefined) {
      const errorMessage = "You specified 'id' parameter but 'update' requires 'from' parameter. Use 'from' for this tool or use 'update_task' tool if you want to update a single task.";
      log.error(errorMessage);
      return { 
        success: false, 
        error: { 
          code: 'PARAMETER_MISMATCH', 
          message: errorMessage,
          suggestion: "Use 'from' parameter instead of 'id', or use the 'update_task' tool for single task updates"
        },
        fromCache: false 
      };
    }
    
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
    
    // Initialize appropriate AI client based on research flag
    let aiClient;
    try {
      if (useResearch) {
        log.info('Using Perplexity AI for research-backed task updates');
        aiClient = await getPerplexityClientForMCP(session, log);
      } else {
        log.info('Using Claude AI for task updates');
        aiClient = getAnthropicClientForMCP(session, log);
      }
    } catch (error) {
      log.error(`Failed to initialize AI client: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'AI_CLIENT_ERROR',
          message: `Cannot initialize AI client: ${error.message}`
        },
        fromCache: false
      };
    }
    
    log.info(`Updating tasks from ID ${fromId} with prompt "${args.prompt}" and research: ${useResearch}`);
    
    try {
      // Enable silent mode to prevent console logs from interfering with JSON response
      enableSilentMode();
      
      // Execute core updateTasks function, passing the AI client and session
      await updateTasks(
        tasksPath, 
        fromId, 
        args.prompt, 
        useResearch, 
        { 
          mcpLog: log, 
          session 
        }
      );
      
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
    } finally {
      // Make sure to restore normal logging even if there's an error
      disableSilentMode();
    }
  } catch (error) {
    // Ensure silent mode is disabled
    disableSilentMode();
    
    log.error(`Error updating tasks: ${error.message}`);
    return { 
      success: false, 
      error: { code: 'UPDATE_TASKS_ERROR', message: error.message || 'Unknown error updating tasks' },
      fromCache: false 
    };
  }
} 