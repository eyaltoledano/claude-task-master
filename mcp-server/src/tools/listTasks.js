/**
 * tools/listTasks.js
 * Tool to list all tasks from Task Master
 */

import { z } from "zod";
import logger from "../logger.js"; // Assuming logger might be needed in logic
import {
  executeTaskMasterCommand,
  createContentResponse,
  createErrorResponse,
} from "./utils.js";


// Extracted core logic for listing tasks
export async function listTasksLogic(args, log = logger) {
  log.info(`Listing tasks logic with args: ${JSON.stringify(args)}`);

  const cmdArgs = [];
  if (args.status) cmdArgs.push(`--status=${args.status}`);
  if (args.withSubtasks) cmdArgs.push("--with-subtasks");
  if (args.file) cmdArgs.push(`--file=${args.file}`);

  // Add --json flag if requested (assuming CLI supports it)
  if (args.format === 'json') {
    cmdArgs.push('--json');
  }

  const projectRoot = args.projectRoot || process.cwd(); // Use default if not provided

  const result = executeTaskMasterCommand(
    "list",
    log,
    cmdArgs,
    projectRoot
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  // Parse JSON if requested, otherwise return raw text
  if (args.format === 'json') {
    try {
      return JSON.parse(result.stdout);
    } catch (parseError) {
      log.error(`Failed to parse JSON output from task-master list: ${parseError}`);
      log.debug(`Raw output: ${result.stdout}`);
      throw new Error('Failed to parse JSON output from task list command.');
    }
  } else {
    return result.stdout; // Return raw text for the MCP tool
  }
}
/**
 * Register the listTasks tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerListTasksTool(server) {
  server.addTool({
    name: "listTasks",
    description: "List all tasks from Task Master",
    parameters: z.object({
      status: z.string().optional().describe("Filter tasks by status"),
      withSubtasks: z
        .boolean()
        .optional()
        .describe("Include subtasks in the response"),
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
        const textOutput = await listTasksLogic({ ...toolArgs, format: 'text' }, log);
        log.info(`Listing tasks tool result (text): ${textOutput}`);
        return createContentResponse(textOutput);
      } catch (error) {
        log.error(`Error in listTasks tool: ${error.message}`);
        return createErrorResponse(`Error listing tasks: ${error.message}`);
      }
    },
  });
}
