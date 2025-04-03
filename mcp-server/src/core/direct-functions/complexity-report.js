/**
 * complexity-report.js
 * Direct function implementation for displaying complexity analysis report
 */

import { readComplexityReport } from '../../../../scripts/modules/utils.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import { getCachedOrExecute } from '../../tools/utils.js';
import path from 'path';

/**
 * Direct function wrapper for displaying the complexity report with error handling and caching.
 * 
 * @param {Object} args - Command arguments containing file path option
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Result object with success status and data/error information
 */
export async function complexityReportDirect(args, log) {
  try {
    log.info(`Getting complexity report with args: ${JSON.stringify(args)}`);
    
    // Get tasks file path to determine project root for the default report location
    let tasksPath;
    try {
      tasksPath = findTasksJsonPath(args, log);
    } catch (error) {
      log.warn(`Tasks file not found, using current directory: ${error.message}`);
      // Continue with default or specified report path
    }

    // Get report file path from args or use default
    const reportPath = args.file || path.join(process.cwd(), 'scripts', 'task-complexity-report.json');
    
    log.info(`Looking for complexity report at: ${reportPath}`);
    
    // Generate cache key based on report path
    const cacheKey = `complexityReport:${reportPath}`;
    
    // Define the core action function to read the report
    const coreActionFn = async () => {
      try {
        const report = readComplexityReport(reportPath);
        
        if (!report) {
          log.warn(`No complexity report found at ${reportPath}`);
          return { 
            success: false, 
            error: { 
              code: 'FILE_NOT_FOUND_ERROR', 
              message: `No complexity report found at ${reportPath}. Run 'analyze-complexity' first.` 
            }
          };
        }
        
        return {
          success: true,
          data: {
            report,
            reportPath
          }
        };
      } catch (error) {
        log.error(`Error reading complexity report: ${error.message}`);
        return { 
          success: false, 
          error: { 
            code: 'READ_ERROR', 
            message: error.message 
          }
        };
      }
    };

    // Use the caching utility
    try {
      const result = await getCachedOrExecute({
        cacheKey,
        actionFn: coreActionFn,
        log
      });
      log.info(`complexityReportDirect completed. From cache: ${result.fromCache}`);
      return result; // Returns { success, data/error, fromCache }
    } catch (error) {
      // Catch unexpected errors from getCachedOrExecute itself
      log.error(`Unexpected error during getCachedOrExecute for complexityReport: ${error.message}`);
      return { 
        success: false, 
        error: { 
          code: 'UNEXPECTED_ERROR', 
          message: error.message 
        }, 
        fromCache: false 
      };
    }
  } catch (error) {
    log.error(`Error in complexityReportDirect: ${error.message}`);
    return { 
      success: false, 
      error: { 
        code: 'UNEXPECTED_ERROR', 
        message: error.message 
      }, 
      fromCache: false 
    };
  }
} 