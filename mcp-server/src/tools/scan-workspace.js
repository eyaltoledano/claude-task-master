/**
 * scan-workspace.js
 * MCP tool for scanning a workspace and generating tasks based on code analysis
 */

import { z } from 'zod';
import { scanWorkspaceFunction } from '../core/direct-functions/scan-workspace.js';
import logger from '../logger.js';

/**
 * Formats the generated files for display in the UI
 * @param {Array} generatedFiles - Array of generated file objects
 * @returns {string} - Formatted string for display
 */
function formatGeneratedFilesForDisplay(generatedFiles) {
  if (!generatedFiles || !Array.isArray(generatedFiles) || generatedFiles.length === 0) {
    return "No files were generated.";
  }

  // Group files by type
  const filesByType = {
    'tasks.json': [],
    'prd': [],
    'complexity-report': [],
    'task-file': []
  };

  generatedFiles.forEach(file => {
    if (filesByType[file.type] !== undefined) {
      filesByType[file.type].push(file);
    }
  });

  let output = "=== GENERATED FILES ===\n\n";

  // Display PRD if exists
  if (filesByType['prd'].length > 0) {
    output += "=== PRD ===\n";
    output += filesByType['prd'][0].content;
    output += "\n\n";
  }

  // Display Tasks.json if exists
  if (filesByType['tasks.json'].length > 0) {
    output += "=== TASKS.JSON ===\n";
    output += filesByType['tasks.json'][0].content;
    output += "\n\n";
  }

  // Display complexity report if exists
  if (filesByType['complexity-report'].length > 0) {
    output += "=== COMPLEXITY REPORT ===\n";
    output += filesByType['complexity-report'][0].content;
    output += "\n\n";
  }

  // Display task files
  if (filesByType['task-file'].length > 0) {
    output += "=== TASK FILES ===\n";
    // Sort task files by ID
    const sortedTaskFiles = filesByType['task-file'].sort((a, b) => {
      const idA = parseInt(a.taskId, 10);
      const idB = parseInt(b.taskId, 10);
      return idA - idB;
    });

    sortedTaskFiles.forEach(file => {
      output += `--- TASK ${file.taskId} ---\n`;
      output += file.content;
      output += "\n\n";
    });
  }

  return output;
}

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
        .describe('Use CLI-friendly progress reporting'),
      skipComplexity: z
        .boolean()
        .optional()
        .default(false)
        .describe('Skip the automatic task complexity analysis step')
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
          'aiAnalysis': 'Analyzing task complexity for better breakdown',
          'finalization': 'Generating individual task files',
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
          // Display all the generated files
          const formattedFiles = formatGeneratedFilesForDisplay(result.generatedFiles);
          
          await updateProgress({
            phase: 'complete',
            message: 'Scan complete',
            detail: `Generated ${result.taskCount || 0} tasks based on ${params.generatePRD ? 'PRD and ' : ''}code analysis. Displaying all generated documents.`,
            progress: 100,
            generatedFiles: formattedFiles
          });
          
          // Print generated files to the console in CLI mode
          if (params.cliMode) {
            console.log(formattedFiles);
          }
        } else {
          await updateProgress({
            phase: 'error',
            message: 'Scan failed',
            detail: result.error || 'Unknown error. Try running with --debug flag for more information.',
            progress: 100
          });
        }
        
        // Add formatted files to the result
        if (result.success && result.generatedFiles) {
          result.formattedFiles = formatGeneratedFilesForDisplay(result.generatedFiles);
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