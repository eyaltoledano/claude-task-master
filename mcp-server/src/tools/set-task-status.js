/**
 * tools/setTaskStatus.js
 * Tool to set the status of a task
 */

import { z } from "zod";
import {
  handleApiResult,
  createErrorResponse,
  getProjectRootFromSession
} from "./utils.js";
import { setTaskStatusDirect } from "../core/task-master-core.js";

/**
 * Register the setTaskStatus tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerSetTaskStatusTool(server) {
  server.addTool({
    name: "set_task_status",
    description: "Set the status of one or more tasks or subtasks.",
    parameters: z.object({
      id: z
        .string()
        .describe("Task ID or subtask ID (e.g., '15', '15.2'). Can be comma-separated for multiple updates."),
      status: z
        .string()
        .describe("New status to set (e.g., 'pending', 'done', 'in-progress', 'review', 'deferred', 'cancelled'."),
      file: z.string().optional().describe("Path to the tasks file"),
      projectRoot: z
        .string()
        .optional()
        .describe(
          "Root directory of the project (default: automatically detected)"
        ),
    }),
    execute: async (args, { log, session, reportProgress }) => {
      try {
        log.info(`Setting status of task(s) ${args.id} to: ${args.status}`);
        await reportProgress({ progress: 0 });
        
        let rootFolder = getProjectRootFromSession(session, log);
        
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        const result = await setTaskStatusDirect({
          projectRoot: rootFolder,
          ...args
        }, log, { reportProgress, mcpLog: log, session});
        
        await reportProgress({ progress: 100 });
        
        if (result.success) {
          log.info(`Successfully updated status for task(s) ${args.id} to "${args.status}": ${result.data.message}`);
        } else {
          log.error(`Failed to update task status: ${result.error?.message || 'Unknown error'}`);
        }
        
        return handleApiResult(result, log, 'Error setting task status');
      } catch (error) {
        log.error(`Error in setTaskStatus tool: ${error.message}`);
        return createErrorResponse(`Error setting task status: ${error.message}`);
      }
    },
  });
}
