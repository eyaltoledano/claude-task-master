/**
 * @fileoverview Package installation operations
 */

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import process from 'process';

import chalk from 'chalk';
import cliProgress from 'cli-progress';
import ora from 'ora';

import { downloadTarballWithProgress, fetchTarballInfo } from './download.js';

/** Installation phases with weights (how much of the progress bar each phase takes) */
const INSTALL_PHASES = [
	{ name: 'Extracting package', weight: 15 },
	{ name: 'Resolving dependencies', weight: 25 },
	{ name: 'Building dependency tree', weight: 20 },
	{ name: 'Linking package', weight: 25 },
	{ name: 'Finalizing installation', weight: 15 }
];

/** Total weight for percentage calculation */
const TOTAL_WEIGHT = INSTALL_PHASES.reduce((sum, p) => sum + p.weight, 0);

/**
 * Parse npm output to determine current installation phase index
 */
function parseNpmPhaseIndex(output: string): number {
	const lowerOutput = output.toLowerCase();

	if (lowerOutput.includes('extract') || lowerOutput.includes('unpack')) {
		return 0;
	}
	if (lowerOutput.includes('resolv') || lowerOutput.includes('fetch')) {
		return 1;
	}
	if (lowerOutput.includes('build') || lowerOutput.includes('tree')) {
		return 2;
	}
	if (lowerOutput.includes('link') || lowerOutput.includes('bin')) {
		return 3;
	}
	if (lowerOutput.includes('added') || lowerOutput.includes('done')) {
		return 4;
	}

	return -1;
}

/**
 * Calculate progress percentage based on phase and sub-progress within phase
 */
function calculateProgress(phaseIndex: number, phaseProgress: number): number {
	if (phaseIndex < 0 || phaseIndex >= INSTALL_PHASES.length) {
		return phaseIndex >= INSTALL_PHASES.length ? 100 : 0;
	}
	let baseProgress = 0;
	for (let i = 0; i < phaseIndex; i++) {
		baseProgress += INSTALL_PHASES[i].weight;
	}
	const currentPhaseContribution =
		(INSTALL_PHASES[phaseIndex].weight * phaseProgress) / 100;
	return Math.round(
		((baseProgress + currentPhaseContribution) / TOTAL_WEIGHT) * 100
	);
}

/**
 * Install package from local tarball with progress bar
 */
