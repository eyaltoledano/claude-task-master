/**
 * tools/expandTask.js
 * Tool to break down a task into detailed subtasks
 */

import { z } from "zod";
import {
  executeTaskMasterCommand,
  createContentResponse,
  createErrorResponse,
} from "./utils.js";

/**
 * Register the expandTask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerExpandTaskTool(server) {
  server.addTool({
    name: "expandTask",
    description: "Break down a task into detailed subtasks",
    parameters: z.object({
      id: z.string().describe("Task ID to expand"),
      num: z.number().optional().describe("Number of subtasks to generate"),
      research: z
        .boolean()
        .optional()
        .describe(
          "Enable Perplexity AI for research-backed subtask generation"
        ),
      prompt: z
        .string()
        .optional()
        .describe("Additional context to guide subtask generation"),
      force: z
        .boolean()
        .optional()
        .describe(
          "Force regeneration of subtasks for tasks that already have them"
        ),
      file: z.string().optional().describe("Path to the tasks file"),
      projectRoot: z
        .string()
        .describe(
          "Root directory of the project (default: current working directory)"
        ),
    }),
    execute: async (args, { log }) => {
      try {
        log.info(`Expanding task ${args.id}`);

        const cmdArgs = [`--id=${args.id}`];
        if (args.num) cmdArgs.push(`--num=${args.num}`);
        if (args.research) cmdArgs.push("--research");
        if (args.prompt) cmdArgs.push(`--prompt="${args.prompt}"`);
        if (args.force) cmdArgs.push("--force");
        if (args.file) cmdArgs.push(`--file=${args.file}`);

        const projectRoot = args.projectRoot;

        const result = executeTaskMasterCommand(
          "expand",
          log,
          cmdArgs,
          projectRoot
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        return createContentResponse(result.stdout);
      } catch (error) {
        log.error(`Error expanding task: ${error.message}`);
        return createErrorResponse(`Error expanding task: ${error.message}`);
      }
    },
  });
}
