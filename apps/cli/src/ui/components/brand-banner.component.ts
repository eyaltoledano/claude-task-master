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

	// Generate ASCII art text
	const bannerText = figlet.textSync('Task Master', {
		font: 'Standard',
		horizontalLayout: 'default',
		verticalLayout: 'default'
	});

	// Display the gradient banner
	console.log(coolGradient(bannerText));

	// Add creator credit line below the banner
	console.log(
		chalk.dim('by ') + chalk.cyan.underline('https://x.com/eyaltoledano')
	);

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

	// Generate ASCII art text
	const bannerText = figlet.textSync('Task Master AI', {
		font: 'Standard',
		horizontalLayout: 'default',
		verticalLayout: 'default'
	});

	// Display the gradient banner
	console.log(coolGradient(bannerText));

	// Add creator credit line below the banner
	console.log(
		chalk.dim('by ') + chalk.cyan.underline('https://x.com/eyaltoledano')
	);

	console.log(
		boxen(chalk.white(`${chalk.bold('Initializing')} your new project`), {
			padding: 1,
			margin: { top: 0, bottom: 1 },
			borderStyle: 'round',
			borderColor: 'cyan'
		})
	);
}
