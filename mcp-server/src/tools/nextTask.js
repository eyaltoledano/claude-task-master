/**
 * tools/nextTask.js
 * Tool to show the next task to work on based on dependencies and status
 */

import { z } from "zod";
import {
  executeTaskMasterCommand,
  createContentResponse,
  createErrorResponse,
} from "./utils.js";

/**
 * Register the nextTask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerNextTaskTool(server) {
  server.addTool({
    name: "nextTask",
    description:
      "Show the next task to work on based on dependencies and status",
    parameters: z.object({
      file: z.string().optional().describe("Path to the tasks file"),
      projectRoot: z
        .string()
        .describe(
          "Root directory of the project (default: current working directory)"
        ),
    }),
    execute: async (args, { log }) => {
      try {
        log.info(`Finding next task to work on`);

        const cmdArgs = [];
        if (args.file) cmdArgs.push(`--file=${args.file}`);

        const projectRoot = args.projectRoot;

        const result = executeTaskMasterCommand(
          "next",
          log,
          cmdArgs,
          projectRoot
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return createContentResponse(result.stdout);
      } catch (error) {
        log.error(`Error finding next task: ${error.message}`);
        return createErrorResponse(`Error finding next task: ${error.message}`);
      }
    },
  });
}
