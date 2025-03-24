/**
 * Modify Command Tools
 * Tools for modifying and updating tasks
 */

import { z } from "zod";
import { executeCommand, formatResponse, cursorAdapter } from "../utils.js";

/**
 * Define modify tasks MCP tools
 * @param {import('fastmcp').FastMCP} server - The FastMCP server instance
 * @param {Function} registerTool - Optional custom tool registration function
 */
export function registerModifyTools(server, registerTool) {
  // Use the custom registration function if provided, otherwise use server.addTool directly
  const addTool = registerTool || server.addTool.bind(server);

  // Create a new task
  addTool(server, {
    name: "create-task",
    description: "Create a new task in the project",
    parameters: z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      status: z
        .string()
        .optional()
        .default("pending")
        .describe("Task status (pending, in-progress, done, deferred)"),
      parentId: z.string().optional().describe("Parent task ID"),
      dependencies: z
        .array(z.string())
        .optional()
        .describe("List of task IDs this task depends on"),
      assignee: z.string().optional().describe("Person assigned to the task"),
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Creating task", args);

      // Build command arguments
      const cmdArgs = ["--title", args.title];
      if (args.description) cmdArgs.push("--description", args.description);
      if (args.status) cmdArgs.push("--status", args.status);
      if (args.parentId) cmdArgs.push("--parent", args.parentId);
      if (args.dependencies && args.dependencies.length > 0) {
        cmdArgs.push("--dependencies", args.dependencies.join(","));
      }
      if (args.assignee) cmdArgs.push("--assignee", args.assignee);
      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("create", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to create task", { error: error.message });
        throw error;
      }
    },
  });

  // Update an existing task
  addTool(server, {
    name: "update-task",
    description: "Update an existing task in the project",
    parameters: z.object({
      id: z.string().describe("Task ID to update"),
      title: z.string().optional().describe("New task title"),
      description: z.string().optional().describe("New task description"),
      status: z
        .string()
        .optional()
        .describe("New task status (pending, in-progress, done, deferred)"),
      dependencies: z
        .array(z.string())
        .optional()
        .describe("New list of task IDs this task depends on"),
      assignee: z
        .string()
        .optional()
        .describe("New person assigned to the task"),
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Updating task", args);

      // Build command arguments
      const cmdArgs = [args.id];
      if (args.title) cmdArgs.push("--title", args.title);
      if (args.description) cmdArgs.push("--description", args.description);
      if (args.status) cmdArgs.push("--status", args.status);
      if (args.dependencies && args.dependencies.length > 0) {
        cmdArgs.push("--dependencies", args.dependencies.join(","));
      }
      if (args.assignee) cmdArgs.push("--assignee", args.assignee);
      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("update", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to update task", { error: error.message });
        throw error;
      }
    },
  });

  // Delete a task
  addTool(server, {
    name: "delete-task",
    description: "Delete a task from the project",
    parameters: z.object({
      id: z.string().describe("Task ID to delete"),
      force: z
        .boolean()
        .optional()
        .default(false)
        .describe("Force deletion even if the task has subtasks"),
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Deleting task", args);

      // Build command arguments
      const cmdArgs = [args.id];
      if (args.force) cmdArgs.push("--force");
      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("delete", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to delete task", { error: error.message });
        throw error;
      }
    },
  });

  // Set task status
  addTool(server, {
    name: "set-task-status",
    description: "Set the status of a task",
    parameters: z.object({
      id: z
        .string()
        .describe(
          'Task ID or comma-separated list of IDs (e.g., "1,2,3" or "1.1,1.2")'
        ),
      status: z
        .string()
        .describe('New status value (e.g., "done", "pending", "deferred")'),
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Setting task status", args);

      // Build command arguments
      const cmdArgs = ["--id", args.id, "--status", args.status];

      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("set-status", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to set task status", { error: error.message });
        throw error;
      }
    },
  });

  // Add dependency between tasks
  addTool(server, {
    name: "add-dependency",
    description: "Add a dependency relationship between two tasks",
    parameters: z.object({
      id: z.string().describe("ID of task that will depend on another task"),
      dependsOn: z
        .string()
        .describe("ID of task that will become a dependency"),
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Adding dependency", args);

      // Build command arguments
      const cmdArgs = ["--id", args.id, "--depends-on", args.dependsOn];

      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("add-dependency", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to add dependency", { error: error.message });
        throw error;
      }
    },
  });

  // Remove dependency between tasks
  addTool(server, {
    name: "remove-dependency",
    description: "Remove a dependency relationship between two tasks",
    parameters: z.object({
      id: z.string().describe("ID of task to remove dependency from"),
      dependsOn: z.string().describe("ID of task to remove as a dependency"),
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Removing dependency", args);

      // Build command arguments
      const cmdArgs = ["--id", args.id, "--depends-on", args.dependsOn];

      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("remove-dependency", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to remove dependency", { error: error.message });
        throw error;
      }
    },
  });

  // Generate task files
  addTool(server, {
    name: "generate-tasks",
    description: "Generate individual task files from tasks.json",
    parameters: z.object({
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
      output: z
        .string()
        .optional()
        .describe("Output directory (default: tasks)"),
    }),
    execute: async (args, { log }) => {
      log.info("Generating task files", args);

      // Build command arguments
      const cmdArgs = [];
      if (args.file) cmdArgs.push("--file", args.file);
      if (args.output) cmdArgs.push("--output", args.output);

      try {
        const result = await executeCommand("generate", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to generate task files", { error: error.message });
        throw error;
      }
    },
  });
}
