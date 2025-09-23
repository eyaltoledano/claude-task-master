/**
 * @fileoverview Auto-update utilities for task-master-ai CLI
 */

import { spawn } from 'child_process';
import https from 'https';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';

export interface UpdateInfo {
	currentVersion: string;
	latestVersion: string;
	needsUpdate: boolean;
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
function compareVersions(v1: string, v2: string): number {
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

			res.on('end', () => {
				try {
					if (res.statusCode !== 200)
						throw new Error(`npm registry status ${res.statusCode}`);
					const npmData = JSON.parse(data);
					const latestVersion = npmData['dist-tags']?.latest || currentVersion;

					const needsUpdate =
						compareVersions(currentVersion, latestVersion) < 0;

					resolve({
						currentVersion,
						latestVersion,
						needsUpdate
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
	latestVersion: string
) {
	const message = boxen(
		`${chalk.blue.bold('Update Available!')} ${chalk.dim(currentVersion)} → ${chalk.green(latestVersion)}\n\n` +
			`Auto-updating to the latest version with new features and bug fixes...`,
		{
			padding: 1,
			margin: { top: 1, bottom: 1 },
			borderColor: 'yellow',
			borderStyle: 'round'
		}
	);

	console.log(message);
}

/**
 * Automatically update task-master-ai to the latest version
 */
export async function performAutoUpdate(
	latestVersion: string
): Promise<boolean> {
	if (process.env.TASKMASTER_SKIP_AUTO_UPDATE === '1' || process.env.CI) {
		console.log(
			chalk.dim('Skipping auto-update (TASKMASTER_SKIP_AUTO_UPDATE/CI).')
		);
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
				console.log(
					chalk.dim('Please restart your command to use the new version.')
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
