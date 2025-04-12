/**
 * tools/setTaskStatus.js
 * Tool to set the status of a task
 */

import { z } from "zod";
import {
  executeTaskMasterCommand,
  createContentResponse,
  createErrorResponse,
} from "./utils.js";

/**
 * Register the setTaskStatus tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerSetTaskStatusTool(server) {
  server.addTool({
    name: "setTaskStatus",
    description: "Set the status of a task",
    parameters: z.object({
      id: z
        .string()
        .describe("Task ID (can be comma-separated for multiple tasks)"),
      status: z
        .string()
        .describe("New status (todo, in-progress, review, done)"),
      file: z.string().optional().describe("Path to the tasks file"),
      projectRoot: z
        .string()
        .describe(
          "Root directory of the project (default: current working directory)"
        ),
    }),
    execute: async (args, { log }) => {
      try {
        log.info(`Setting status of task(s) ${args.id} to: ${args.status}`);

        const cmdArgs = [`--id=${args.id}`, `--status=${args.status}`];
        if (args.file) cmdArgs.push(`--file=${args.file}`);

        const projectRoot = args.projectRoot;

        const result = executeTaskMasterCommand(
          "set-status",
          log,
          cmdArgs,
          projectRoot
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return createContentResponse(result.stdout);
      } catch (error) {
        log.error(`Error setting task status: ${error.message}`);
        return createErrorResponse(
          `Error setting task status: ${error.message}`
        );
      }
    },
  });
}
