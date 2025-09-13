/**
 * @fileoverview Task Master header component
 * Displays the banner, version, project info, and file path
 */

import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import gradient from 'gradient-string';
import packageJson from '../../../package.json';

/**
 * Header configuration options
 */
export interface HeaderOptions {
	title?: string;
	version?: string;
	projectName?: string;
	tag?: string;
	filePath?: string;
	showBanner?: boolean;
}

/**
 * Create the Task Master ASCII art banner
 */
function createBanner(): string {
	const bannerText = figlet.textSync('Task Master', {
		font: 'Standard',
		horizontalLayout: 'default',
		verticalLayout: 'default'
	});

	// Create a cool gradient effect
	const coolGradient = gradient(['#0099ff', '#00ffcc']);
	return coolGradient(bannerText);
}

/**
 * Display the Task Master header with project info
 */
export function displayHeader(options: HeaderOptions = {}): void {
	const {
		version = packageJson.version,
		projectName = 'Taskmaster',
		tag,
		filePath,
		showBanner = true
	} = options;

	// Display the ASCII banner if requested
	if (showBanner) {
		console.log(createBanner());

		// Add creator credit line below the banner
		console.log(
			chalk.dim('by ') + chalk.cyan.underline('https://x.com/eyaltoledano')
		);
	}

	// Create the version and project info box
	const infoBoxContent = chalk.white(
		`${chalk.bold('Version:')} ${version}   ${chalk.bold('Project:')} ${projectName}`
	);

	console.log(
		boxen(infoBoxContent, {
			padding: { left: 1, right: 1, top: 0, bottom: 0 },
			margin: { top: 1, bottom: 1 },
			borderStyle: 'round',
			borderColor: 'cyan'
		})
	);

	// Display tag and file path info
	if (tag || filePath) {
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

/**
 * Display a simple header without the ASCII art
 */
export function displaySimpleHeader(options: HeaderOptions = {}): void {
	displayHeader({ ...options, showBanner: false });
}
