/**
 * @fileoverview Display helper utilities for commands
 * Provides DRY utilities for displaying headers and other command output
 */

import type { TaskMasterCore } from '@tm/core';
import type { StorageType } from '@tm/core/types';
import { displayHeader, type BriefInfo } from '../ui/index.js';

/**
 * Get web app base URL from environment
 */
function getWebAppUrl(): string | undefined {
	const baseDomain =
		process.env.TM_BASE_DOMAIN || process.env.TM_PUBLIC_BASE_DOMAIN;

	if (!baseDomain) {
		return undefined;
	}

	// If it already includes protocol, use as-is
	if (baseDomain.startsWith('http://') || baseDomain.startsWith('https://')) {
		return baseDomain;
	}

	// Otherwise, add protocol based on domain
	if (baseDomain.includes('localhost') || baseDomain.includes('127.0.0.1')) {
		return `http://${baseDomain}`;
	}

	return `https://${baseDomain}`;
}

/**
 * Display the command header with appropriate storage information
 * Handles both API and file storage displays
 */
export function displayCommandHeader(
	tmCore: TaskMasterCore | undefined,
	options: {
		tag?: string;
		storageType: Exclude<StorageType, 'auto'>;
	}
): void {
	const { tag, storageType } = options;

	// Get brief info if using API storage
	let briefInfo: BriefInfo | undefined;
	if (storageType === 'api' && tmCore) {
		const storageInfo = tmCore.getStorageDisplayInfo();
		if (storageInfo) {
			// Construct full brief info with web app URL
			briefInfo = {
				...storageInfo,
				webAppUrl: getWebAppUrl()
			};
		}
	}

	// Get file path for display (only for file storage)
	// Note: The file structure is fixed for file storage and won't change.
	// This is a display-only relative path, not used for actual file operations.
	const filePath =
		storageType === 'file' && tmCore
			? `.taskmaster/tasks/tasks.json`
			: undefined;

	// Display header
	displayHeader({
		tag: tag || 'master',
		filePath: filePath,
		storageType: storageType === 'api' ? 'api' : 'file',
		briefInfo: briefInfo
	});
}
