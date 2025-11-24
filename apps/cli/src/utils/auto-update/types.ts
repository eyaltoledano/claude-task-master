/**
 * @fileoverview Type definitions for auto-update functionality
 */

export interface UpdateInfo {
	currentVersion: string;
	latestVersion: string;
	needsUpdate: boolean;
	highlights?: string[];
}

export interface TarballInfo {
	url: string;
	size: number;
}
