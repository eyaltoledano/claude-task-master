/**
 * @fileoverview Auto-update utilities for task-master-ai CLI
 */

import { spawn } from 'child_process';
import https from 'https';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import process from 'process';

export interface UpdateInfo {
	currentVersion: string;
	latestVersion: string;
	needsUpdate: boolean;
	highlights?: string[];
}

/**
 * Get current version from build-time injected environment variable
 */
function getCurrentVersion(): string {
	// Version is injected at build time via TM_PUBLIC_VERSION
	const version = process.env.TM_PUBLIC_VERSION;
	if (version && version !== 'unknown') {
		return version;
	}

	// Fallback for development or if injection failed
	console.warn('Could not read version from TM_PUBLIC_VERSION, using fallback');
	return '0.0.0';
}

/**
 * Compare semantic versions with proper pre-release handling
 * @param v1 - First version
 * @param v2 - Second version
 * @returns -1 if v1 < v2, 0 if v1 = v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
	const toParts = (v: string) => {
		const [core, pre = ''] = v.split('-', 2);
		const nums = core.split('.').map((n) => Number.parseInt(n, 10) || 0);
		return { nums, pre };
	};

	const a = toParts(v1);
	const b = toParts(v2);
	const len = Math.max(a.nums.length, b.nums.length);

	// Compare numeric parts
	for (let i = 0; i < len; i++) {
		const d = (a.nums[i] || 0) - (b.nums[i] || 0);
		if (d !== 0) return d < 0 ? -1 : 1;
	}

	// Handle pre-release comparison
	if (a.pre && !b.pre) return -1; // prerelease < release
	if (!a.pre && b.pre) return 1; // release > prerelease
	if (a.pre === b.pre) return 0; // same or both empty
	return a.pre < b.pre ? -1 : 1; // basic prerelease tie-break
}

/**
 * Fetch CHANGELOG.md from GitHub and extract highlights for a specific version
 */
async function fetchChangelogHighlights(version: string): Promise<string[]> {
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
				} catch (error) {
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
	} catch (error) {
		return [];
	}
}

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
				} catch (error) {
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

/**
 * Display upgrade notification message
 */
export function displayUpgradeNotification(
	currentVersion: string,
	latestVersion: string,
	highlights?: string[]
) {
	let content = `${chalk.blue.bold('Update Available!')} ${chalk.dim(currentVersion)} → ${chalk.green(latestVersion)}`;

	if (highlights && highlights.length > 0) {
		content += '\n\n' + chalk.bold("What's New:");
		for (const highlight of highlights) {
			content += '\n' + chalk.cyan('• ') + highlight;
		}
		content += '\n\n' + 'Auto-updating to the latest version...';
	} else {
		content +=
			'\n\n' +
			'Auto-updating to the latest version with new features and bug fixes...';
	}

	const message = boxen(content, {
		padding: 1,
		margin: { top: 1, bottom: 1 },
		borderColor: 'yellow',
		borderStyle: 'round'
	});

	console.log(message);
}

/**
 * Automatically update task-master-ai to the latest version
 */
export async function performAutoUpdate(
	latestVersion: string
): Promise<boolean> {
	if (
		process.env.TASKMASTER_SKIP_AUTO_UPDATE === '1' ||
		process.env.CI ||
		process.env.NODE_ENV === 'test'
	) {
		const reason =
			process.env.TASKMASTER_SKIP_AUTO_UPDATE === '1'
				? 'TASKMASTER_SKIP_AUTO_UPDATE=1'
				: process.env.CI
					? 'CI environment'
					: 'NODE_ENV=test';
		console.log(chalk.dim(`Skipping auto-update (${reason})`));
		return false;
	}
	const spinner = ora({
		text: chalk.blue(
			`Updating task-master-ai to version ${chalk.green(latestVersion)}`
		),
		spinner: 'dots',
		color: 'blue'
	}).start();

	return new Promise((resolve) => {
		const updateProcess = spawn(
			'npm',
			[
				'install',
				'-g',
				`task-master-ai@${latestVersion}`,
				'--no-fund',
				'--no-audit',
				'--loglevel=warn'
			],
			{
				stdio: ['ignore', 'pipe', 'pipe']
			}
		);

		let errorOutput = '';

		updateProcess.stdout.on('data', () => {
			// Update spinner text with progress
			spinner.text = chalk.blue(
				`Installing task-master-ai@${latestVersion}...`
			);
		});

		updateProcess.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		updateProcess.on('close', (code) => {
			if (code === 0) {
				spinner.succeed(
					chalk.green(
						`Successfully updated to version ${chalk.bold(latestVersion)}`
					)
				);
				resolve(true);
			} else {
				spinner.fail(chalk.red('Auto-update failed'));
				console.log(
					chalk.cyan(
						`Please run manually: npm install -g task-master-ai@${latestVersion}`
					)
				);
				if (errorOutput) {
					console.log(chalk.dim(`Error: ${errorOutput.trim()}`));
				}
				resolve(false);
			}
		});

		updateProcess.on('error', (error) => {
			spinner.fail(chalk.red('Auto-update failed'));
			console.log(chalk.red('Error:'), error.message);
			console.log(
				chalk.cyan(
					`Please run manually: npm install -g task-master-ai@${latestVersion}`
				)
			);
			resolve(false);
		});
	});
}

/**
 * Restart the CLI with the newly installed version
 * @param argv - Original command-line arguments (process.argv)
 */
export function restartWithNewVersion(argv: string[]): void {
	const args = argv.slice(2); // Remove 'node' and script path

	console.log(chalk.dim('Restarting with updated version...\n'));

	// Spawn the updated task-master command
	const child = spawn('task-master', args, {
		stdio: 'inherit', // Inherit stdin/stdout/stderr so it looks seamless
		detached: false,
		shell: process.platform === 'win32' // Windows compatibility
	});

	child.on('exit', (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		process.exit(code ?? 0);
	});

	child.on('error', (error) => {
		console.error(
			chalk.red('Failed to restart with new version:'),
			error.message
		);
		console.log(chalk.yellow('Please run your command again manually.'));
		process.exit(1);
	});
}
