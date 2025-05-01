/**
 * complexity-report.js
 * Direct function implementation for displaying complexity analysis report
 */

import {
	readComplexityReport,
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { getCachedOrExecute } from '../../tools/utils.js';

/**
 * Direct function wrapper for displaying the complexity report with error handling and caching.
 *
 * @param {Object} args - Command arguments containing reportPath.
 * @param {string} args.reportPath - Explicit path to the complexity report file.
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Result object with success status and data/error information
 */
export async function complexityReportDirect(args, log) {
	// Destructure expected args
	const { reportPath } = args;
	try {
		log.info(`Getting complexity report with args: ${JSON.stringify(args)}`);

		// Check if reportPath was provided
		if (!reportPath) {
			log.error('complexityReportDirect called without reportPath');
			return {
				success: false,
				error: { code: 'MISSING_ARGUMENT', message: 'reportPath is required' },
				fromCache: false
			};
		}

		// Use the provided report path
		log.info(`Looking for complexity report at: ${reportPath}`);

		// Generate cache key based on report path
		const cacheKey = `complexityReport:${reportPath}`;

		// Define the core action function to read the report
		const coreActionFn = async () => {
			try {
				// Enable silent mode to prevent console logs from interfering with JSON response
				enableSilentMode();

				const report = readComplexityReport(reportPath);

				// Restore normal logging
				disableSilentMode();

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
			const result = await getCachedOrExecute({
				cacheKey,
				actionFn: coreActionFn,
				log
			});
			log.info(
				`complexityReportDirect completed. From cache: ${result.fromCache}`
			);
			return result; // Returns { success, data/error, fromCache }
		} catch (error) {
			// Catch unexpected errors from getCachedOrExecute itself
			// Ensure silent mode is disabled
			disableSilentMode();

			log.error(
				`Unexpected error during getCachedOrExecute for complexityReport: ${error.message}`
			);
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
		// Ensure silent mode is disabled if an outer error occurs
		disableSilentMode();

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
