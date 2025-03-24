/**
 * Create Command Tools
 * Tools for creating and initializing task projects
 */

import { z } from "zod";
import { executeCommand, formatResponse, cursorAdapter } from "../utils.js";

/**
 * Define create tasks MCP tools
 * @param {import('fastmcp').FastMCP} server - The FastMCP server instance
 * @param {Function} registerTool - Optional custom tool registration function
 */
export function registerCreateTools(server, registerTool) {
  // Use the custom registration function if provided, otherwise use server.addTool directly
  const addTool = registerTool || server.addTool.bind(server);

  // Initialize a new tasks project
  addTool(server, {
    name: "init-tasks",
    description: "Initialize a new tasks project",
    parameters: z.object({
      dir: z
        .string()
        .optional()
        .default(".")
        .describe("Directory to initialize the tasks project in"),
      force: z
        .boolean()
        .optional()
        .default(false)
        .describe("Overwrite existing tasks files"),
      template: z
        .string()
        .optional()
        .describe("Template to use for the tasks project"),
    }),
    execute: async (args, { log }) => {
      log.info("Initializing tasks project", args);

      // Build command arguments
      const cmdArgs = ["init"];
      if (args.dir) cmdArgs.push("--dir", args.dir);
      if (args.force) cmdArgs.push("--force");
      if (args.template) cmdArgs.push("--template", args.template);

      try {
        const result = await executeCommand("task-master", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to initialize tasks project", {
          error: error.message,
        });
        throw error;
      }
    },
  });

  // Create a new task template
  addTool(server, {
    name: "create-template",
    description: "Create a new task template",
    parameters: z.object({
      name: z.string().describe("Template name"),
      description: z.string().optional().describe("Template description"),
      tasks: z
        .array(
          z.object({
            title: z.string().describe("Task title"),
            description: z.string().optional().describe("Task description"),
            status: z
              .string()
              .optional()
              .default("pending")
              .describe("Task status"),
            dependencies: z
              .array(z.number())
              .optional()
              .describe("Dependencies (task indexes)"),
          })
        )
        .describe("List of tasks for the template"),
      outputFile: z
        .string()
        .optional()
        .describe(
          "Output file path (default: ~/.task-master/templates/<name>.json)"
        ),
      force: z
        .boolean()
        .optional()
        .default(false)
        .describe("Overwrite existing template with the same name"),
    }),
    execute: async (args, { log }) => {
      log.info("Creating task template", args);

      // Create a temporary file for the tasks
      const tasksJson = JSON.stringify(args.tasks);
      const tempFilePath = `/tmp/template-${Date.now()}.json`;
      const fs = await import("fs/promises");
      await fs.writeFile(tempFilePath, tasksJson);

      // Build command arguments
      const cmdArgs = ["create-template"];
      cmdArgs.push("--name", args.name);
      if (args.description) cmdArgs.push("--description", args.description);
      cmdArgs.push("--tasks-file", tempFilePath);
      if (args.outputFile) cmdArgs.push("--output", args.outputFile);
      if (args.force) cmdArgs.push("--force");

      try {
        const result = await executeCommand("task-master", cmdArgs);
        // Clean up temp file
        await fs.unlink(tempFilePath);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to create template", { error: error.message });
        // Clean up temp file
        try {
          await fs.unlink(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
        throw error;
      }
    },
  });

  // List available templates
  addTool(server, {
    name: "list-templates",
    description: "List available task templates",
    parameters: z.object({}),
    execute: async (args, { log }) => {
      log.info("Listing task templates");

      // Build command arguments
      const cmdArgs = ["list-templates"];

      try {
        const result = await executeCommand("task-master", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to list templates", { error: error.message });
        throw error;
      }
    },
  });
}
