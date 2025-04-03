/**
 * expand-task.js
 * Direct function implementation for expanding a task into subtasks
 */

import { expandTask } from '../../../../scripts/modules/task-manager.js';
import { readJSON, writeJSON } from '../../../../scripts/modules/utils.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import path from 'path';
import fs from 'fs';

/**
 * Direct function wrapper for expanding a task into subtasks with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Task expansion result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }
 */
export async function expandTaskDirect(args, log) {
  let tasksPath;
  try {
    // Find the tasks path first
    tasksPath = findTasksJsonPath(args, log);
  } catch (error) {
    log.error(`Tasks file not found: ${error.message}`);
    return { 
      success: false, 
      error: { 
        code: 'FILE_NOT_FOUND_ERROR', 
        message: error.message 
      }, 
      fromCache: false 
    };
  }

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
  const force = args.force === true;

  try {
    log.info(`Expanding task ${taskId} into ${numSubtasks || 'default'} subtasks. Research: ${useResearch}, Force: ${force}`);
    
    // Read tasks data
    const data = readJSON(tasksPath);
    if (!data || !data.tasks) {
      return { 
        success: false, 
        error: { 
          code: 'INVALID_TASKS_FILE', 
          message: `No valid tasks found in ${tasksPath}` 
        }, 
        fromCache: false
      };
    }
    
    // Find the specific task
    const task = data.tasks.find(t => t.id === taskId);
    
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
    
    // Call the core expandTask function
    await expandTask(taskId, numSubtasks, useResearch, additionalContext);
    
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