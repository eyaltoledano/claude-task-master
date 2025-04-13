/**
 * list-archives.js
 * Direct function implementation for listing archived tasks and PRDs
 */

import { listArchives } from '../../../../scripts/modules/task-manager.js';
import { getCachedOrExecute } from '../../tools/utils.js';
import { createSuccessResponse, createErrorResponse } from '../../tools/utils.js';
import path from 'path';

/**
 * Direct function wrapper for listing archives with error handling and caching.
 * 
 * @param {Object} args - Command arguments
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Archives list result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }
 */
export async function listArchivesDirect(args, log) {
	try {
		log.info(`Listing archives with args: ${JSON.stringify(args)}`);

		// Ensure projectRoot is present
		if (!args.projectRoot) {
			const error = 'Project root parameter is required';
			log.error(error);
			return createErrorResponse(error, { code: 'MISSING_PROJECT_ROOT' });
		}

		// Validate project root exists
		const projectRoot = args.projectRoot;

		// Generate a cache key using project root
		const cacheKey = `listArchives:${projectRoot}`;

		// Function to execute when cache miss or ignored
		const executeFn = async () => {
			try {
				// Get archives from the function
				const archives = await listArchives(projectRoot);

				// Format the archives for display
				const formattedResult = {
					tasks: archives.tasks.map(task => ({
						filename: task.filename,
						path: task.path,
						timestamp: task.timestamp,
						size: task.size,
						relativePath: path.relative(projectRoot, task.path)
					})),
					prds: archives.prds.map(prd => ({
						filename: prd.filename,
						path: prd.path,
						timestamp: prd.timestamp,
						size: prd.size,
						relativePath: path.relative(projectRoot, prd.path)
					})),
					archiveLocations: {
						tasks: path.join(projectRoot, 'tasks', 'archives'),
						prds: path.join(projectRoot, 'scripts', 'archives')
					},
					hasArchives: archives.tasks.length > 0 || archives.prds.length > 0
				};

				return formattedResult;
			} catch (error) {
				log.error(`Error listing archives: ${error.message}`);
				throw error;
			}
		};

		// Use cache if appropriate, otherwise execute function
		const { result, fromCache } = await getCachedOrExecute(
			cacheKey,
			executeFn,
			{ ttl: 10 }, // 10 second cache for archives
			log
		);

		return createSuccessResponse(result, fromCache);
	} catch (error) {
		log.error(`Error in list-archives direct function: ${error.message}`);
		return createErrorResponse(error.message);
	}
} 