/**
 * tools/get-tasks.js
 * Tool to get all tasks from Task Master
 */

import { z } from "zod";
import {
  createErrorResponse,
  handleApiResult,
  getProjectRootFromSession
} from "./utils.js";
import { listTasksDirect } from "../core/task-master-core.js";

/**
 * Register the getTasks tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerListTasksTool(server) {
  server.addTool({
    name: "get_tasks",
    description: "Get all tasks from Task Master, optionally filtering by status and including subtasks.",
    parameters: z.object({
      status: z.string().optional().describe("Filter tasks by status (e.g., 'pending', 'done')"),
      withSubtasks: z
        .boolean()
        .optional()
        .describe("Include subtasks nested within their parent tasks in the response"),
      file: z.string().optional().describe("Path to the tasks file (relative to project root or absolute)"),
      projectRoot: z
        .string()
        .optional()
        .describe(
          "Root directory of the project (default: automatically detected from session or CWD)"
        ),
    }),
    execute: async (args, { log, session, reportProgress }) => {
      try {
        log.info(`Getting tasks with filters: ${JSON.stringify(args)}`);
        await reportProgress({ progress: 0 });
        
        let rootFolder = getProjectRootFromSession(session, log);
        
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        const result = await listTasksDirect({
          projectRoot: rootFolder,
          ...args
        }, log);
        
        await reportProgress({ progress: 100 });
        
        log.info(`Retrieved ${result.success ? (result.data?.tasks?.length || 0) : 0} tasks${result.fromCache ? ' (from cache)' : ''}`);
        return handleApiResult(result, log, 'Error getting tasks');
      } catch (error) {
        log.error(`Error getting tasks: ${error.message}`);
        return createErrorResponse(error.message);
      }
    },
  });
}

// We no longer need the formatTasksResponse function as we're returning raw JSON data
