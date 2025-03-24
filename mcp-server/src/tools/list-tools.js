/**
 * List Command Tools
 * Tools for listing and viewing tasks
 */

import { z } from "zod";
import { executeCommand, formatResponse, cursorAdapter } from "../utils.js";

/**
 * Define list-tasks MCP tool
 * @param {import('fastmcp').FastMCP} server - The FastMCP server instance
 * @param {Function} registerTool - Optional custom tool registration function
 */
export function registerListTools(server, registerTool) {
  // Use the custom registration function if provided, otherwise use server.addTool directly
  const addTool = registerTool || server.addTool.bind(server);

  // List all tasks
  addTool(server, {
    name: "list-tasks",
    description: "List all tasks in the project",
    parameters: z.object({
      status: z
        .string()
        .optional()
        .describe("Filter tasks by status (e.g., pending, done, deferred)"),
      withSubtasks: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include subtasks in the listing"),
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Listing tasks", args);

      // Build command arguments
      const cmdArgs = [];
      if (args.status) cmdArgs.push("--status", args.status);
      if (args.withSubtasks) cmdArgs.push("--with-subtasks");
      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("list", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to list tasks", { error: error.message });
        throw error;
      }
    },
  });

  // Show next task to work on
  addTool(server, {
    name: "next-task",
    description:
      "Show the next task to work on based on dependencies and status",
    parameters: z.object({
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Getting next task", args);

      // Build command arguments
      const cmdArgs = [];
      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("next", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to get next task", { error: error.message });
        throw error;
      }
    },
  });

  // Show details of a specific task
  addTool(server, {
    name: "show-task",
    description: "Show details of a specific task by ID",
    parameters: z.object({
      id: z.string().describe("Task ID to show (e.g., 1, 1.2)"),
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Showing task details", args);

      // Build command arguments
      const cmdArgs = [args.id];
      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("show", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to show task details", { error: error.message });
        throw error;
      }
    },
  });
}
