/**
 * tools/complexity-report.js
 * Tool for displaying the complexity analysis report
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { complexityReportDirect } from '../core/task-master-core.js';
import { COMPLEXITY_REPORT_FILE } from '../../../src/constants/paths.js';
import path from 'path';

/**
 * Register the complexityReport tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerComplexityReportTool(server) {
	server.addTool({
		name: 'complexity_report',
		description: 'Display the complexity analysis report in a readable format',
		parameters: z.object({
			file: z
				.string()
				.optional()
				.describe(
					`Path to the report file (default: ${COMPLEXITY_REPORT_FILE})`
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(
					`Getting complexity report with args: ${JSON.stringify(args)}`
				);

				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
				const reportPath = args.file
					? path.resolve(args.projectRoot, args.file)
					: path.resolve(args.projectRoot, COMPLEXITY_REPORT_FILE);

				const result = await complexityReportDirect(
					{
						reportPath: reportPath
					},
					log
				);

				if (result.success) {
					log.info('Successfully retrieved complexity report');
				} else {
					log.error(
						`Failed to retrieve complexity report: ${result.error.message}`
					);
				}

				return handleApiResult(
					result,
					log,
					'Error retrieving complexity report'
				);
			} catch (error) {
				log.error(`Error in complexity-report tool: ${error.message}`);
				return createErrorResponse(
					`Failed to retrieve complexity report: ${error.message}`
				);
			}
		})
	});
}
