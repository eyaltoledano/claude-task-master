/**
 * complexity-report.js
 * Direct function implementation for displaying complexity analysis report
 */

import {
	readComplexityReport,
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import path from 'path';
import { COMPLEXITY_REPORT_FILE } from '../../../../src/constants/paths.js';

/**
 * Direct function wrapper for displaying the complexity report with error handling and caching.
 *
 * @param {Object} taskMaster - TaskMaster instance providing path resolution methods
 * @param {Object} args - Command arguments (no longer contains reportPath)
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Result object with success status and data/error information
 */
export async function complexityReportDirect(taskMaster, args, log) {
	try {
		log.info(`Getting complexity report with args: ${JSON.stringify(args)}`);

		// Handle case where complexityReportPath might be null
		const complexityReportPath =
			taskMaster.getComplexityReportPath() ||
			path.resolve(taskMaster.getProjectRoot(), COMPLEXITY_REPORT_FILE);

		// Use the resolved report path
		log.info(`Looking for complexity report at: ${complexityReportPath}`);

		// Generate cache key based on report path
		const cacheKey = `complexityReport:${complexityReportPath}`;

		// Define the core action function to read the report
		const coreActionFn = async () => {
			try {
				// Enable silent mode to prevent console logs from interfering with JSON response
				enableSilentMode();

				const report = readComplexityReport(complexityReportPath);

				// Restore normal logging
				disableSilentMode();

				if (!report) {
					log.warn(`No complexity report found at ${complexityReportPath}`);
					return {
						success: false,
						error: {
							code: 'FILE_NOT_FOUND_ERROR',
							message: `No complexity report found at ${complexityReportPath}. Run 'analyze-complexity' first.`
						}
					};
				}

				return {
					success: true,
					data: {
						report,
						reportPath: complexityReportPath
					}
				};
			} catch (error) {
				// Make sure to restore normal logging even if there's an error
				disableSilentMode();

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
			const result = await coreActionFn();
			log.info('complexityReportDirect completed');
			return result;
		} catch (error) {
			// Ensure silent mode is disabled
			disableSilentMode();

			log.error(`Unexpected error during complexityReport: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'UNEXPECTED_ERROR',
					message: error.message
				}
			};
		}
	} catch (error) {
		// Ensure silent mode is disabled if an outer error occurs
		disableSilentMode();

		log.error(`Error in complexityReportDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'UNEXPECTED_ERROR',
				message: error.message
			}
		};
	}
}
