/**
 * Direct function wrapper for analyzeTaskComplexity
 */

import { analyzeTaskComplexity } from '../../../../scripts/modules/task-manager.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
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
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function analyzeTaskComplexityDirect(args, log) {
  try {
    log.info(`Analyzing task complexity with args: ${JSON.stringify(args)}`);
    
    // Find the tasks.json path
    const tasksPath = findTasksJsonPath(args, log);
    
    // Determine output path
    let outputPath = args.output || 'scripts/task-complexity-report.json';
    if (!path.isAbsolute(outputPath) && args.projectRoot) {
      outputPath = path.join(args.projectRoot, outputPath);
    }
    
    // Create options object for analyzeTaskComplexity
    const options = {
      file: tasksPath,
      output: outputPath,
      model: args.model,
      threshold: args.threshold,
      research: args.research === true
    };
    
    log.info(`Analyzing task complexity from: ${tasksPath}`);
    log.info(`Output report will be saved to: ${outputPath}`);
    
    if (options.research) {
      log.info('Using Perplexity AI for research-backed complexity analysis');
    }
    
    // Call the core function
    await analyzeTaskComplexity(options);
    
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
    const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    
    return {
      success: true,
      data: {
        message: `Task complexity analysis complete. Report saved to ${outputPath}`,
        reportPath: outputPath,
        reportSummary: {
          taskCount: report.length,
          highComplexityTasks: report.filter(t => t.complexityScore >= 8).length,
          mediumComplexityTasks: report.filter(t => t.complexityScore >= 5 && t.complexityScore < 8).length,
          lowComplexityTasks: report.filter(t => t.complexityScore < 5).length,
        }
      }
    };
  } catch (error) {
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