/**
 * add-task.js
 * Direct function implementation for adding a new task
 */

import { addTask } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import { enableSilentMode, disableSilentMode } from '../../../../scripts/modules/utils.js';
import { getAnthropicClientForMCP, getModelConfig } from '../utils/ai-client-utils.js';
import { _buildAddTaskPrompt, parseTaskJsonResponse, _handleAnthropicStream } from '../../../../scripts/modules/ai-services.js';

/**
 * Direct function wrapper for adding a new task with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.prompt - Description of the task to add
 * @param {Array<number>} [args.dependencies=[]] - Task dependencies as array of IDs
 * @param {string} [args.priority='medium'] - Task priority (high, medium, low)
 * @param {string} [args.file] - Path to the tasks file
 * @param {string} [args.projectRoot] - Project root directory
 * @param {boolean} [args.research] - Whether to use research capabilities for task creation
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context (reportProgress, session)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function addTaskDirect(args, log, context = {}) {
  try {
    // Enable silent mode to prevent console logs from interfering with JSON response
    enableSilentMode();
    
    // Find the tasks.json path
    const tasksPath = findTasksJsonPath(args, log);
    
    // Check required parameters
    if (!args.prompt) {
      log.error('Missing required parameter: prompt');
      disableSilentMode();
      return {
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'The prompt parameter is required for adding a task'
        }
      };
    }
    
    // Extract and prepare parameters
    const prompt = args.prompt;
    const dependencies = Array.isArray(args.dependencies) 
      ? args.dependencies 
      : (args.dependencies ? String(args.dependencies).split(',').map(id => parseInt(id.trim(), 10)) : []);
    const priority = args.priority || 'medium';
    
    log.info(`Adding new task with prompt: "${prompt}", dependencies: [${dependencies.join(', ')}], priority: ${priority}`);
    
    // Extract context parameters for advanced functionality
    // Commenting out reportProgress extraction
    // const { reportProgress, session } = context; 
    const { session } = context; // Keep session

    // Initialize AI client with session environment
    let localAnthropic;
    try {
      localAnthropic = getAnthropicClientForMCP(session, log);
    } catch (error) {
      log.error(`Failed to initialize Anthropic client: ${error.message}`);
      disableSilentMode();
      return {
        success: false,
        error: {
          code: 'AI_CLIENT_ERROR',
          message: `Cannot initialize AI client: ${error.message}`
        }
      };
    }

    // Get model configuration from session
    const modelConfig = getModelConfig(session);

    // Read existing tasks to provide context
    let tasksData;
    try {
      const fs = await import('fs');
      tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
    } catch (error) {
      log.warn(`Could not read existing tasks for context: ${error.message}`);
      tasksData = { tasks: [] };
    }

    // Build prompts for AI
    const { systemPrompt, userPrompt } = _buildAddTaskPrompt(prompt, tasksData.tasks);

    // Make the AI call using the streaming helper
    let responseText;
    try {
      responseText = await _handleAnthropicStream(
        localAnthropic,
        {
          model: modelConfig.model,
          max_tokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
          messages: [{ role: "user", content: userPrompt }],
          system: systemPrompt
        },
        {
          // reportProgress: context.reportProgress, // Commented out to prevent Cursor stroking out 
          mcpLog: log
        }
      );
    } catch (error) {
      log.error(`AI processing failed: ${error.message}`);
      disableSilentMode();
      return {
        success: false,
        error: {
          code: 'AI_PROCESSING_ERROR',
          message: `Failed to generate task with AI: ${error.message}`
        }
      };
    }

    // Parse the AI response
    let taskDataFromAI;
    try {
      taskDataFromAI = parseTaskJsonResponse(responseText);
    } catch (error) {
      log.error(`Failed to parse AI response: ${error.message}`);
      disableSilentMode();
      return {
        success: false,
        error: {
          code: 'RESPONSE_PARSING_ERROR',
          message: `Failed to parse AI response: ${error.message}`
        }
      };
    }
    
    // Call the addTask function with 'json' outputFormat to prevent console output when called via MCP
    const newTaskId = await addTask(
      tasksPath, 
      prompt, 
      dependencies, 
      priority, 
      { 
        // reportProgress, // Commented out
        mcpLog: log, 
        session,
        taskDataFromAI // Pass the parsed AI result
      }, 
      'json'
    );
    
    // Restore normal logging
    disableSilentMode();
    
    return {
      success: true,
      data: {
        taskId: newTaskId,
        message: `Successfully added new task #${newTaskId}`
      }
    };
  } catch (error) {
    // Make sure to restore normal logging even if there's an error
    disableSilentMode();
    
    log.error(`Error in addTaskDirect: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'ADD_TASK_ERROR',
        message: error.message
      }
    };
  }
} 