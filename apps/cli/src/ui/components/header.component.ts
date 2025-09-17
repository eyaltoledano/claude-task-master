/**
 * @fileoverview Task Master header component
 * Displays the banner, version, project info, and file path
 */

import chalk from 'chalk';

/**
 * Header configuration options
 */
export interface HeaderOptions {
	title?: string;
	tag?: string;
	filePath?: string;
}

/**
 * Display the Task Master header with project info
 */
export function displayHeader(options: HeaderOptions = {}): void {
	const { filePath, tag } = options;

	// Display tag and file path info
	if (tag) {
		let tagInfo = '';

		if (tag && tag !== 'master') {
			tagInfo = `🏷 tag: ${chalk.cyan(tag)}`;
		} else {
			tagInfo = `🏷 tag: ${chalk.cyan('master')}`;
		}

		console.log(tagInfo);

		if (filePath) {
			// Convert to absolute path if it's relative
			const absolutePath = filePath.startsWith('/')
				? filePath
				: `${process.cwd()}/${filePath}`;
			console.log(`Listing tasks from: ${chalk.dim(absolutePath)}`);
		}

		console.log(); // Empty line for spacing
	}
}
