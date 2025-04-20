/**
 * list-archives.js
 * MCP tool for listing archived tasks and PRDs
 */

import { listArchivesDirect } from '../core/direct-functions/list-archives.js';
import { getProjectRootFromSession } from '../core/utils/session-utils.js';
import { handleApiResult } from './utils.js';

/**
 * Register the list_archives tool with the MCP server
 * @param {Object} server - MCP server instance
 */
export function registerListArchivesTool(server) {
	server.addTool({
		name: 'list_archives',
		displayName: 'List Archives',
		description: 'List archived tasks and PRD files that were backed up before overwriting',
		category: 'Task Management',
		internalName: 'taskmaster_list_archives',
		iconPath: '/icons/archive-white.svg',
		parameters: {
			type: 'object',
			additionalProperties: false,
			required: ['projectRoot'],
			properties: {
				projectRoot: {
					type: 'string',
					description: 'The directory of the project. Must be absolute path.'
				},
				file: {
					type: 'string',
					description: 'Path to the tasks file (default: auto-detected)',
				}
			}
		},
		execute: async (args, { log, session }) => {
			try {
				log.info(`Starting list-archives with args: ${JSON.stringify(args)}`);

				// Get project root from session
				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				if (!rootFolder) {
					const errorMessage = 'Could not determine project root.';
					log.error(errorMessage);
					return {
						success: false,
						error: {
							code: 'NO_PROJECT_ROOT',
							message: errorMessage
						}
					};
				}

				log.info(`Project root resolved to: ${rootFolder}`);

				// Execute the direct function
				const result = await listArchivesDirect(
					{
						projectRoot: rootFolder,
						...args
					},
					log
				);

				// Forward the result
				return handleApiResult(result, log, 'Error listing archives');
			} catch (error) {
				log.error(`Error in list-archives tool: ${error.message}`);
				return {
					success: false,
					error: {
						code: 'TOOL_EXECUTION_ERROR',
						message: error.message
					}
				};
			}
		}
	});
} 