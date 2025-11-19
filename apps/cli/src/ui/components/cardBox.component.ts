import boxen from 'boxen';
import chalk from 'chalk';

/**
 * Level/variant for the card box styling
 */
export type CardBoxLevel = 'warn' | 'info';

/**
 * Configuration for the card box component
 */
export interface CardBoxConfig {
	/** Header text displayed in bold */
	header: string;
	/** Body paragraphs displayed in white */
	body: string[];
	/** Call to action section with label and URL (optional) */
	callToAction?: {
		label: string;
		action: string;
	};
	/** Footer text displayed in gray (usage instructions) */
	footer?: string;
	/** Level/variant for styling (default: 'warn' = yellow, 'info' = blue) */
	level?: CardBoxLevel;
}

/**
 * Creates a formatted boxen card with header, body, call-to-action, and optional footer.
 * A reusable component for displaying informational messages in a styled box.
 *
 * @param config - Configuration for the box sections
 * @returns Formatted string ready for console.log
 */
export function displayCardBox(config: CardBoxConfig): string {
	const { header, body, callToAction, footer, level = 'warn' } = config;

	// Determine colors based on level
	const headerColor = level === 'info' ? chalk.blue.bold : chalk.yellow.bold;
	const borderColor = level === 'info' ? 'blue' : 'yellow';

	// Build the content sections
	const sections: string[] = [
		// Header
		headerColor(header),

		// Body paragraphs
		...body.map((paragraph) => chalk.white(paragraph))
	];

	// Add call to action if provided
	if (callToAction && callToAction.label && callToAction.action) {
		sections.push(
			chalk.cyan(callToAction.label) +
				'\n' +
				chalk.blue.underline(callToAction.action)
		);
	}

	// Add footer if provided
	if (footer) {
		sections.push(chalk.gray(footer));
	}

	// Join sections with double newlines
	const content = sections.join('\n\n');

	// Wrap in boxen
	return boxen(content, {
		padding: 1,
		borderColor,
		borderStyle: 'round',
		margin: { top: 1, bottom: 1 }
	});
}
