/**
 * restore-archive.js
 * Direct function implementation for restoring archived tasks and PRDs
 */

import { restoreArchive } from '../../../../scripts/modules/utils.js';
import { createSuccessResponse, createErrorResponse } from '../../tools/utils.js';
import path from 'path';
import fs from 'fs';

/**
 * Direct function wrapper for restoring archives with error handling.
 * 
 * @param {Object} args - Command arguments
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Restore result { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function restoreArchiveDirect(args, log) {
	try {
		log.info(`Restoring archive with args: ${JSON.stringify(args)}`);

		// Validate required parameters
		if (!args.archivePath) {
			const error = 'Archive path parameter is required';
			log.error(error);
			return createErrorResponse(error, { code: 'MISSING_ARCHIVE_PATH' });
		}

		// Ensure projectRoot is present for path resolution
		if (!args.projectRoot) {
			const error = 'Project root parameter is required';
			log.error(error);
			return createErrorResponse(error, { code: 'MISSING_PROJECT_ROOT' });
		}

		// Resolve paths relative to project root if not absolute
		const projectRoot = args.projectRoot;
		const archivePath = path.isAbsolute(args.archivePath)
			? args.archivePath
			: path.join(projectRoot, args.archivePath);

		// Resolve destination path if provided
		let destinationPath = null;
		if (args.destinationPath) {
			destinationPath = path.isAbsolute(args.destinationPath)
				? args.destinationPath
				: path.join(projectRoot, args.destinationPath);
		}

		// Verify archive exists
		if (!fs.existsSync(archivePath)) {
			const error = `Archive file not found: ${archivePath}`;
			log.error(error);
			return createErrorResponse(error, { code: 'ARCHIVE_NOT_FOUND' });
		}

		log.info(`Restoring from ${archivePath}${destinationPath ? ` to ${destinationPath}` : ''}`);

		// Execute the restore function
		const result = restoreArchive(
			archivePath,
			destinationPath,
			args.createBackup !== false
		);

		if (!result.success) {
			log.error(`Failed to restore archive: ${result.error}`);
			return createErrorResponse(result.error, { code: 'RESTORE_FAILED' });
		}

		log.info(`Successfully restored archive to ${result.restoredTo}`);
		return createSuccessResponse({
			message: `Successfully restored archive to ${result.restoredTo}`,
			restoredTo: result.restoredTo,
			relativePath: path.relative(projectRoot, result.restoredTo)
		});
	} catch (error) {
		log.error(`Error in restore-archive direct function: ${error.message}`);
		return createErrorResponse(error.message);
	}
} 