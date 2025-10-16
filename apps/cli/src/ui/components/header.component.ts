/**
 * @fileoverview Task Master header component
 * Displays the banner, version, project info, and file path
 */

import chalk from 'chalk';

/**
 * Brief information for API storage
 */
export interface BriefInfo {
	briefId: string;
	briefName: string;
	orgSlug?: string;
	webAppUrl?: string;
}

/**
 * Header configuration options
 */
export interface HeaderOptions {
	title?: string;
	tag?: string;
	filePath?: string;
	storageType?: 'api' | 'file';
	briefInfo?: BriefInfo;
}

/**
 * Display the Task Master header with project info
 */
export function displayHeader(options: HeaderOptions = {}): void {
	const { filePath, tag, storageType, briefInfo } = options;

	// Display different header based on storage type
	if (storageType === 'api' && briefInfo) {
		// API storage: Show brief information
		const briefDisplay = `🏷  Brief: ${chalk.cyan(briefInfo.briefName)} ${chalk.gray(`(${briefInfo.briefId})`)}`;
		console.log(briefDisplay);

		// Construct and display the brief URL or ID
		if (briefInfo.webAppUrl && briefInfo.orgSlug) {
			const briefUrl = `${briefInfo.webAppUrl}/home/${briefInfo.orgSlug}/briefs/${briefInfo.briefId}/plan`;
			console.log(`Listing tasks from: ${chalk.dim(briefUrl)}`);
		} else if (briefInfo.webAppUrl) {
			// Show web app URL and brief ID if org slug is missing
			console.log(
				`Listing tasks from: ${chalk.dim(`${briefInfo.webAppUrl} (Brief: ${briefInfo.briefId})`)}`
			);
			console.log(
				chalk.yellow(
					`💡 Tip: Run ${chalk.cyan('tm context select')} to set your organization and see the full URL`
				)
			);
		} else {
			// Fallback: just show the brief ID if we can't get web app URL
			console.log(
				`Listing tasks from: ${chalk.dim(`API (Brief ID: ${briefInfo.briefId})`)}`
			);
		}
	} else if (tag) {
		// File storage: Show tag information
		let tagInfo = '';

		if (tag && tag !== 'master') {
			tagInfo = `🏷  tag: ${chalk.cyan(tag)}`;
		} else {
			tagInfo = `🏷  tag: ${chalk.cyan('master')}`;
		}

		console.log(tagInfo);

		if (filePath) {
			// Convert to absolute path if it's relative
			const absolutePath = filePath.startsWith('/')
				? filePath
				: `${process.cwd()}/${filePath}`;
			console.log(`Listing tasks from: ${chalk.dim(absolutePath)}`);
		}
	}
}
