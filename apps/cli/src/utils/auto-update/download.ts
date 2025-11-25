/**
 * @fileoverview Tarball download with progress bar
 */

import fs from 'fs';
import https from 'https';

import chalk from 'chalk';
import cliProgress from 'cli-progress';

import type { TarballInfo } from './types.js';

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Fetch tarball info (URL and size) from npm registry
 */
export async function fetchTarballInfo(
	version: string
): Promise<TarballInfo | null> {
	return new Promise((resolve) => {
		const options = {
			hostname: 'registry.npmjs.org',
			path: `/task-master-ai/${version}`,
			method: 'GET',
			headers: {
				Accept: 'application/json',
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
						resolve(null);
						return;
					}

					const packageData = JSON.parse(data);
					const tarballUrl = packageData.dist?.tarball;
					const unpackedSize = packageData.dist?.unpackedSize;

					if (!tarballUrl) {
						resolve(null);
						return;
					}

					resolve({
						url: tarballUrl,
						size: unpackedSize || 0
					});
				} catch {
					resolve(null);
				}
			});
		});

		req.on('error', () => {
			resolve(null);
		});

		req.setTimeout(10000, () => {
			req.destroy();
			resolve(null);
		});

		req.end();
	});
}

/**
 * Download tarball with progress bar
 */
export async function downloadTarballWithProgress(
	tarballUrl: string,
	destPath: string,
	version: string,
	maxRedirects = 5
): Promise<boolean> {
	if (maxRedirects <= 0) {
		console.error(chalk.red('Too many redirects'));
		return Promise.resolve(false);
	}

	return new Promise((resolve) => {
		const url = new URL(tarballUrl);

		const options = {
			hostname: url.hostname,
			path: url.pathname,
			method: 'GET',
			headers: {
				'User-Agent': `task-master-ai/${version}`
			}
		};

		const req = https.request(options, (res) => {
			// Handle redirects
			if (res.statusCode === 301 || res.statusCode === 302) {
				const redirectUrl = res.headers.location;
				if (redirectUrl) {
					downloadTarballWithProgress(
						redirectUrl,
						destPath,
						version,
						maxRedirects - 1
					)
						.then(resolve)
						.catch(() => resolve(false));
					return;
				}
				resolve(false);
				return;
			}

			if (res.statusCode !== 200) {
				resolve(false);
				return;
			}

			const totalSize = Number.parseInt(
				res.headers['content-length'] || '0',
				10
			);
			let downloadedSize = 0;

			// Create progress bar
			const progressBar = new cliProgress.SingleBar(
				{
					format: `${chalk.blue('Downloading')} ${chalk.cyan('{bar}')} {percentage}% | {downloaded}/{total}`,
					barCompleteChar: '\u2588',
					barIncompleteChar: '\u2591',
					hideCursor: true,
					clearOnComplete: true
				},
				cliProgress.Presets.shades_classic
			);

			if (totalSize > 0) {
				progressBar.start(totalSize, 0, {
					downloaded: formatBytes(0),
					total: formatBytes(totalSize)
				});
			} else {
				// If no content-length, show indeterminate progress
				console.log(chalk.blue(`Downloading task-master-ai@${version}...`));
			}

			const fileStream = fs.createWriteStream(destPath);

			res.on('data', (chunk: Buffer) => {
				downloadedSize += chunk.length;
				if (totalSize > 0) {
					progressBar.update(downloadedSize, {
						downloaded: formatBytes(downloadedSize),
						total: formatBytes(totalSize)
					});
				}
			});

			res.pipe(fileStream);

			fileStream.on('finish', () => {
				if (totalSize > 0) {
					progressBar.stop();
				}
				fileStream.close(() => {
					console.log(
						chalk.green('✓') +
							chalk.dim(` Downloaded ${formatBytes(downloadedSize)}`)
					);
					resolve(true);
				});
			});

			fileStream.on('error', (err) => {
				if (totalSize > 0) {
					progressBar.stop();
				}
				console.error(chalk.red('Download error:'), err.message);
				fs.unlink(destPath, () => {}); // Cleanup partial file
				resolve(false);
			});
		});

		req.on('error', (err) => {
			console.error(chalk.red('Request error:'), err.message);
			resolve(false);
		});

		req.setTimeout(120000, () => {
			req.destroy();
			console.error(chalk.red('Download timeout'));
			resolve(false);
		});

		req.end();
	});
}
