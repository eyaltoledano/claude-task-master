/**
 * @fileoverview Display helper utilities for commands
 * Provides DRY utilities for displaying headers and other command output
 */

import type { TmCore } from '@tm/core';
import type { StorageType } from '@tm/core';
import { displayHeader } from '../ui/index.js';

/**
 * Display the command header with appropriate storage information
 * Handles both API and file storage displays
 */
export function displayCommandHeader(
	tmCore: TmCore | undefined,
	options: {
		tag?: string;
		storageType: Exclude<StorageType, 'auto'>;
	}
): void {
	if (!tmCore) {
		// Fallback display if tmCore is not available
		displayHeader({
			tag: options.tag || 'master',
			storageType: options.storageType
		});
		return;
	}

	// Get the resolved storage type from tasks domain
	const resolvedStorageType = tmCore.tasks.getStorageType();

	// Get storage display info from tm-core (single source of truth)
	const displayInfo = tmCore.auth.getStorageDisplayInfo(resolvedStorageType);

	// Display header with computed display info
	displayHeader({
		tag: options.tag || 'master',
		filePath: displayInfo.filePath,
		storageType: displayInfo.storageType,
		briefInfo: displayInfo.briefInfo
	});
}
