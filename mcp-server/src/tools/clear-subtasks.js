/**
 * tools/clear-subtasks.js
 * Tool for clearing subtasks from parent tasks
 */

import { z } from "zod";
import {
  handleApiResult,
  createErrorResponse,
  getProjectRootFromSession
} from "./utils.js";
import { clearSubtasksDirect } from "../core/task-master-core.js";

/**
 * Register the clearSubtasks tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerClearSubtasksTool(server) {
  server.addTool({
    name: "clear_subtasks",
    description: "Clear subtasks from specified tasks",
    parameters: z.object({
      id: z.string().optional().describe("Task IDs (comma-separated) to clear subtasks from"),
      all: z.boolean().optional().describe("Clear subtasks from all tasks"),
      file: z.string().optional().describe("Path to the tasks file (default: tasks/tasks.json)"),
      projectRoot: z.string().optional().describe("Root directory of the project (default: current working directory)")
    }).refine(data => data.id || data.all, {
      message: "Either 'id' or 'all' parameter must be provided",
      path: ["id", "all"]
    }),
    execute: async (args, { log, session, reportProgress }) => {
      try {
        log.info(`Clearing subtasks with args: ${JSON.stringify(args)}`);
        await reportProgress({ progress: 0 });
        
        let rootFolder = getProjectRootFromSession(session, log);
        
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        const result = await clearSubtasksDirect({
          projectRoot: rootFolder,
          ...args
        }, log, { reportProgress, mcpLog: log, session});
        
        reportProgress({ progress: 100 });
        
        if (result.success) {
          log.info(`Subtasks cleared successfully: ${result.data.message}`);
        } else {
          log.error(`Failed to clear subtasks: ${result.error.message}`);
        }
        
        return handleApiResult(result, log, 'Error clearing subtasks');
      } catch (error) {
        log.error(`Error in clearSubtasks tool: ${error.message}`);
        return createErrorResponse(error.message);
      }
    },
  });
} 