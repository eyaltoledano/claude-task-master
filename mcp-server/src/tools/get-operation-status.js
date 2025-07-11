// mcp-server/src/tools/get-operation-status.js
import { z } from 'zod';
import { createErrorResponse, createContentResponse } from './utils.js'; // Assuming these utils exist

/**
 * Register the get_operation_status tool.
 * @param {FastMCP} server - FastMCP server instance.
 */
export function registerGetOperationStatusTool(server) {
	server.addTool({
		name: 'get_operation_status',
		description:
			'Retrieves the status and result/error of a background operation.',
		parameters: z.object({
			operationId: z.string().describe('The ID of the operation to check.')
		}),
		execute: async (args, { log }) => {
			try {
				const { operationId } = args;
				log.info(`Checking status for operation ID: ${operationId}`);

				// For now, return a simple status response since we don't have async operations implemented
				// This can be enhanced later when async operation management is added
				const status = {
					operationId,
					status: 'not_implemented',
					message: 'Async operation management is not yet implemented in this MCP server',
					timestamp: new Date().toISOString()
				};

				log.info(`Status for ${operationId}: ${status.status}`);
				return createContentResponse(status);
			} catch (error) {
				log.error(`Error in get_operation_status tool: ${error.message}`, {
					stack: error.stack
				});
				return createErrorResponse(
					`Failed to get operation status: ${error.message}`,
					'GET_STATUS_ERROR'
				);
			}
		}
	});
}
