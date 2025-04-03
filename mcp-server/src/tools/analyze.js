/**
 * tools/analyze.js
 * Tool for analyzing task complexity and generating recommendations
 */

import { z } from "zod";
import {
  handleApiResult,
  createErrorResponse,
  getProjectRootFromSession
} from "./utils.js";
import { analyzeTaskComplexityDirect } from "../core/task-master-core.js";

/**
 * Register the analyze tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAnalyzeTool(server) {
  server.addTool({
    name: "analyze_project_complexity",
    description: "Analyze task complexity and generate expansion recommendations",
    parameters: z.object({
      output: z.string().optional().describe("Output file path for the report (default: scripts/task-complexity-report.json)"),
      model: z.string().optional().describe("LLM model to use for analysis (defaults to configured model)"),
      threshold: z.union([z.number(), z.string()]).optional().describe("Minimum complexity score to recommend expansion (1-10) (default: 5)"),
      file: z.string().optional().describe("Path to the tasks file (default: tasks/tasks.json)"),
      research: z.boolean().optional().describe("Use Perplexity AI for research-backed complexity analysis"),
      projectRoot: z.string().optional().describe("Root directory of the project (default: current working directory)")
    }),
    execute: async (args, { log, session, reportProgress }) => {
      try {
        log.info(`Analyzing task complexity with args: ${JSON.stringify(args)}`);
        await reportProgress({ progress: 0 });
        
        let rootFolder = getProjectRootFromSession(session, log);
        
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        const result = await analyzeTaskComplexityDirect({
          projectRoot: rootFolder,
          ...args
        }, log, { reportProgress, mcpLog: log, session});
        
        await reportProgress({ progress: 100 });
        
        if (result.success) {
          log.info(`Task complexity analysis complete: ${result.data.message}`);
          log.info(`Report summary: ${JSON.stringify(result.data.reportSummary)}`);
        } else {
          log.error(`Failed to analyze task complexity: ${result.error.message}`);
        }
        
        return handleApiResult(result, log, 'Error analyzing task complexity');
      } catch (error) {
        log.error(`Error in analyze tool: ${error.message}`);
        return createErrorResponse(error.message);
      }
    },
  });
} 