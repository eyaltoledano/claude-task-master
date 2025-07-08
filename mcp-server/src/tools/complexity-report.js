/**
 * tools/complexity-report.js
 * Tool for displaying the complexity analysis report
 */

import { z } from 'zod';
import {
	
	handleApiResult,
	createErrorResponse

} from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { complexityReportDirect } from '../core/task-master-core.js';
import { COMPLEXITY_REPORT_FILE } from '../../../src/constants/paths.js';

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
		execute: withTaskMaster({
			'complexityReportPath': 'file',
			'required': [
						'complexityReportPath'
			]
})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(
					`Getting complexity report with args: ${JSON.stringify(args)}`
				);

				const pathArgs = {
					projectRoot: taskMaster.getProjectRoot(),
					complexityReport: args.file
				};

				const reportPath = findComplexityReportPath(pathArgs, log);

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

				return handleApiResult(
					result,
					log,
					'Error retrieving complexity report',
					undefined,
					taskMaster.getProjectRoot()
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
