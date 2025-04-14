// mcp-server/src/tools/get-operation-status.js
import { z } from 'zod';
import { createErrorResponse, createContentResponse } from './utils.js'; // Assuming these utils exist

/**
 * Register the get_operation_status tool.
 * @param {FastMCP} server - FastMCP server instance.
 * @param {AsyncOperationManager} asyncManager - The async operation manager.
 */
export function registerGetOperationStatusTool(server, asyncManager) {
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

				const status = asyncManager.getStatus(operationId);

				// Status will now always return an object, but it might have status='not_found'
				if (status.status === 'not_found') {
					log.warn(`Operation ID not found: ${operationId}`);
					return createErrorResponse(
						status.error?.message || `Operation ID not found: ${operationId}`,
						status.error?.code || 'OPERATION_NOT_FOUND'
					);
				}

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
