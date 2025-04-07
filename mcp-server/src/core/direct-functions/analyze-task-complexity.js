/**
 * Direct function wrapper for analyzeTaskComplexity
 */

import { analyzeTaskComplexity } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import { enableSilentMode, disableSilentMode, isSilentMode, readJSON } from '../../../../scripts/modules/utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Analyze task complexity and generate recommendations
 * @param {Object} args - Function arguments
 * @param {string} [args.file] - Path to the tasks file
 * @param {string} [args.output] - Output file path for the report
 * @param {string} [args.model] - LLM model to use for analysis
 * @param {string|number} [args.threshold] - Minimum complexity score to recommend expansion (1-10)
 * @param {boolean} [args.research] - Use Perplexity AI for research-backed complexity analysis
 * @param {string} [args.projectRoot] - Project root directory
 * @param {Object} log - Logger object
 * @param {Object} [context={}] - Context object containing session data
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function analyzeTaskComplexityDirect(args, log, context = {}) {
  const { session } = context; // Only extract session, not reportProgress
  
  try {
    log.info(`Analyzing task complexity with args: ${JSON.stringify(args)}`);
    
    // Find the tasks.json path
    const tasksPath = findTasksJsonPath(args, log);
    
    // Determine output path
    let outputPath = args.output || 'scripts/task-complexity-report.json';
    if (!path.isAbsolute(outputPath) && args.projectRoot) {
      outputPath = path.join(args.projectRoot, outputPath);
    }
    
    log.info(`Analyzing task complexity from: ${tasksPath}`);
    log.info(`Output report will be saved to: ${outputPath}`);
    
    if (args.research) {
      log.info('Using Perplexity AI for research-backed complexity analysis');
    }
    
    // Create options object for analyzeTaskComplexity
    const options = {
      file: tasksPath,
      output: outputPath,
      model: args.model,
      threshold: args.threshold,
      research: args.research === true
    };
    
    // Enable silent mode to prevent console logs from interfering with JSON response
    const wasSilent = isSilentMode();
    if (!wasSilent) {
      enableSilentMode();
    }
    
    // Create a logWrapper that matches the expected mcpLog interface as specified in utilities.mdc
    const logWrapper = {
      info: (message, ...args) => log.info(message, ...args),
      warn: (message, ...args) => log.warn(message, ...args),
      error: (message, ...args) => log.error(message, ...args),
      debug: (message, ...args) => log.debug && log.debug(message, ...args),
      success: (message, ...args) => log.info(message, ...args) // Map success to info
    };
    
    try {
      // Call the core function with session and logWrapper as mcpLog
      await analyzeTaskComplexity(options, {
        session,
        mcpLog: logWrapper // Use the wrapper instead of passing log directly
      });
    } catch (error) {
      log.error(`Error in analyzeTaskComplexity: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'ANALYZE_ERROR',
          message: `Error running complexity analysis: ${error.message}`
        }
      };
    } finally {
      // Always restore normal logging in finally block, but only if we enabled it
      if (!wasSilent) {
        disableSilentMode();
      }
    }
    
    // Verify the report file was created
    if (!fs.existsSync(outputPath)) {
      return {
        success: false,
        error: {
          code: 'ANALYZE_ERROR',
          message: 'Analysis completed but no report file was created'
        }
      };
    }
    
    // Read the report file
    let report;
    try {
      report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      
      // Important: Handle different report formats
      // The core function might return an array or an object with a complexityAnalysis property
      const analysisArray = Array.isArray(report) ? report : 
                           (report.complexityAnalysis || []);
      
      // Count tasks by complexity
      const highComplexityTasks = analysisArray.filter(t => t.complexityScore >= 8).length;
      const mediumComplexityTasks = analysisArray.filter(t => t.complexityScore >= 5 && t.complexityScore < 8).length;
      const lowComplexityTasks = analysisArray.filter(t => t.complexityScore < 5).length;
      
      return {
        success: true,
        data: {
          message: `Task complexity analysis complete. Report saved to ${outputPath}`,
          reportPath: outputPath,
          reportSummary: {
            taskCount: analysisArray.length,
            highComplexityTasks,
            mediumComplexityTasks,
            lowComplexityTasks
          }
        }
      };
    } catch (parseError) {
      log.error(`Error parsing report file: ${parseError.message}`);
      return {
        success: false,
        error: {
          code: 'REPORT_PARSE_ERROR',
          message: `Error parsing complexity report: ${parseError.message}`
        }
      };
    }
  } catch (error) {
    // Make sure to restore normal logging even if there's an error
    if (isSilentMode()) {
      disableSilentMode();
    }
    
    log.error(`Error in analyzeTaskComplexityDirect: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'CORE_FUNCTION_ERROR',
        message: error.message
      }
    };
  }
} 