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
        .describe('Confirm overwriting existing tasks if they exist.'),
      cliMode: z
        .boolean()
        .optional()
        .default(false)
        .describe('Use CLI-friendly progress reporting')
    }),
    execute: async (params, { reportProgress, log, session }) => {
      try {
        log.info(`Starting scan_workspace MCP tool with params: ${JSON.stringify(params)}`);
        
        // Enhanced phase descriptions for better user experience
        const phaseDescriptions = {
          'init': 'Initial setup',
          'validation': 'Validating input parameters',
          'setup': 'Setting up scan environment',
          'preparation': 'Preparing file analysis',
          'fileDiscovery': 'Discovering files and directories',
          'fileAnalysis': 'Analyzing file content and structure',
          'sampling': 'Creating codebase representation',
          'prdGeneration': 'Generating Product Requirements Document',
          'taskGeneration': 'Converting requirements to actionable tasks',
          'finalization': 'Finalizing task generation',
          'complete': 'Scan completed successfully',
          'error': 'Error encountered during scan'
        };
        
        // Set up progress reporting function with enhanced messaging
        const updateProgress = async (progressData) => {
          if (reportProgress) {
            try {
              // Get context values from progressData or use defaults to avoid undefined
              const {
                context = {}, 
                workspacePath = params.directory || params.projectRoot || "workspace",
                phase = "processing"
              } = progressData;
              
              // Enhanced progress data with more detailed information
              const enhancedProgressData = {
                ...progressData,
                // Add phase description if available
                phaseDescription: phaseDescriptions[progressData.phase] || '',
                // Enhance message to include phase context if message is undefined
                message: progressData.message || `Processing ${phase} phase`,
                // Make sure detail is always defined
                detail: progressData.detail || '',
                // Ensure we always have a workspace path
                workspacePath: workspacePath,
                // If LLM processing is occurring, add timing context
                detail: progressData.phase === 'prdGeneration' && 
                       progressData.detail && 
                       !progressData.detail.includes('minutes')
                  ? `${progressData.detail} (may take 2-3 minutes)`
                  : (progressData.detail || "Processing...")
              };
              
              await reportProgress(enhancedProgressData);
            } catch (error) {
              log.error(`Error reporting progress: ${error.message}`);
            }
          }
        };
        
        // Initial progress report
        await updateProgress({
          phase: 'init',
          message: 'Initializing workspace scan',
          detail: 'Setting up scan parameters and environment',
          progress: 0
        });
        
        // Call the direct function to perform the workspace scan with progress reporting
        const result = await scanWorkspaceFunction({
          ...params,
          cliMode: params.cliMode || false
        }, updateProgress);
        
        // Final progress report
        if (result.success) {
          await updateProgress({
            phase: 'complete',
            message: 'Scan complete',
            detail: `Generated ${result.taskCount || 0} tasks based on ${params.generatePRD ? 'PRD and ' : ''}code analysis`,
            progress: 100
          });
        } else {
          await updateProgress({
            phase: 'error',
            message: 'Scan failed',
            detail: result.error || 'Unknown error. Try running with --debug flag for more information.',
            progress: 100
          });
        }
        
        // Return the result directly
        return result;
      } catch (error) {
        logger.error(`Error in scan_workspace MCP tool: ${error.message}`);
        
        // Report error in progress if possible
        if (reportProgress) {
          try {
            await reportProgress({
              phase: 'error',
              message: 'Error in scan_workspace',
              detail: `${error.message} - Check API key configuration and try again with --debug flag`,
              progress: 100
            });
          } catch (progressError) {
            log.error(`Error reporting progress failure: ${progressError.message}`);
          }
        }
        
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