/**
 * @fileoverview Changelog fetching and parsing utilities
 */

import https from 'https';

/**
 * Fetch CHANGELOG.md from GitHub and extract highlights for a specific version
 */
export async function fetchChangelogHighlights(
	version: string
): Promise<string[]> {
	return new Promise((resolve) => {
		const options = {
			hostname: 'raw.githubusercontent.com',
			path: '/eyaltoledano/claude-task-master/main/CHANGELOG.md',
			method: 'GET',
			headers: {
				'User-Agent': `task-master-ai/${version}`
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				try {
					if (res.statusCode !== 200) {
						resolve([]);
						return;
					}

					const highlights = parseChangelogHighlights(data, version);
					resolve(highlights);
				} catch {
					resolve([]);
				}
			});
		});

		req.on('error', () => {
			resolve([]);
		});

		req.setTimeout(3000, () => {
			req.destroy();
			resolve([]);
		});

		req.end();
	});
}

/**
 * Parse changelog markdown to extract Minor Changes for a specific version
 * @internal - Exported for testing purposes only
 */
export function parseChangelogHighlights(
	changelog: string,
	version: string
): string[] {
	try {
		// Validate version format (basic semver pattern) to prevent ReDoS
		if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(version)) {
			return [];
		}

		// Find the version section
		const versionRegex = new RegExp(
			`## ${version.replace(/\./g, '\\.')}\\s*\\n`,
			'i'
		);
		const versionMatch = changelog.match(versionRegex);

		if (!versionMatch) {
			return [];
		}

		// Extract content from this version to the next version heading
		const startIdx = versionMatch.index! + versionMatch[0].length;
		const nextVersionIdx = changelog.indexOf('\n## ', startIdx);
		const versionContent =
			nextVersionIdx > 0
				? changelog.slice(startIdx, nextVersionIdx)
				: changelog.slice(startIdx);

		// Find Minor Changes section
		const minorChangesMatch = versionContent.match(
			/### Minor Changes\s*\n([\s\S]*?)(?=\n###|\n##|$)/i
		);

		if (!minorChangesMatch) {
			return [];
		}

		const minorChangesContent = minorChangesMatch[1];
		const highlights: string[] = [];

		// Extract all bullet points (lines starting with -)
		// Format: - [#PR](...) Thanks [@author]! - Description
		const bulletRegex = /^-\s+\[#\d+\][^\n]*?!\s+-\s+(.+?)$/gm;
		let match;

		while ((match = bulletRegex.exec(minorChangesContent)) !== null) {
			const desc = match[1].trim();
			highlights.push(desc);
		}

		return highlights;
	} catch {
		return [];
	}
}