async function installFromTarball(tarballPath: string): Promise<boolean> {
	// Create progress bar
	const progressBar = new cliProgress.SingleBar(
		{
			format: `${chalk.blue('Installing')} ${chalk.cyan('{bar}')} {percentage}% | {phase}`,
			barCompleteChar: '\u2588',
			barIncompleteChar: '\u2591',
			hideCursor: true,
			clearOnComplete: true
		},
		cliProgress.Presets.shades_classic
	);

	progressBar.start(100, 0, { phase: INSTALL_PHASES[0].name });

	let currentPhaseIndex = 0;
	let currentProgress = 0;
	const startTime = Date.now();

	// Smooth progress animation within phases
	const progressInterval = setInterval(() => {
		const elapsed = Date.now() - startTime;

		// Estimate phase based on time (fallback when npm is silent)
		// Assume ~10 seconds total install time, distributed by phase weights
		const estimatedTotalTime = 10000; // 10 seconds estimate
		let timeBasedPhase = 0;
		let accumulatedTime = 0;

		for (let i = 0; i < INSTALL_PHASES.length; i++) {
			const phaseTime =
				(INSTALL_PHASES[i].weight / TOTAL_WEIGHT) * estimatedTotalTime;
			if (elapsed < accumulatedTime + phaseTime) {
				timeBasedPhase = i;
				break;
			}
			accumulatedTime += phaseTime;
			timeBasedPhase = i;
		}

		// Use time-based phase if we haven't detected a newer phase from npm output
		if (timeBasedPhase > currentPhaseIndex) {
			currentPhaseIndex = timeBasedPhase;
		}

		// Calculate sub-progress within current phase (smooth animation)
		const phaseStartTime =
			(INSTALL_PHASES.slice(0, currentPhaseIndex).reduce(
				(sum, p) => sum + p.weight,
				0
			) /
				TOTAL_WEIGHT) *
			estimatedTotalTime;
		const phaseDuration =
			(INSTALL_PHASES[currentPhaseIndex].weight / TOTAL_WEIGHT) *
			estimatedTotalTime;
		const phaseElapsed = elapsed - phaseStartTime;
		const phaseProgress = Math.min((phaseElapsed / phaseDuration) * 100, 95); // Cap at 95% within phase

		const newProgress = calculateProgress(currentPhaseIndex, phaseProgress);

		// Only update if progress increased (never go backwards)
		if (newProgress > currentProgress) {
			currentProgress = newProgress;
			progressBar.update(currentProgress, {
				phase: INSTALL_PHASES[currentPhaseIndex].name
			});
		}
	}, 100);

	return new Promise((resolve) => {
		const installProcess = spawn(
			'npm',
			['install', '-g', tarballPath, '--no-fund', '--no-audit'],
			{
				stdio: ['ignore', 'pipe', 'pipe']
			}
		);

		let errorOutput = '';

		// Parse stdout for progress hints
		installProcess.stdout.on('data', (data) => {
			const output = data.toString();
			const detectedPhase = parseNpmPhaseIndex(output);
			if (detectedPhase > currentPhaseIndex) {
				currentPhaseIndex = detectedPhase;
				const newProgress = calculateProgress(currentPhaseIndex, 0);
				if (newProgress > currentProgress) {
					currentProgress = newProgress;
					progressBar.update(currentProgress, {
						phase: INSTALL_PHASES[currentPhaseIndex].name
					});
				}
			}
		});

		installProcess.stderr.on('data', (data) => {
			const output = data.toString();
			errorOutput += output;

			// npm often writes progress to stderr
			const detectedPhase = parseNpmPhaseIndex(output);
			if (detectedPhase > currentPhaseIndex) {
				currentPhaseIndex = detectedPhase;
				const newProgress = calculateProgress(currentPhaseIndex, 0);
				if (newProgress > currentProgress) {
					currentProgress = newProgress;
					progressBar.update(currentProgress, {
						phase: INSTALL_PHASES[currentPhaseIndex].name
					});
				}
			}
		});

		installProcess.on('close', (code) => {
			clearInterval(progressInterval);

			// Complete the progress bar
			progressBar.update(100, { phase: 'Complete' });
			progressBar.stop();

			// Cleanup tarball
			if (fs.existsSync(tarballPath)) {
				fs.unlink(tarballPath, () => {});
			}

			if (code === 0) {
				console.log(
					chalk.green('✔') + chalk.green(' Update installed successfully')
				);
				resolve(true);
			} else {
				console.log(chalk.red('✖') + chalk.red(' Installation failed'));
				if (errorOutput) {
					// Only show actual errors, not progress messages
					const actualErrors = errorOutput
						.split('\n')
						.filter(
							(line) =>
								line.includes('ERR') ||
								line.includes('error') ||
								line.includes('WARN')
						)
						.join('\n')
						.trim();
					if (actualErrors) {
						console.log(chalk.dim(`Error: ${actualErrors}`));
					}
				}
				resolve(false);
			}
		});

		installProcess.on('error', (error) => {
			clearInterval(progressInterval);
			progressBar.stop();

			// Cleanup tarball
			fs.unlink(tarballPath, () => {});
			console.log(chalk.red('✖') + chalk.red(' Installation failed'));
			console.log(chalk.red('Error:'), error.message);
			resolve(false);
		});
	});
}

/**
 * Fallback: Direct npm install without progress bar
 */
async function performDirectNpmInstall(
	latestVersion: string
): Promise<boolean> {
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

	// Fetch tarball info from npm registry
	const tarballInfo = await fetchTarballInfo(latestVersion);

	if (!tarballInfo) {
		// Fall back to direct npm install if we can't get tarball info
		return performDirectNpmInstall(latestVersion);
	}

	// Create temp directory for tarball
	const tempDir = os.tmpdir();
	const tarballPath = path.join(tempDir, `task-master-ai-${latestVersion}.tgz`);

	// Download tarball with progress
	const downloadSuccess = await downloadTarballWithProgress(
		tarballInfo.url,
		tarballPath,
		latestVersion
	);

	if (!downloadSuccess) {
		// Fall back to direct npm install on download failure
		console.log(chalk.dim('Falling back to npm install...'));
		return performDirectNpmInstall(latestVersion);
	}

	// Install from tarball
	const installSuccess = await installFromTarball(tarballPath);

	if (!installSuccess) {
		console.log(
			chalk.cyan(
				`Please run manually: npm install -g task-master-ai@${latestVersion}`
			)
		);
		return false;
	}

	console.log(
		chalk.green(`Successfully updated to version ${chalk.bold(latestVersion)}`)
	);
	return true;
}
