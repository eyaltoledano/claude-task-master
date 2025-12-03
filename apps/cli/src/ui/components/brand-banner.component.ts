/**
 * @fileoverview Brand banner component
 * Displays the fancy Task Master ASCII art banner with gradient colors
 * Can be hidden by setting TM_HIDE_BANNER=true
 */

import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { createLink } from '../formatters/link-formatters.js';

// Create a cool color gradient for the banner
const coolGradient = gradient(['#00b4d8', '#0077b6', '#03045e']);

export interface AsciiBannerOptions {
	/** Version string to display */
	version?: string;
	/** Project name to display (kept for compatibility but not displayed) */
	projectName?: string;
	/** Skip the version/project info box (kept for compatibility) */
	skipInfoBox?: boolean;
}

/**
 * Check if banner should be hidden via environment variable
 */
function isBannerHidden(): boolean {
	return process.env.TM_HIDE_BANNER === 'true';
}

/**
 * Get terminal width for right-aligning content
 */
function getTerminalWidth(): number {
	return process.stdout.columns || 80;
}

/**
 * Display the fancy ASCII art banner for the CLI
 * Can be hidden by setting TM_HIDE_BANNER=true
 */
export function displayAsciiBanner(options: AsciiBannerOptions = {}): void {
	if (isBannerHidden()) return;

	const { version } = options;

	// Render ASCII banner
	try {
		const bannerText = figlet.textSync('Task Master', {
			font: 'Standard',
			horizontalLayout: 'default',
			verticalLayout: 'default'
		});
		console.log(coolGradient(bannerText));
	} catch {
		console.log(coolGradient('=== Task Master ==='));
	}

	// Credits line with version right-aligned
	const xLink = createLink('x.com/eyaltoledano', 'https://x.com/eyaltoledano');
	const byText = chalk.dim('by ') + chalk.cyan(xLink);

	// Version with clickable link to GitHub release
	const cleanVersion = version ? version.replace(/^v/, '') : '';
	const releaseUrl = `https://github.com/eyaltoledano/claude-task-master/releases/tag/task-master-ai%40${cleanVersion}`;
	const versionLink = version
		? createLink(`v${cleanVersion}`, releaseUrl, { color: 'gray' })
		: '';

	if (versionLink) {
		// Calculate spacing for right alignment
		const byLength = 22; // "by x.com/eyaltoledano" approximate visible length
		const versionLength = cleanVersion.length + 1; // "v" + version
		const termWidth = getTerminalWidth();
		const spacing = Math.max(2, termWidth - byLength - versionLength - 2);
		console.log(byText + ' '.repeat(spacing) + versionLink);
	} else {
		console.log(byText);
	}

	// Hamster promo
	const hamsterLink = createLink('tryhamster.com', 'https://tryhamster.com');
	console.log(chalk.dim('Taskmaster for teams: ') + chalk.magenta(hamsterLink));
	console.log('');
}

/**
 * Display a simpler initialization banner
 * Used during project initialization
 */
export function displayInitBanner(): void {
	if (isBannerHidden()) return;

	// Render ASCII banner
	try {
		const bannerText = figlet.textSync('Task Master', {
			font: 'Standard',
			horizontalLayout: 'default',
			verticalLayout: 'default'
		});
		console.log(coolGradient(bannerText));
	} catch {
		console.log(coolGradient('=== Task Master ==='));
	}

	// Credits line
	const xLink = createLink('x.com/eyaltoledano', 'https://x.com/eyaltoledano');
	console.log(chalk.dim('by ') + chalk.cyan(xLink));

	// Hamster promo
	const hamsterLink = createLink('tryhamster.com', 'https://tryhamster.com');
	console.log(chalk.dim('Taskmaster for teams: ') + chalk.magenta(hamsterLink));
	console.log('');
}
