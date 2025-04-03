/**
 * parse-prd.js
 * Direct function implementation for parsing PRD documents
 */

import path from 'path';
import fs from 'fs';
import { parsePRD } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for parsing PRD documents and generating tasks.
 * 
 * @param {Object} args - Command arguments containing input, numTasks or tasks, and output options.
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function parsePRDDirect(args, log) {
  try {
    log.info(`Parsing PRD document with args: ${JSON.stringify(args)}`);
    
    // Check required parameters
    if (!args.input) {
      const errorMessage = 'No input file specified. Please provide an input PRD document path.';
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'MISSING_INPUT_FILE', message: errorMessage },
        fromCache: false 
      };
    }
    
    // Resolve input path (relative to project root if provided)
    const projectRoot = args.projectRoot || process.cwd();
    const inputPath = path.isAbsolute(args.input) ? args.input : path.resolve(projectRoot, args.input);
    
    // Determine output path
    let outputPath;
    if (args.output) {
      outputPath = path.isAbsolute(args.output) ? args.output : path.resolve(projectRoot, args.output);
    } else {
      // Default to tasks/tasks.json in the project root
      outputPath = path.resolve(projectRoot, 'tasks', 'tasks.json');
    }
    
    // Verify input file exists
    if (!fs.existsSync(inputPath)) {
      const errorMessage = `Input file not found: ${inputPath}`;
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'INPUT_FILE_NOT_FOUND', message: errorMessage },
        fromCache: false 
      };
    }
    
    // Parse number of tasks - handle both string and number values
    let numTasks = 10; // Default
    if (args.numTasks) {
      numTasks = typeof args.numTasks === 'string' ? parseInt(args.numTasks, 10) : args.numTasks;
      if (isNaN(numTasks)) {
        numTasks = 10; // Fallback to default if parsing fails
        log.warn(`Invalid numTasks value: ${args.numTasks}. Using default: 10`);
      }
    }
    
    log.info(`Preparing to parse PRD from ${inputPath} and output to ${outputPath} with ${numTasks} tasks`);
    
    // Execute core parsePRD function (which is not async but we'll await it to maintain consistency)
    await parsePRD(inputPath, outputPath, numTasks);
    
    // Since parsePRD doesn't return a value but writes to a file, we'll read the result
    // to return it to the caller
    if (fs.existsSync(outputPath)) {
      const tasksData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      log.info(`Successfully parsed PRD and generated ${tasksData.tasks?.length || 0} tasks`);
      
      return {
        success: true,
        data: {
          message: `Successfully generated ${tasksData.tasks?.length || 0} tasks from PRD`,
          taskCount: tasksData.tasks?.length || 0,
          outputPath
        },
        fromCache: false // This operation always modifies state and should never be cached
      };
    } else {
      const errorMessage = `Tasks file was not created at ${outputPath}`;
      log.error(errorMessage);
      return { 
        success: false, 
        error: { code: 'OUTPUT_FILE_NOT_CREATED', message: errorMessage },
        fromCache: false 
      };
    }
  } catch (error) {
    log.error(`Error parsing PRD: ${error.message}`);
    return { 
      success: false, 
      error: { code: 'PARSE_PRD_ERROR', message: error.message || 'Unknown error parsing PRD' },
      fromCache: false 
    };
  }
} 