/**
 * @fileoverview CLI restart functionality after update
 */

import { spawn } from 'child_process';
import process from 'process';

import chalk from 'chalk';

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
