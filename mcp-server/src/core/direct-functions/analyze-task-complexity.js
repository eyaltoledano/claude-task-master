/**
 * Direct function wrapper for analyzeTaskComplexity
 */

import analyzeTaskComplexity from '../../../../scripts/modules/task-manager/analyze-task-complexity.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';
import fs from 'fs';
import { createLogWrapper } from '../../tools/utils.js'; // Import the new utility

/**
 * Analyze task complexity and generate recommendations
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.outputPath - Explicit absolute path to save the report.
 * @param {string|number} [args.threshold] - Minimum complexity score to recommend expansion (1-10)
 * @param {boolean} [args.research] - Use Perplexity AI for research-backed complexity analysis
 * @param {Object} log - Logger object
 * @param {Object} [context={}] - Context object containing session data
 * @param {Object} [context.session] - MCP session object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function analyzeTaskComplexityDirect(args, log, context = {}) {
	const { session } = context; // Extract session
	// Destructure expected args
	const { tasksJsonPath, outputPath, model, threshold, research } = args; // Model is ignored by core function now

	// --- Initial Checks (remain the same) ---
	try {
		log.info(`Analyzing task complexity with args: ${JSON.stringify(args)}`);

		if (!tasksJsonPath) {
			log.error('analyzeTaskComplexityDirect called without tasksJsonPath');
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}
		if (!outputPath) {
			log.error('analyzeTaskComplexityDirect called without outputPath');
			return {
				success: false,
				error: { code: 'MISSING_ARGUMENT', message: 'outputPath is required' }
			};
		}

		const tasksPath = tasksJsonPath;
		const resolvedOutputPath = outputPath;

		log.info(`Analyzing task complexity from: ${tasksPath}`);
		log.info(`Output report will be saved to: ${resolvedOutputPath}`);

		if (research) {
			log.info('Using research role for complexity analysis');
		}

		// Prepare options for the core function
		const options = {
			file: tasksPath,
			output: resolvedOutputPath,
			// model: model, // No longer needed
			threshold: threshold,
			research: research === true // Ensure boolean
		};
		// --- End Initial Checks ---

		// --- Silent Mode and Logger Wrapper (remain the same) ---
		const wasSilent = isSilentMode();
		if (!wasSilent) {
			enableSilentMode();
		}

		// Create logger wrapper using the utility
		const mcpLog = createLogWrapper(log);

		let report; // To store the result from the core function

		try {
			// --- Call Core Function (Updated Context Passing) ---
			// Call the core function, passing options and the context object { session, mcpLog }
			report = await analyzeTaskComplexity(options, {
				session, // Pass the session object
				mcpLog // Pass the logger wrapper
			});
			// --- End Core Function Call ---
		} catch (error) {
			log.error(
				`Error in analyzeTaskComplexity core function: ${error.message}`
			);
			// Restore logging if we changed it
			if (!wasSilent && isSilentMode()) {
				disableSilentMode();
			}
			return {
				success: false,
				error: {
					code: 'ANALYZE_CORE_ERROR', // More specific error code
					message: `Error running core complexity analysis: ${error.message}`
				}
			};
		} finally {
			// Always restore normal logging in finally block if we enabled silent mode
			if (!wasSilent && isSilentMode()) {
				disableSilentMode();
			}
		}

		// --- Result Handling (remains largely the same) ---
		// Verify the report file was created (core function writes it)
		if (!fs.existsSync(resolvedOutputPath)) {
			return {
				success: false,
				error: {
					code: 'ANALYZE_REPORT_MISSING', // Specific code
					message:
						'Analysis completed but no report file was created at the expected path.'
				}
			};
		}

		// The core function now returns the report object directly
		if (!report || !report.complexityAnalysis) {
			log.error(
				'Core analyzeTaskComplexity function did not return a valid report object.'
			);
			return {
				success: false,
				error: {
					code: 'INVALID_CORE_RESPONSE',
					message: 'Core analysis function returned an invalid response.'
				}
			};
		}

		try {
			const analysisArray = report.complexityAnalysis; // Already an array

			// Count tasks by complexity (remains the same)
			const highComplexityTasks = analysisArray.filter(
				(t) => t.complexityScore >= 8
			).length;
			const mediumComplexityTasks = analysisArray.filter(
				(t) => t.complexityScore >= 5 && t.complexityScore < 8
			).length;
			const lowComplexityTasks = analysisArray.filter(
				(t) => t.complexityScore < 5
			).length;

			return {
				success: true,
				data: {
					message: `Task complexity analysis complete. Report saved to ${resolvedOutputPath}`,
					reportPath: resolvedOutputPath,
					reportSummary: {
						taskCount: analysisArray.length,
						highComplexityTasks,
						mediumComplexityTasks,
						lowComplexityTasks
					}
					// Include the full report data if needed by the client
					// fullReport: report
				}
			};
		} catch (parseError) {
			// Should not happen if core function returns object, but good safety check
			log.error(`Internal error processing report data: ${parseError.message}`);
			return {
				success: false,
				error: {
					code: 'REPORT_PROCESS_ERROR',
					message: `Internal error processing complexity report: ${parseError.message}`
				}
			};
		}
		// --- End Result Handling ---
	} catch (error) {
		// Catch errors from initial checks or path resolution
		// Make sure to restore normal logging if silent mode was enabled
		if (isSilentMode()) {
			disableSilentMode();
		}
		log.error(`Error in analyzeTaskComplexityDirect setup: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'DIRECT_FUNCTION_SETUP_ERROR',
				message: error.message
			}
		};
	}
}
