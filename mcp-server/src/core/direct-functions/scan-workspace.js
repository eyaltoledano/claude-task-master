/**
 * scan-workspace.js - Direct function for scanning a workspace and generating tasks
 * 
 * This function analyzes the code in a workspace directory and generates tasks
 * based on the codebase, optionally creating a PRD as well.
 */

import { scanWorkspace } from '../../../../scripts/modules/workspace-scanner.js';
import fs from 'fs';
import path from 'path';
import logger from '../../logger.js';
import { archiveTasksBeforeOverwrite } from '../../../../scripts/modules/utils.js';
import { validatePath } from '../utils/path-utils.js';
import { getLogger } from '../../utils/logger.js';

/**
 * Validates path and makes it absolute if relative
 * @param {string} basePath - Base path to resolve against
 * @param {string} targetPath - Path to validate and resolve
 * @returns {string} Resolved absolute path
 */
function validatePath(basePath, targetPath) {
  // If targetPath is already absolute, return it
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  
  // Otherwise resolve it against the base path
  return path.resolve(basePath, targetPath);
}

/**
 * Scans a workspace directory and generates tasks based on code analysis
 * 
 * @param {Object} options - Scan options 
 * @param {string} options.projectRoot - Path to the project root
 * @param {string} [options.directory] - Directory to scan (defaults to projectRoot)
 * @param {string} [options.output] - Output file path for tasks.json
 * @param {number} [options.maxFiles] - Maximum number of files to analyze
 * @param {number} [options.maxSize] - Maximum size per file in bytes
 * @param {string} [options.ignoreDirs] - Comma-separated list of directories to ignore
 * @param {number} [options.numTasks] - Number of tasks to generate
 * @param {boolean} [options.generatePRD] - Whether to generate a PRD
 * @param {boolean} [options.confirmOverwrite] - Whether to overwrite existing tasks.json
 * @param {boolean} [options.cliMode] - Whether to enable CLI-friendly progress reporting
 * @param {Function} [reportProgress] - Optional callback for reporting progress
 * @returns {Promise<Object>} Result of the operation
 */
