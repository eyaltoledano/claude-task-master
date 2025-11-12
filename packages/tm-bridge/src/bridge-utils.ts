/**
 * Shared utility functions for bridge operations
 */

import { type TmCore, createTmCore } from '@tm/core';
import type { ReportFunction, StorageCheckResult } from './bridge-types.js';

/**
 * Initialize TmCore and check if API storage is being used.
 *
 * This function encapsulates the common pattern used by all bridge functions:
 * 1. Try to create TmCore instance
 * 2. Check the storage type
 * 3. Return results or handle errors gracefully
 *
 * @param projectRoot - Project root directory
 * @param report - Logging function
 * @param fallbackMessage - Message to log if TmCore initialization fails
 * @returns Storage check result with TmCore instance if successful
 *
 * @example
 * const { isApiStorage, tmCore } = await checkStorageType(
 *   projectRoot,
 *   report,
 *   'falling back to file-based operation'
 * );
 *
 * if (!isApiStorage) {
 *   // Continue with file-based logic
 *   return null;
 * }
 */
export async function checkStorageType(
	projectRoot: string,
	report: ReportFunction,
	fallbackMessage = 'falling back to file-based operation'
): Promise<StorageCheckResult> {
	let tmCore: TmCore;

	try {
		tmCore = await createTmCore({
			projectPath: projectRoot || process.cwd()
		});
	} catch (tmCoreError) {
		const errorMessage =
			tmCoreError instanceof Error ? tmCoreError.message : String(tmCoreError);
		report('warn', `TmCore check failed, ${fallbackMessage}: ${errorMessage}`);

		return {
			isApiStorage: false,
			error: errorMessage
		};
	}

	// Check if we're using API storage (use resolved storage type, not config)
	const storageType = tmCore.tasks.getStorageType();

	if (storageType !== 'api') {
		return {
			isApiStorage: false,
			tmCore
		};
	}

	return {
		isApiStorage: true,
		tmCore
	};
}
