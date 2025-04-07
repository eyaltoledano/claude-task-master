/**
 * expand-task.js
 * Direct function implementation for expanding a task into subtasks
 */

import { expandTask } from '../../../../scripts/modules/task-manager.js';
import { readJSON, writeJSON, enableSilentMode, disableSilentMode, isSilentMode } from '../../../../scripts/modules/utils.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import { getAnthropicClientForMCP, getModelConfig } from '../utils/ai-client-utils.js';
import path from 'path';
import fs from 'fs';

/**
 * Direct function wrapper for expanding a task into subtasks with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {Object} log - Logger object
 * @param {Object} context - Context object containing session and reportProgress
 * @returns {Promise<Object>} - Task expansion result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }
 */
export async function expandTaskDirect(args, log, context = {}) {
  const { session } = context;
  
  // Log session root data for debugging
  log.info(`Session data in expandTaskDirect: ${JSON.stringify({
    hasSession: !!session,
    sessionKeys: session ? Object.keys(session) : [],
    roots: session?.roots,
    rootsStr: JSON.stringify(session?.roots)
  })}`);
  
  let tasksPath;
  try {
    // If a direct file path is provided, use it directly
    if (args.file && fs.existsSync(args.file)) {
      log.info(`[expandTaskDirect] Using explicitly provided tasks file: ${args.file}`);
      tasksPath = args.file;
    } else {
      // Find the tasks path through standard logic
      log.info(`[expandTaskDirect] No direct file path provided or file not found at ${args.file}, searching using findTasksJsonPath`);
      tasksPath = findTasksJsonPath(args, log);
    }
  } catch (error) {
    log.error(`[expandTaskDirect] Error during tasksPath determination: ${error.message}`);
    
    // Include session roots information in error
    const sessionRootsInfo = session ? 
      `\nSession.roots: ${JSON.stringify(session.roots)}\n` +
      `Current Working Directory: ${process.cwd()}\n` +
      `Args.projectRoot: ${args.projectRoot}\n` +
      `Args.file: ${args.file}\n` : 
      '\nSession object not available';
    
    return { 
      success: false, 
      error: { 
        code: 'FILE_NOT_FOUND_ERROR', 
        message: `Error determining tasksPath: ${error.message}${sessionRootsInfo}` 
      }, 
      fromCache: false 
    };
  }

  log.info(`[expandTaskDirect] Determined tasksPath: ${tasksPath}`);

  // Validate task ID
  const taskId = args.id ? parseInt(args.id, 10) : null;
  if (!taskId) {
    log.error('Task ID is required');
    return { 
      success: false, 
      error: { 
        code: 'INPUT_VALIDATION_ERROR', 
        message: 'Task ID is required' 
      }, 
      fromCache: false 
    };
  }

  // Process other parameters
  const numSubtasks = args.num ? parseInt(args.num, 10) : undefined;
  const useResearch = args.research === true;
  const additionalContext = args.prompt || '';

  // Initialize AI client if needed (for expandTask function)
  try {
    // This ensures the AI client is available by checking it
    if (useResearch) {
      log.info('Verifying AI client for research-backed expansion');
      await getAnthropicClientForMCP(session, log);
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

  try {
    log.info(`[expandTaskDirect] Expanding task ${taskId} into ${numSubtasks || 'default'} subtasks. Research: ${useResearch}`);
    
    // Read tasks data
    log.info(`[expandTaskDirect] Attempting to read JSON from: ${tasksPath}`);
    const data = readJSON(tasksPath);
    log.info(`[expandTaskDirect] Result of readJSON: ${data ? 'Data read successfully' : 'readJSON returned null or undefined'}`);

    if (!data || !data.tasks) {
      log.error(`[expandTaskDirect] readJSON failed or returned invalid data for path: ${tasksPath}`);
      return {
        success: false,
        error: {
          code: 'INVALID_TASKS_FILE',
          message: `No valid tasks found in ${tasksPath}. readJSON returned: ${JSON.stringify(data)}`
        },
        fromCache: false
      };
    }
    
    // Find the specific task
    log.info(`[expandTaskDirect] Searching for task ID ${taskId} in data`);
    const task = data.tasks.find(t => t.id === taskId);
    log.info(`[expandTaskDirect] Task found: ${task ? 'Yes' : 'No'}`);
    
    if (!task) {
      return { 
        success: false, 
        error: { 
          code: 'TASK_NOT_FOUND', 
          message: `Task with ID ${taskId} not found` 
        }, 
        fromCache: false
      };
    }
    
    // Check if task is completed
    if (task.status === 'done' || task.status === 'completed') {
      return { 
        success: false, 
        error: { 
          code: 'TASK_COMPLETED', 
          message: `Task ${taskId} is already marked as ${task.status} and cannot be expanded` 
        }, 
        fromCache: false
      };
    }
    
    // Check for existing subtasks
    const hasExistingSubtasks = task.subtasks && task.subtasks.length > 0;
    
    // If the task already has subtasks, just return it (matching core behavior)
    if (hasExistingSubtasks) {
      log.info(`Task ${taskId} already has ${task.subtasks.length} subtasks`);
      return { 
        success: true, 
        data: { 
          task,
          subtasksAdded: 0,
          hasExistingSubtasks
        }, 
        fromCache: false 
      };
    }
    
    // Keep a copy of the task before modification
    const originalTask = JSON.parse(JSON.stringify(task));
    
    // Tracking subtasks count before expansion
    const subtasksCountBefore = task.subtasks ? task.subtasks.length : 0;
    
    // Create a backup of the tasks.json file
    const backupPath = path.join(path.dirname(tasksPath), 'tasks.json.bak');
    fs.copyFileSync(tasksPath, backupPath);
    
    // Directly modify the data instead of calling the CLI function
    if (!task.subtasks) {
      task.subtasks = [];
    }
    
    // Save tasks.json with potentially empty subtasks array
    writeJSON(tasksPath, data);
    
    // Process the request
    try {
      // Enable silent mode to prevent console logs from interfering with JSON response
      enableSilentMode();
      
      // Call expandTask with session context to ensure AI client is properly initialized
      const result = await expandTask(
        tasksPath,
        taskId, 
        numSubtasks, 
        useResearch, 
        additionalContext, 
        { mcpLog: log, session } // Only pass mcpLog and session, NOT reportProgress
      );
      
      // Restore normal logging
      disableSilentMode();
      
      // Read the updated data
      const updatedData = readJSON(tasksPath);
      const updatedTask = updatedData.tasks.find(t => t.id === taskId);
      
      // Calculate how many subtasks were added
      const subtasksAdded = updatedTask.subtasks ? 
        updatedTask.subtasks.length - subtasksCountBefore : 0;
      
      // Return the result
      log.info(`Successfully expanded task ${taskId} with ${subtasksAdded} new subtasks`);
      return { 
        success: true, 
        data: { 
          task: updatedTask,
          subtasksAdded,
          hasExistingSubtasks
        }, 
        fromCache: false 
      };
    } catch (error) {
      // Make sure to restore normal logging even if there's an error
      disableSilentMode();
      
      log.error(`Error expanding task: ${error.message}`);
      return { 
        success: false, 
        error: { 
          code: 'CORE_FUNCTION_ERROR', 
          message: error.message || 'Failed to expand task' 
        }, 
        fromCache: false 
      };
    }
  } catch (error) {
    log.error(`Error expanding task: ${error.message}`);
    return { 
      success: false, 
      error: { 
        code: 'CORE_FUNCTION_ERROR', 
        message: error.message || 'Failed to expand task' 
      }, 
      fromCache: false 
    };
  }
} 