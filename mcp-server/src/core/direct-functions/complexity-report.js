/**
 * complexity-report.js
 * Direct function implementation for generating a complexity report using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG
} from '../../../../scripts/modules/utils.js';
import path from 'path';
import fs from 'fs';

/**
 * Direct function wrapper for generateComplexityReport via configured provider.
 *
 * @param {Object} args - Command arguments (input, output, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function complexityReportDirect(args, log, context = {}) {
	const { session } = context;
	// input: Path to the complexity analysis JSON file.
	// output: Path where the markdown report should be saved.
	const { projectRoot, input, output, file } = args;

	try {
		log.info(`Generating complexity report with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('complexityReportDirect called without projectRoot.');
		}
		if (!input) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Input path (input) to complexity analysis JSON is required' } };
		}
		if (!output) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Output path (output) for the markdown report is required' } };
		}
		// Ensure input file exists
		if (!fs.existsSync(input)) {
			return { success: false, error: { code: 'FILE_NOT_FOUND', message: `Input complexity analysis file not found: ${input}` } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to generate complexity report.`);

		// --- Prepare Jira MCP Tools if needed ---
		// Complexity report generation is typically provider-agnostic or primarily local,
		// but we include the pattern in case future providers need tools here.
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define any tools potentially required by a Jira provider's complexity report generation
			const requiredTools = []; // None currently expected
			for (const toolName of requiredTools) {
				const fullToolName = `${toolPrefix}_${toolName}`;
				if (typeof global[fullToolName] === 'function') {
					jiraMcpTools[toolName] = global[fullToolName];
				} else {
					log.warn(`Jira MCP tool function not found in global scope: ${fullToolName}`);
				}
			}
			log.debug('Prepared Jira MCP Tools for factory:', Object.keys(jiraMcpTools));
		}
		// --- End Jira MCP Tools Preparation ---

		const logWrapper = {
			info: (message, ...rest) => log.info(message, ...rest),
			warn: (message, ...rest) => log.warn(message, ...rest),
			error: (message, ...rest) => log.error(message, ...rest),
			debug: (message, ...rest) => log.debug && log.debug(message, ...rest),
			success: (message, ...rest) => log.info(message, ...rest)
		};

		enableSilentMode();
		try {
			// Pass jiraMcpTools in options to the factory
			const provider = await getTaskProvider({ jiraMcpTools });
			const providerOptions = {
				file, // Pass tasks file path if provider needs it for context
				mcpLog: logWrapper,
				session
			};

			// Ensure output directory exists
			try {
				const outputDir = path.dirname(output);
				if (!fs.existsSync(outputDir)) {
					fs.mkdirSync(outputDir, { recursive: true });
				}
			} catch (dirError) {
				throw { code: 'FILE_SYSTEM_ERROR', message: `Failed to create output directory for report: ${dirError.message}` };
			}

			// Call the provider's generateComplexityReport method
			// Assuming signature: generateComplexityReport(inputPath, outputPath, options)
			const reportResult = await provider.generateComplexityReport(input, output, providerOptions);

			disableSilentMode();

			// Check provider result
			if (reportResult && reportResult.success) {
				log.info(`Provider successfully generated complexity report: ${output}`);
				return {
					success: true,
					data: reportResult.data || { message: `Complexity report generated successfully at ${output}.` },
					fromCache: false // File system operation
				};
			} else {
				const errorMsg = reportResult?.error?.message || 'Provider failed to generate complexity report.';
				const errorCode = reportResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error generating complexity report: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: reportResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error during complexityReportDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_COMPLEXITY_REPORT_ERROR',
					message: error.message || 'Failed to generate complexity report'
				},
				fromCache: false
			};
		} finally {
			if (isSilentMode()) {
				disableSilentMode();
			}
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in complexityReportDirect: ${error.message}`);
		if (isSilentMode()) {
			disableSilentMode();
		}
		return {
			success: false,
			error: { code: 'DIRECT_FUNCTION_SETUP_ERROR', message: error.message },
			fromCache: false
		};
	}
}
