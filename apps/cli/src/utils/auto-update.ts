/**
 * @fileoverview Auto-update utilities for task-master-ai CLI
 */

import { spawn } from 'child_process';
import https from 'https';
import chalk from 'chalk';
import ora from 'ora';

export interface UpdateInfo {
	currentVersion: string;
	latestVersion: string;
	needsUpdate: boolean;
}

/**
 * Get current version from package.json
 */
function getCurrentVersion(): string {
	try {
		// Read from the root package.json
		const fs = require('fs');
		const path = require('path');
		const packagePath = path.join(__dirname, '../../../../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
		return packageJson.version;
	} catch (error) {
		console.warn('Could not read package.json for version info');
		return '0.0.0';
	}
}

/**
 * Compare semantic versions
 * @param v1 - First version
 * @param v2 - Second version
 * @returns -1 if v1 < v2, 0 if v1 = v2, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
	const v1Parts = v1.split('.').map((p) => parseInt(p, 10));
	const v2Parts = v2.split('.').map((p) => parseInt(p, 10));

	for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
		const v1Part = v1Parts[i] || 0;
		const v2Part = v2Parts[i] || 0;

		if (v1Part < v2Part) return -1;
		if (v1Part > v2Part) return 1;
	}

	return 0;
}

/**
 * Check for newer version of task-master-ai
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
	const currentVersion = getCurrentVersion();

	return new Promise((resolve) => {
		const options = {
			hostname: 'registry.npmjs.org',
			path: '/task-master-ai',
			method: 'GET',
			headers: {
				Accept: 'application/vnd.npm.install-v1+json'
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				try {
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
			req.abort();
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
 * Automatically update task-master-ai to the latest version
 */
export async function performAutoUpdate(
	latestVersion: string
): Promise<boolean> {
	const spinner = ora({
		text: chalk.blue(`Updating task-master-ai to version ${chalk.green(latestVersion)}`),
		spinner: 'dots',
		color: 'blue'
	}).start();

	return new Promise((resolve) => {
		const updateProcess = spawn(
			'npm',
			['install', '-g', `task-master-ai@${latestVersion}`],
			{
				stdio: ['ignore', 'pipe', 'pipe']
			}
		);

		let errorOutput = '';

		updateProcess.stdout.on('data', () => {
			// Update spinner text with progress
			spinner.text = chalk.blue(`Installing task-master-ai@${latestVersion}...`);
		});

		updateProcess.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		updateProcess.on('close', (code) => {
			if (code === 0) {
				spinner.succeed(
					chalk.green(`Successfully updated to version ${chalk.bold(latestVersion)}`)
				);
				console.log(chalk.dim('Please restart your command to use the new version.'));
				resolve(true);
			} else {
				spinner.fail(chalk.red('Auto-update failed'));
				console.log(chalk.cyan(`Please run manually: npm install -g task-master-ai@${latestVersion}`));
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
