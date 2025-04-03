/**
 * tools/complexity-report.js
 * Tool for displaying the complexity analysis report
 */

import { z } from "zod";
import {
  handleApiResult,
  createErrorResponse,
  getProjectRootFromSession
} from "./utils.js";
import { complexityReportDirect } from "../core/task-master-core.js";

/**
 * Register the complexityReport tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerComplexityReportTool(server) {
  server.addTool({
    name: "complexity_report",
    description: "Display the complexity analysis report in a readable format",
    parameters: z.object({
      file: z.string().optional().describe("Path to the report file (default: scripts/task-complexity-report.json)"),
      projectRoot: z.string().optional().describe("Root directory of the project (default: current working directory)")
    }),
    execute: async (args, { log, session, reportProgress }) => {
      try {
        log.info(`Getting complexity report with args: ${JSON.stringify(args)}`);
        await reportProgress({ progress: 0 });
        
        let rootFolder = getProjectRootFromSession(session, log);
        
        if (!rootFolder && args.projectRoot) {
          rootFolder = args.projectRoot;
          log.info(`Using project root from args as fallback: ${rootFolder}`);
        }
        
        const result = await complexityReportDirect({
          projectRoot: rootFolder,
          ...args
        }, log, { reportProgress, mcpLog: log, session});
        
        await reportProgress({ progress: 100 });
        
        if (result.success) {
          log.info(`Successfully retrieved complexity report${result.fromCache ? ' (from cache)' : ''}`);
        } else {
          log.error(`Failed to retrieve complexity report: ${result.error.message}`);
        }
        
        return handleApiResult(result, log, 'Error retrieving complexity report');
      } catch (error) {
        log.error(`Error in complexity-report tool: ${error.message}`);
        return createErrorResponse(`Failed to retrieve complexity report: ${error.message}`);
      }
    },
  });
} 