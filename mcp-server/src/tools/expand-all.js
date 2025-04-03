/**
 * tools/expand-all.js
 * Tool for expanding all pending tasks with subtasks
 */

import { z } from "zod";
import {
  handleApiResult,
  createErrorResponse,
  getProjectRootFromSession
} from "./utils.js";
import { expandAllTasksDirect } from "../core/task-master-core.js";

/**
 * Register the expandAll tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerExpandAllTool(server) {
  server.addTool({
    name: "expand_all",
    description: "Expand all pending tasks into subtasks",
    parameters: z.object({
      num: z.union([z.number(), z.string()]).optional().describe("Number of subtasks to generate for each task"),
      research: z.boolean().optional().describe("Enable Perplexity AI for research-backed subtask generation"),
      prompt: z.string().optional().describe("Additional context to guide subtask generation"),
      force: z.boolean().optional().describe("Force regeneration of subtasks for tasks that already have them"),
      file: z.string().optional().describe("Path to the tasks file (default: tasks/tasks.json)"),
      projectRoot: z.string().optional().describe("Root directory of the project (default: current working directory)")
    }),
    execute: async (args, { log, session, reportProgress }) => {
      try {
        log.info(`Expanding all tasks with args: ${JSON.stringify(args)}`);
        await reportProgress({ progress: 0 });
        
        let rootFolder = getProjectRootFromSession(session, log);
        
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        const result = await expandAllTasksDirect({
          projectRoot: rootFolder,
          ...args
        }, log, { reportProgress, mcpLog: log, session});
        
        await reportProgress({ progress: 100 });
        
        if (result.success) {
          log.info(`All tasks expanded successfully: ${result.data.message}`);
        } else {
          log.error(`Failed to expand tasks: ${result.error.message}`);
        }
        
        return handleApiResult(result, log, 'Error expanding tasks');
      } catch (error) {
        log.error(`Error in expandAll tool: ${error.message}`);
        return createErrorResponse(error.message);
      }
    },
  });
} 