/**
 * restore-archive.js
 * MCP tool for restoring archived tasks and PRDs
 */

import { restoreArchiveDirect } from '../core/direct-functions/restore-archive.js';
import { getProjectRootFromSession } from '../core/utils/session-utils.js';
import { handleApiResult } from './utils.js';

/**
 * Register the restore_archive tool with the MCP server
 * @param {Object} server - MCP server instance
 */
export function registerRestoreArchiveTool(server) {
	server.addTool({
		name: 'restore_archive',
		displayName: 'Restore Archive',
		description: 'Restore an archived tasks file or PRD to its original location',
		category: 'Task Management',
		internalName: 'taskmaster_restore_archive',
		iconPath: '/icons/restore-white.svg',
		parameters: {
			type: 'object',
			additionalProperties: false,
			required: ['projectRoot', 'archivePath'],
			properties: {
				projectRoot: {
					type: 'string',
					description: 'The directory of the project. Must be absolute path.'
				},
				archivePath: {
					type: 'string',
					description: 'Path to the archived file to restore (can be relative to project root).'
				},
				destinationPath: {
					type: 'string',
					description: 'Optional custom destination path. If not specified, will restore to original location.'
				},
				createBackup: {
					type: 'boolean',
					description: 'Whether to create a backup of the destination file if it exists (default: true).'
				}
			}
		},
		execute: async (args, { log, session }) => {
			try {
				log.info(`Starting restore-archive with args: ${JSON.stringify(args)}`);

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
				const result = await restoreArchiveDirect(
					{
						projectRoot: rootFolder,
						...args
					},
					log
				);

				// Forward the result
				return handleApiResult(result, log, 'Error restoring archive');
			} catch (error) {
				log.error(`Error in restore-archive tool: ${error.message}`);
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