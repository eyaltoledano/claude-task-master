/**
 * tools/update-subtask.js
 * Tool to append additional information to a specific subtask
 */

import { z } from "zod";
import {
  handleApiResult,
  createErrorResponse,
  getProjectRootFromSession
} from "./utils.js";
import { updateSubtaskByIdDirect } from "../core/task-master-core.js";

/**
 * Register the update-subtask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateSubtaskTool(server) {
  server.addTool({
    name: "update_subtask",
    description: "Appends additional information to a specific subtask without replacing existing content",
    parameters: z.object({
      id: z.string().describe("ID of the subtask to update in format \"parentId.subtaskId\" (e.g., \"5.2\")"),
      prompt: z.string().describe("Information to add to the subtask"),
      research: z.boolean().optional().describe("Use Perplexity AI for research-backed updates"),
      file: z.string().optional().describe("Path to the tasks file"),
      projectRoot: z
        .string()
        .optional()
        .describe(
          "Root directory of the project (default: current working directory)"
        ),
    }),
    execute: async (args, { log, session, reportProgress }) => {
      try {
        log.info(`Updating subtask with args: ${JSON.stringify(args)}`);
        await reportProgress({ progress: 0 });
        
        let rootFolder = getProjectRootFromSession(session, log);
        
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        const result = await updateSubtaskByIdDirect({
          projectRoot: rootFolder,
          ...args
        }, log, { reportProgress, mcpLog: log, session});
        
        await reportProgress({ progress: 100 });
        
        if (result.success) {
          log.info(`Successfully updated subtask with ID ${args.id}`);
        } else {
          log.error(`Failed to update subtask: ${result.error?.message || 'Unknown error'}`);
        }
        
        return handleApiResult(result, log, 'Error updating subtask');
      } catch (error) {
        log.error(`Error in update_subtask tool: ${error.message}`);
        return createErrorResponse(error.message);
      }
    },
  });
} 