export async function scanWorkspaceFunction(options, reportProgress = null) {
  try {
    const { projectRoot, cliMode = false } = options;

    // Project root is required
    if (!projectRoot) {
      throw new Error('projectRoot parameter is required');
    }

    // Report progress
    if (reportProgress) {
      await reportProgress({
        phase: 'validation',
        message: 'Validating inputs',
        detail: 'Checking project root and parameters',
        progress: 5
      });
    }

    // Resolve project root to ensure it exists
    const resolvedProjectRoot = projectRoot;

    if (!fs.existsSync(resolvedProjectRoot)) {
      throw new Error(`Project root directory not found: ${resolvedProjectRoot}`);
    }
    
    // Get directory to scan - defaults to project root if not specified
    const directory = options.directory ? 
      validatePath(resolvedProjectRoot, options.directory) : 
      resolvedProjectRoot;
    
    // Get output file path - defaults to tasks/tasks.json relative to project root
    const outputFile = options.output ? 
      validatePath(resolvedProjectRoot, options.output) : 
      path.join(resolvedProjectRoot, 'tasks', 'tasks.json');
    
    // Report progress
    if (reportProgress) {
      await reportProgress({
        phase: 'setup',
        message: 'Setting up scan',
        detail: 'Checking for existing tasks and preparing output',
        progress: 10
      });
    }
    
    // Check if tasks.json already exists and respect confirmOverwrite parameter
    if (fs.existsSync(outputFile) && !options.confirmOverwrite) {
      logger.warn(`Existing tasks file found at ${outputFile}`);
      return {
        success: false,
        error: 'Existing tasks.json found. To overwrite, set confirmOverwrite parameter to true.',
        code: 'EXISTING_TASKS'
      };
    }
    
    // Archive existing tasks file if it exists and we're going to overwrite it
    if (fs.existsSync(outputFile) && options.confirmOverwrite) {
      const archiveResult = archiveTasksBeforeOverwrite(outputFile);
      if (!archiveResult.success) {
        logger.warn(`Could not archive existing tasks file: ${archiveResult.error}. Proceeding with overwrite.`);
      } else if (archiveResult.archived) {
        logger.info(`Existing tasks file has been archived to ${archiveResult.archivePath}`);
      }
    }
    
    // Parse options
    const maxFiles = options.maxFiles ? parseInt(options.maxFiles, 10) : 20;
    const maxSizePerFile = options.maxSize ? parseInt(options.maxSize, 10) : 5000;
    const ignoreDirs = options.ignoreDirs ? options.ignoreDirs.split(',') : ['.git', 'node_modules', 'dist', 'build', 'vendor', 'bin'];
    const numTasks = options.numTasks ? parseInt(options.numTasks, 10) : 15;
    const generatePRD = options.generatePRD !== undefined ? 
      options.generatePRD === 'false' ? false : true : 
      true;
    
    // Make sure output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Report progress
    if (reportProgress) {
      await reportProgress({
        phase: 'preparation',
        message: 'Preparing for scan',
        detail: `Ready to scan: ${path.basename(directory)}`,
        progress: 15
      });
    }
    
    // Log configuration info (less verbose in CLI mode)
    if (!cliMode) {
      logger.info(`Scanning workspace: ${directory}`);
      logger.info(`Output will be saved to: ${outputFile}`);
      logger.info(`Max files: ${maxFiles}, Max size per file: ${maxSizePerFile}`);
      logger.info(`Ignoring directories: ${ignoreDirs.join(', ')}`);
      logger.info(`Generate PRD: ${generatePRD ? 'Yes' : 'No'}`);
      if (generatePRD) {
        logger.info(`Number of tasks to generate from PRD: ${numTasks}`);
      }
    } else {
      // Simplified CLI logging
      console.log(`Scanning workspace: ${directory}`);
      console.log(`Output will be saved to: ${outputFile}`);
      console.log('');  // Empty line before progress starts
    }
    
    // Scan the workspace and generate tasks with progress reporting
    const tasks = await scanWorkspace(directory, {
      ignoreDirs,
      outputPath: outputFile,
      maxFiles,
      maxSizePerFile,
      numTasks,
      generatePRD,
      cliMode // Pass CLI mode option to the scanner
    }, reportProgress ? async (progressData) => {
      // Ensure progressData has all required fields to prevent undefined values
      const enhancedProgressData = {
        ...progressData,
        // Add baseline context information if not provided in the progress data
        detail: progressData.detail || "Processing...",
        workspacePath: directory, // Ensure workspace path is always available
        // Add any additional runtime context that might be needed
        context: {
          ...(progressData.context || {}),
          projectRoot: resolvedProjectRoot,
          outputFile: outputFile,
          maxFiles: maxFiles,
          numTasks: numTasks
        }
      };
      
      await reportProgress(enhancedProgressData);
    } : null);
    
    // Get a valid task count even if tasks is undefined or not an array
    const taskCount = Array.isArray(tasks) ? tasks.length : 0;
    
    const successMessage = generatePRD ? 
      `Successfully generated PRD and ${taskCount} tasks from workspace analysis` :
      `Successfully generated ${taskCount} tasks from codebase analysis`;
    
    if (cliMode) {
      console.log(''); // Empty line after progress completes
      console.log(successMessage);
      console.log(`Tasks saved to: ${outputFile}`);
    } else {
      logger.info(successMessage);
    }
    
    return {
      success: true,
      message: successMessage,
      output: outputFile,
      taskCount: taskCount,
      prdGenerated: generatePRD
    };
  } catch (error) {
    if (options.cliMode) {
      console.error(`Error scanning workspace: ${error.message}`);
    } else {
      logger.error(`Error scanning workspace: ${error.message}`);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

export default scanWorkspaceFunction; 