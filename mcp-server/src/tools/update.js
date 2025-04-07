/**
 * tools/update.js
 * Tool to update tasks based on new context/prompt
 */

import { z } from "zod";
import {
  handleApiResult,
  createErrorResponse,
  getProjectRootFromSession
} from "./utils.js";
import { updateTasksDirect } from "../core/task-master-core.js";

/**
 * Register the update tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateTool(server) {
  server.addTool({
    name: "update",
    description: "Update multiple upcoming tasks (with ID >= 'from' ID) based on new context or changes provided in the prompt. Use 'update_task' instead for a single specific task.",
    parameters: z.object({
      from: z.string().describe("Task ID from which to start updating (inclusive). IMPORTANT: This tool uses 'from', not 'id'"),
      prompt: z.string().describe("Explanation of changes or new context to apply"),
      research: z.boolean().optional().describe("Use Perplexity AI for research-backed updates"),
      file: z.string().optional().describe("Path to the tasks file"),
      projectRoot: z
        .string()
        .optional()
        .describe(
          "Root directory of the project (default: current working directory)"
        ),
    }),
    execute: async (args, { log, session }) => {
      try {
        log.info(`Updating tasks with args: ${JSON.stringify(args)}`);
        
        let rootFolder = getProjectRootFromSession(session, log);
        
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        const result = await updateTasksDirect({
          projectRoot: rootFolder,
          ...args
        }, log, { session });
        
        if (result.success) {
          log.info(`Successfully updated tasks from ID ${args.from}: ${result.data.message}`);
        } else {
          log.error(`Failed to update tasks: ${result.error?.message || 'Unknown error'}`);
        }
        
        return handleApiResult(result, log, 'Error updating tasks');
      } catch (error) {
        log.error(`Error in update tool: ${error.message}`);
        return createErrorResponse(error.message);
      }
    },
  });
} 