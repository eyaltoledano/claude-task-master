/**
 * tools/showTask.js
 * Tool to show detailed information about a specific task
 */

import { z } from "zod";
import {
  executeTaskMasterCommand,
  createErrorResponse,
  handleApiResult
} from "./utils.js";

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
        .optional()
        .describe(
          "Root directory of the project (default: current working directory)"
        ),
    }),
    execute: async (args, { log }) => {
      try {
        log.info(`Showing task details for ID: ${args.id}`);

        // Prepare arguments for CLI command
        const cmdArgs = [`--id=${args.id}`];
        if (args.file) cmdArgs.push(`--file=${args.file}`);

        // Execute the command - function now handles project root internally
        const result = executeTaskMasterCommand(
          "show",
          log,
          cmdArgs,
          args.projectRoot // Pass raw project root, function will normalize it
        );

        // Process CLI result into API result format for handleApiResult
        if (result.success) {
          try {
            // Try to parse response as JSON
            const data = JSON.parse(result.stdout);
            // Return equivalent of a successful API call with data
            return handleApiResult({ success: true, data }, log, 'Error showing task');
          } catch (e) {
            // If parsing fails, still return success but with raw string data
            return handleApiResult(
              { success: true, data: result.stdout }, 
              log, 
              'Error showing task',
              // Skip data processing for string data
              null
            );
          }
        } else {
          // Return equivalent of a failed API call
          return handleApiResult(
            { success: false, error: { message: result.error } },
            log,
            'Error showing task'
          );
        }
      } catch (error) {
        log.error(`Error showing task: ${error.message}`);
        return createErrorResponse(error.message);
      }
    },
  });
}
