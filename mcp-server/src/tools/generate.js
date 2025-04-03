/**
 * tools/generate.js
 * Tool to generate individual task files from tasks.json
 */

import { z } from "zod";
import {
  handleApiResult,
  createErrorResponse,
  getProjectRootFromSession
} from "./utils.js";
import { generateTaskFilesDirect } from "../core/task-master-core.js";

/**
 * Register the generate tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerGenerateTool(server) {
  server.addTool({
    name: "generate",
    description: "Generates individual task files in tasks/ directory based on tasks.json",
    parameters: z.object({
      file: z.string().optional().describe("Path to the tasks file"),
      output: z.string().optional().describe("Output directory (default: same directory as tasks file)"),
      projectRoot: z
        .string()
        .optional()
        .describe(
          "Root directory of the project (default: current working directory)"
        ),
    }),
    execute: async (args, { log, session, reportProgress }) => {
      try {
        log.info(`Generating task files with args: ${JSON.stringify(args)}`);
        await reportProgress({ progress: 0 });
        
        let rootFolder = getProjectRootFromSession(session, log);
        
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        const result = await generateTaskFilesDirect({
          projectRoot: rootFolder,
          ...args
        }, log, { reportProgress, mcpLog: log, session});
        
        await reportProgress({ progress: 100 });
        
        if (result.success) {
          log.info(`Successfully generated task files: ${result.data.message}`);
        } else {
          log.error(`Failed to generate task files: ${result.error.message}`);
        }
        
        return handleApiResult(result, log, 'Error generating task files');
      } catch (error) {
        log.error(`Error in generate tool: ${error.message}`);
        return createErrorResponse(error.message);
      }
    },
  });
} 