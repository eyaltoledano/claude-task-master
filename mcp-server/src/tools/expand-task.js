/**
 * tools/expand-task.js
 * Tool to expand a task into subtasks
 */

import { z } from "zod";
import {
  handleApiResult,
  createErrorResponse,
  getProjectRootFromSession
} from "./utils.js";
import { expandTaskDirect } from "../core/task-master-core.js";
import fs from "fs";
import path from "path";

/**
 * Register the expand-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerExpandTaskTool(server) {
  server.addTool({
    name: "expand_task",
    description: "Expand a task into subtasks for detailed implementation",
    parameters: z.object({
      id: z.string().describe("ID of task to expand"),
      num: z.union([z.string(), z.number()]).optional().describe("Number of subtasks to generate"),
      research: z.boolean().optional().describe("Use Perplexity AI for research-backed generation"),
      prompt: z.string().optional().describe("Additional context for subtask generation"),
      file: z.string().optional().describe("Path to the tasks file"),
      projectRoot: z
        .string()
        .optional()
        .describe(
          "Root directory of the project (default: current working directory)"
        ),
    }),
    execute: async (args, { log, reportProgress, session }) => {
      try {
        log.info(`Starting expand-task with args: ${JSON.stringify(args)}`);
        
        // Get project root from session
        let rootFolder = getProjectRootFromSession(session, log);
        
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        log.info(`Project root resolved to: ${rootFolder}`);
        
        // Check for tasks.json in the standard locations
        const tasksJsonPath = path.join(rootFolder, 'tasks', 'tasks.json');
        
        if (fs.existsSync(tasksJsonPath)) {
          log.info(`Found tasks.json at ${tasksJsonPath}`);
          // Add the file parameter directly to args
          args.file = tasksJsonPath;
        } else {
          log.warn(`Could not find tasks.json at ${tasksJsonPath}`);
        }
        
        // Call direct function with only session in the context, not reportProgress
        // Use the pattern recommended in the MCP guidelines
        const result = await expandTaskDirect({
          ...args,
          projectRoot: rootFolder
        }, log, { session }); // Only pass session, NOT reportProgress
        
        // Return the result
        return handleApiResult(result, log, 'Error expanding task');
      } catch (error) {
        log.error(`Error in expand task tool: ${error.message}`);
        return createErrorResponse(error.message);
      }
    },
  });
} 