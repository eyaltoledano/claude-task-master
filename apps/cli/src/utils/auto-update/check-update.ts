/**
 * @fileoverview Check npm registry for package updates with caching
 *
 * Uses a simple file-based cache in the OS temp directory to avoid
 * hitting npm on every CLI invocation. Cache expires after 1 hour.
 */

import fs from 'node:fs';
import https from 'https';
import os from 'node:os';
import path from 'node:path';

import { fetchChangelogHighlights } from './changelog.js';
import type { UpdateInfo } from './types.js';
import { compareVersions, getCurrentVersion } from './version.js';

// ============================================================================
// Cache Configuration
// ============================================================================

/** Cache TTL: 1 hour in milliseconds */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Cache file name */
const CACHE_FILENAME = 'taskmaster-update-cache.json';

interface UpdateCache {
	timestamp: number;
	latestVersion: string;
	highlights?: string[];
}

// ============================================================================
// Cache Operations (Single Responsibility: cache I/O)
// ============================================================================

/**
 * Get the path to the update cache file in OS temp directory
 */
const getCachePath = (): string => path.join(os.tmpdir(), CACHE_FILENAME);

/**
 * Read cached update info if still valid
 * @returns Cached data or null if expired/missing/invalid
 */
function readCache(): UpdateCache | null {
	try {
		const cachePath = getCachePath();
		if (!fs.existsSync(cachePath)) return null;

		const data: UpdateCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
		const isExpired = Date.now() - data.timestamp > CACHE_TTL_MS;

		return isExpired ? null : data;
	} catch {
		return null;
	}
}

/**
 * Write update info to cache
 */
function writeCache(latestVersion: string, highlights?: string[]): void {
	try {
		fs.writeFileSync(
			getCachePath(),
			JSON.stringify(
				{
					timestamp: Date.now(),
					latestVersion,
					highlights
				} satisfies UpdateCache,
				null,
				2
			)
		);
	} catch {
		// Cache write failures are non-critical - silently ignore
	}
}

// ============================================================================
// NPM Registry Operations (Single Responsibility: npm API)
// ============================================================================

/** Request timeout for npm registry */
const NPM_TIMEOUT_MS = 3000;

/**
 * Fetch latest version from npm registry
 * @returns Latest version string or null on failure
 */
function fetchLatestVersion(currentVersion: string): Promise<string | null> {
	return new Promise((resolve) => {
		const req = https.request(
			{
				hostname: 'registry.npmjs.org',
				path: '/task-master-ai',
				method: 'GET',
				headers: {
					Accept: 'application/vnd.npm.install-v1+json',
					'User-Agent': `task-master-ai/${currentVersion}`
				}
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					try {
						if (res.statusCode !== 200) {
							resolve(null);
							return;
						}
						const npmData = JSON.parse(data);
						resolve(npmData['dist-tags']?.latest || null);
					} catch {
						resolve(null);
					}
				});
			}
		);

		req.on('error', () => resolve(null));
		req.setTimeout(NPM_TIMEOUT_MS, () => {
			req.destroy();
			resolve(null);
		});
		req.end();
	});
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build UpdateInfo response
 */
function buildUpdateInfo(
	currentVersion: string,
	latestVersion: string,
	highlights?: string[]
): UpdateInfo {
	return {
		currentVersion,
		latestVersion,
		needsUpdate: compareVersions(currentVersion, latestVersion) < 0,
		highlights
	};
}

/**
 * Check for newer version of task-master-ai
 * Uses a 1-hour cache to avoid hitting npm on every CLI invocation
 */
export async function checkForUpdate(
	currentVersionOverride?: string
): Promise<UpdateInfo> {
	const currentVersion = currentVersionOverride || getCurrentVersion();

	// Return cached result if valid
	const cached = readCache();
	if (cached) {
		return buildUpdateInfo(
			currentVersion,
			cached.latestVersion,
			cached.highlights
		);
	}

	// Fetch from npm registry
	const latestVersion = await fetchLatestVersion(currentVersion);
	if (!latestVersion) {
		return buildUpdateInfo(currentVersion, currentVersion);
	}

	// Fetch changelog highlights if update available
	const needsUpdate = compareVersions(currentVersion, latestVersion) < 0;
	const highlights = needsUpdate
		? await fetchChangelogHighlights(latestVersion)
		: undefined;

	// Cache result
	writeCache(latestVersion, highlights);

	return buildUpdateInfo(currentVersion, latestVersion, highlights);
}
