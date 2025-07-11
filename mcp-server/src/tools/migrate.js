/**
 * migrate.js
 * MCP tool for migrating existing projects to new .taskmaster directory structure
 */

import { z } from 'zod';
import { createErrorResponse, createContentResponse } from './utils.js';
import logger from '../logger.js';

/**
 * Register the migrate tool
 * @param {Object} server - FastMCP server instance
 */
export function registerMigrateTool(server) {
	server.addTool({
		name: 'migrate',
		description: 'Migrate existing project to use the new .taskmaster directory structure',
		parameters: z.object({
			force: z.boolean().optional().describe('Force migration even if .taskmaster directory already exists'),
			backup: z.boolean().optional().describe('Create backup of old files before migration (default: false)'),
			cleanup: z.boolean().optional().describe('Remove old files after successful migration (default: true)'),
			yes: z.boolean().optional().describe('Skip confirmation prompts'),
			dryRun: z.boolean().optional().describe('Show what would be migrated without actually moving files')
		}),
		execute: async (args, { log }) => {
			try {
				const { 
					force = false, 
					backup = false, 
					cleanup = true, 
					yes = false, 
					dryRun = false 
				} = args;
				
				log.info(`Starting project migration with options: force=${force}, backup=${backup}, cleanup=${cleanup}, dryRun=${dryRun}`);

				// Import the migrate module dynamically
				const { migrateProject } = await import('../../../scripts/modules/task-manager/migrate.js');
				const { findProjectRoot } = await import('../../../scripts/modules/utils.js');

				// Find project root
				const projectRoot = findProjectRoot();
				if (!projectRoot) {
					const errorMsg = 'Could not find project root. Make sure you are in a Task Master project directory.';
					log.error(errorMsg);
					return createErrorResponse(errorMsg, 'PROJECT_ROOT_NOT_FOUND');
				}

				// Prepare options for migration function
				const migrationOptions = {
					force,
					backup,
					cleanup,
					yes,
					dryRun
				};

				// Execute the migration
				await migrateProject(migrationOptions);

				let resultMessage;
				if (dryRun) {
					resultMessage = `🔍 Migration dry run completed successfully!\n` +
						`📋 Check the console output above for details of what would be migrated.\n` +
						`📍 Project root: ${projectRoot}`;
				} else {
					resultMessage = `✅ Project migration completed successfully!\n` +
						`📁 Project migrated to use .taskmaster directory structure\n` +
						`📍 Project root: ${projectRoot}`;
					
					if (!cleanup) {
						resultMessage += `\n💡 Old files were preserved. Use cleanup=true to remove them after verification.`;
					}
				}
				
				log.info('Migration completed successfully');
				return createContentResponse(resultMessage);

			} catch (error) {
				const errorMsg = `Error during migration: ${error.message}`;
				log.error(errorMsg, { stack: error.stack });
				return createErrorResponse(errorMsg, 'MIGRATION_ERROR');
			}
		}
	});
}

export default { registerMigrateTool };
