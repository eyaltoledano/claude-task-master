/**
 * tools/showTask.js
 * Tool to show detailed information about a specific task
 */

import { z } from "zod";
import logger from "../logger.js"; // Assuming logger might be needed
import {
  executeTaskMasterCommand,
  createContentResponse,
  createErrorResponse,
} from "./utils.js";


// Extracted core logic for showing a task
export async function showTaskLogic(args, log = logger) {
  log.info(`Show task logic for ID: ${args.id}, Args: ${JSON.stringify(args)}`);

  if (!args.id) {
    throw new Error("Task ID is required to show task details.");
  }

  const cmdArgs = [`--id=${args.id}`];
  if (args.file) cmdArgs.push(`--file=${args.file}`);

  // Add --json flag if requested (assuming CLI supports it)
  if (args.format === 'json') {
    cmdArgs.push('--json');
  }

  const projectRoot = args.projectRoot || process.cwd(); // Use default if not provided

  const result = executeTaskMasterCommand(
    "show",
    log,
    cmdArgs,
    projectRoot
  );

  if (!result.success) {
    // Handle specific case where task might not be found
    if (result.error && result.error.includes("Task not found")) {
       throw new Error(`Task with ID ${args.id} not found.`); // More specific error
    }
    throw new Error(result.error);
  }

  // Parse JSON if requested, otherwise return raw text
  if (args.format === 'json') {
    try {
      return JSON.parse(result.stdout);
    } catch (parseError) {
      log.error(`Failed to parse JSON output from task-master show: ${parseError}`);
      log.debug(`Raw output: ${result.stdout}`);
      throw new Error('Failed to parse JSON output from show task command.');
    }
  } else {
    return result.stdout; // Return raw text for the MCP tool
  }
}
/**
 * Register the showTask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerShowTaskTool(server) {
  server.addTool({
    name: "showTask",
    description: "Show detailed information about a specific task",
    parameters: z.object({
      id: z.string().describe("Task ID to show"),
      file: z.string().optional().describe("Path to the tasks file"),
      projectRoot: z
        .string()
        .describe(
          "Root directory of the project (default: current working directory)"
        ),
    }),
    execute: async (toolArgs, { log }) => {
      try {
        // Call the extracted logic, requesting text format for the tool
        const textOutput = await showTaskLogic({ ...toolArgs, format: 'text' }, log);
        log.info(`Show task tool result (text): ${textOutput}`);
        return createContentResponse(textOutput);
      } catch (error) {
        log.error(`Error in showTask tool: ${error.message}`);
        // Handle specific "not found" error for the tool response
        if (error.message.includes("not found")) {
             return createErrorResponse(error.message);
        }
        return createErrorResponse(`Error showing task: ${error.message}`);
      }
    },
  });
}
