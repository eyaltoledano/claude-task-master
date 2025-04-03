/**
 * tools/add-task.js
 * Tool to add a new task using AI
 */

import { z } from "zod";
import {
  handleApiResult,
  createErrorResponse,
  getProjectRootFromSession
} from "./utils.js";
import { addTaskDirect } from "../core/task-master-core.js";

/**
 * Register the add-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAddTaskTool(server) {
  server.addTool({
    name: "add_task",
    description: "Add a new task using AI",
    parameters: z.object({
      prompt: z.string().describe("Description of the task to add"),
      dependencies: z.string().optional().describe("Comma-separated list of task IDs this task depends on"),
      priority: z.string().optional().describe("Task priority (high, medium, low)"),
      file: z.string().optional().describe("Path to the tasks file"),
      projectRoot: z.string().optional().describe("Root directory of the project (default: current working directory)")
    }),
    execute: async (args, { log, reportProgress, session }) => {
      try {
        log.info(`MCP add_task called with prompt: "${args.prompt}"`);
        
        // Get project root using the utility function
        let rootFolder = getProjectRootFromSession(session, log);
        
        // Fallback to args.projectRoot if session didn't provide one
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        // Call the direct function with the resolved rootFolder
        const result = await addTaskDirect({
          projectRoot: rootFolder, // Pass the resolved root
          ...args
        }, log, { reportProgress, mcpLog: log, session});
        
        return handleApiResult(result, log);
      } catch (error) {
        log.error(`Error in add_task MCP tool: ${error.message}`);
        return createErrorResponse(error.message, "ADD_TASK_ERROR");
      }
    }
  });
} 