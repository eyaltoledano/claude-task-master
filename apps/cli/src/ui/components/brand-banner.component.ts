/**
 * @fileoverview Brand banner component
 * Displays the fancy Task Master ASCII art banner with gradient colors
 * Can be hidden by setting TM_HIDE_BANNER=true
 */

import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import gradient from 'gradient-string';

// Create a cool color gradient for the banner
const coolGradient = gradient(['#00b4d8', '#0077b6', '#03045e']);

/**
 * Render ASCII banner text with gradient and creator credit
 */
function renderBannerWithCredit(text: string): void {
	try {
		const bannerText = figlet.textSync(text, {
			font: 'Standard',
			horizontalLayout: 'default',
			verticalLayout: 'default'
		});
		console.log(coolGradient(bannerText));
	} catch (error) {
		// Fallback to simple text if figlet fails
		console.log(coolGradient(`=== ${text} ===`));
	}
	console.log(
		chalk.dim('by ') + chalk.cyan.underline('https://x.com/eyaltoledano')
	);
}

export interface AsciiBannerOptions {
	/** Version string to display */
	version?: string;
	/** Project name to display */
	projectName?: string;
	/** Skip the version/project info box */
	skipInfoBox?: boolean;
}

/**
 * Check if banner should be hidden via environment variable
 */
function isBannerHidden(): boolean {
	return process.env.TM_HIDE_BANNER === 'true';
}

/**
 * Display the fancy ASCII art banner for the CLI
 * Can be hidden by setting TM_HIDE_BANNER=true
 */
export function displayAsciiBanner(options: AsciiBannerOptions = {}): void {
	if (isBannerHidden()) return;

	const { version, projectName, skipInfoBox = false } = options;

	// Display the banner with creator credit
	renderBannerWithCredit('Task Master');

	// Display version and project info if provided
	if (!skipInfoBox && (version || projectName)) {
		const infoParts: string[] = [];

		if (version) {
			infoParts.push(`${chalk.bold('Version:')} ${version}`);
		}

		if (projectName) {
			infoParts.push(`${chalk.bold('Project:')} ${projectName}`);
		}

		console.log(
			boxen(chalk.white(infoParts.join('   ')), {
				padding: 1,
				margin: { top: 0, bottom: 1 },
				borderStyle: 'round',
				borderColor: 'cyan'
			})
		);
	}
}

/**
 * Display a simpler initialization banner
 * Used during project initialization
 */
export function displayInitBanner(): void {
	if (isBannerHidden()) return;

	// Display the banner with creator credit
	renderBannerWithCredit('Task Master AI');

	console.log(
		boxen(chalk.white(`${chalk.bold('Initializing')} your new project`), {
			padding: 1,
			margin: { top: 0, bottom: 1 },
			borderStyle: 'round',
			borderColor: 'cyan'
		})
	);
}
