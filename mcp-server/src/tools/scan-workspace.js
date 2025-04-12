/**
 * scan-workspace.js
 * MCP tool for scanning a workspace and generating tasks based on code analysis
 */

import { z } from 'zod';
import { scanWorkspaceFunction } from '../core/direct-functions/scan-workspace.js';
import logger from '../logger.js';

/**
 * Register the scan-workspace tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerScanWorkspaceTool(server) {
  server.addTool({
    name: 'scan_workspace',
    description: 'Scan a workspace to analyze code and generate tasks based on codebase structure.',
    parameters: z.object({
      projectRoot: z
        .string()
        .describe('The root directory for the project. Must be absolute path.'),
      directory: z
        .string()
        .optional()
        .describe('Directory to scan (defaults to projectRoot)'),
      output: z
        .string()
        .optional()
        .describe('Output file path for tasks.json (relative to projectRoot)'),
      maxFiles: z
        .string()
        .optional()
        .describe('Maximum number of files to analyze'),
      maxSize: z
        .string()
        .optional()
        .describe('Maximum size per file in bytes'),
      ignoreDirs: z
        .string()
        .optional()
        .describe('Comma-separated list of directories to ignore'),
      numTasks: z
        .string()
        .optional()
        .describe('Number of tasks to generate'),
      generatePRD: z
        .boolean()
        .optional()
        .describe('Whether to generate a PRD'),
      confirmOverwrite: z
        .boolean()
        .optional()
        .default(false)
        .describe('Confirm overwriting existing tasks if they exist.')
    }),
    execute: async (params) => {
      try {
        logger.info(`Starting scan_workspace MCP tool with params: ${JSON.stringify(params)}`);
        
        // Call the direct function to perform the workspace scan
        const result = await scanWorkspaceFunction(params);
        
        // Return the result directly
        return result;
      } catch (error) {
        logger.error(`Error in scan_workspace MCP tool: ${error.message}`);
        return {
          success: false,
          error: error.message
        };
      }
    }
  });
  
  logger.info('Registered scan_workspace tool');
}

export default {
  registerScanWorkspaceTool
}; 