/**
 * tools/addTask.js
 * Tool to add a new task using AI
 */

import { z } from "zod";
import {
  executeTaskMasterCommand,
  createContentResponse,
  createErrorResponse,
} from "./utils.js";

/**
 * Register the addTask tool with the MCP server
 * @param {FastMCP} server - FastMCP server instance
 */
export function registerAddTaskTool(server) {
  server.addTool({
    name: "addTask",
    description: "Add a new task using AI",
    parameters: z.object({
      prompt: z.string().describe("Description of the task to add"),
      dependencies: z
        .string()
        .optional()
        .describe("Comma-separated list of task IDs this task depends on"),
      priority: z
        .string()
        .optional()
        .describe("Task priority (high, medium, low)"),
      file: z.string().optional().describe("Path to the tasks file"),
      projectRoot: z
        .string()
        .describe(
          "Root directory of the project (default: current working directory)"
        ),
    }),
    execute: async (args, { log }) => {
      try {
        log.info(`Adding new task: ${args.prompt}`);

        const cmdArgs = [`--prompt="${args.prompt}"`];
        if (args.dependencies)
          cmdArgs.push(`--dependencies=${args.dependencies}`);
        if (args.priority) cmdArgs.push(`--priority=${args.priority}`);
        if (args.file) cmdArgs.push(`--file=${args.file}`);

        const result = executeTaskMasterCommand(
          "add-task",
          log,
          cmdArgs,
          projectRoot
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return createContentResponse(result.stdout);
      } catch (error) {
        log.error(`Error adding task: ${error.message}`);
        return createErrorResponse(`Error adding task: ${error.message}`);
      }
    },
  });
}
