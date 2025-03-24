/**
 * Expand Command Tools
 * Tools for expanding tasks and generating reports
 */

import { z } from "zod";
import { executeCommand, formatResponse, cursorAdapter } from "../utils.js";

/**
 * Define expand tasks MCP tools
 * @param {import('fastmcp').FastMCP} server - The FastMCP server instance
 * @param {Function} registerTool - Optional custom tool registration function
 */
export function registerExpandTools(server, registerTool) {
  // Use the custom registration function if provided, otherwise use server.addTool directly
  const addTool = registerTool || server.addTool.bind(server);

  // Expand task into subtasks
  addTool(server, {
    name: "expand-task",
    description: "Expand a task into multiple subtasks",
    parameters: z.object({
      id: z.string().describe("Task ID to expand"),
      subtasks: z
        .array(
          z.object({
            title: z.string().describe("Subtask title"),
            description: z.string().optional().describe("Subtask description"),
            status: z
              .string()
              .optional()
              .describe("Subtask status (defaults to pending)"),
          })
        )
        .describe("List of subtasks to create"),
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Expanding task", args);

      // Build command arguments
      const cmdArgs = [args.id];

      // Create a temporary file for subtasks
      const subtasksJson = JSON.stringify(args.subtasks);
      const tempFilePath = `/tmp/subtasks-${Date.now()}.json`;
      const fs = await import("fs/promises");
      await fs.writeFile(tempFilePath, subtasksJson);

      cmdArgs.push("--subtasks-file", tempFilePath);

      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("expand", cmdArgs);
        // Clean up temp file
        await fs.unlink(tempFilePath);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to expand task", { error: error.message });
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

  // Generate a Markdown report of tasks
  addTool(server, {
    name: "generate-report",
    description: "Generate a Markdown report of tasks",
    parameters: z.object({
      format: z
        .string()
        .optional()
        .default("markdown")
        .describe("Output format (markdown, html)"),
      status: z
        .string()
        .optional()
        .describe("Filter tasks by status (e.g., pending, done)"),
      includeSubtasks: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include subtasks in the report"),
      outputFile: z
        .string()
        .optional()
        .describe("Output file path (default: task-report.md)"),
      file: z
        .string()
        .optional()
        .describe("Path to the tasks file (default: tasks/tasks.json)"),
    }),
    execute: async (args, { log }) => {
      log.info("Generating task report", args);

      // Build command arguments
      const cmdArgs = [];
      if (args.format) cmdArgs.push("--format", args.format);
      if (args.status) cmdArgs.push("--status", args.status);
      if (args.includeSubtasks) cmdArgs.push("--include-subtasks");
      if (args.outputFile) cmdArgs.push("--output", args.outputFile);
      if (args.file) cmdArgs.push("--file", args.file);

      try {
        const result = await executeCommand("report", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to generate report", { error: error.message });
        throw error;
      }
    },
  });

  // Get complexity report for codebase
  addTool(server, {
    name: "complexity-report",
    description: "Generate a complexity report for the project codebase",
    parameters: z.object({
      path: z
        .string()
        .optional()
        .default(".")
        .describe("Path to analyze (default: current directory)"),
      format: z
        .string()
        .optional()
        .default("text")
        .describe("Output format (text, json, html)"),
      outputFile: z
        .string()
        .optional()
        .describe("Output file path (default: stdout)"),
    }),
    execute: async (args, { log }) => {
      log.info("Generating complexity report", args);

      // Build command arguments
      const cmdArgs = ["complexity"];
      if (args.path) cmdArgs.push("--path", args.path);
      if (args.format) cmdArgs.push("--format", args.format);
      if (args.outputFile) cmdArgs.push("--output", args.outputFile);

      try {
        const result = await executeCommand("analyze", cmdArgs);
        return cursorAdapter(formatResponse(result.stdout));
      } catch (error) {
        log.error("Failed to generate complexity report", {
          error: error.message,
        });
        throw error;
      }
    },
  });
}
