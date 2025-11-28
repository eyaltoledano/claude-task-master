/**
 * @fileoverview Check npm registry for package updates
 */

import https from 'https';

import { fetchChangelogHighlights } from './changelog.js';
import type { UpdateInfo } from './types.js';
import { compareVersions, getCurrentVersion } from './version.js';

/**
 * Check for newer version of task-master-ai
 */
export async function checkForUpdate(
	currentVersionOverride?: string
): Promise<UpdateInfo> {
	const currentVersion = currentVersionOverride || getCurrentVersion();

	return new Promise((resolve) => {
		const options = {
			hostname: 'registry.npmjs.org',
			path: '/task-master-ai',
			method: 'GET',
			headers: {
				Accept: 'application/vnd.npm.install-v1+json',
				'User-Agent': `task-master-ai/${currentVersion}`
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', async () => {
				try {
					if (res.statusCode !== 200)
						throw new Error(`npm registry status ${res.statusCode}`);
					const npmData = JSON.parse(data);
					const latestVersion = npmData['dist-tags']?.latest || currentVersion;

					const needsUpdate =
						compareVersions(currentVersion, latestVersion) < 0;

					// Fetch highlights if update is needed
					let highlights: string[] | undefined;
					if (needsUpdate) {
						highlights = await fetchChangelogHighlights(latestVersion);
					}

					resolve({
						currentVersion,
						latestVersion,
						needsUpdate,
						highlights
					});
				} catch {
					resolve({
						currentVersion,
						latestVersion: currentVersion,
						needsUpdate: false
					});
				}
			});
		});

		req.on('error', () => {
			resolve({
				currentVersion,
				latestVersion: currentVersion,
				needsUpdate: false
			});
		});

		req.setTimeout(3000, () => {
			req.destroy();
			resolve({
				currentVersion,
				latestVersion: currentVersion,
				needsUpdate: false
			});
		});

		req.end();
	});
}
