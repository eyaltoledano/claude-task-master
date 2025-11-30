/**
 * tools/complexity-report.js
 * Tool for displaying the complexity analysis report
 */

import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from '@tm/mcp';
import { z } from 'zod';
import { getCurrentTag } from '../../../scripts/modules/utils.js';
import { COMPLEXITY_REPORT_FILE } from '../../../src/constants/paths.js';
import { complexityReportDirect } from '../core/task-master-core.js';
import { findComplexityReportPath } from '../core/utils/path-utils.js';

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

				const resolvedTag = getCurrentTag(args.projectRoot);

				const pathArgs = {
					projectRoot: args.projectRoot,
					complexityReport: args.file,
					tag: resolvedTag
				};

				const reportPath = findComplexityReportPath(pathArgs, log);
				log.info('Reading complexity report from path: ', reportPath);

				if (!reportPath) {
					return createErrorResponse(
						'No complexity report found. Run task-master analyze-complexity first.'
					);
				}

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

				return handleApiResult({
					result,
					log: log,
					errorPrefix: 'Error retrieving complexity report',
					projectRoot: args.projectRoot
				});
			} catch (error) {
				log.error(`Error in complexity-report tool: ${error.message}`);
				return createErrorResponse(
					`Failed to retrieve complexity report: ${error.message}`
				);
			}
		})
	});
}
