import boxen from 'boxen';
import chalk from 'chalk';

/**
 * Configuration for the card box component
 */
export interface CardBoxConfig {
	/** Header text displayed in yellow bold */
	header: string;
	/** Body paragraphs displayed in white */
	body: string[];
	/** Call to action section with label and URL */
	callToAction: {
		label: string;
		action: string;
	};
	/** Footer text displayed in gray (usage instructions) */
	footer?: string;
}

/**
 * Creates a formatted boxen card with header, body, call-to-action, and optional footer.
 * A reusable component for displaying informational messages in a styled box.
 *
 * @param config - Configuration for the box sections
 * @returns Formatted string ready for console.log
 */
export function displayCardBox(config: CardBoxConfig): string {
	const { header, body, callToAction, footer } = config;

	// Build the content sections
	const sections: string[] = [
		// Header
		chalk.yellow.bold(header),

		// Body paragraphs
		...body.map((paragraph) => chalk.white(paragraph)),

		// Call to action
		chalk.cyan(callToAction.label) +
			'\n' +
			chalk.blue.underline(callToAction.action)
	];

	// Add footer if provided
	if (footer) {
		sections.push(chalk.gray(footer));
	}

	// Join sections with double newlines
	const content = sections.join('\n\n');

	// Wrap in boxen
	return boxen(content, {
		padding: 1,
		borderColor: 'yellow',
		borderStyle: 'round',
		margin: { top: 1, bottom: 1 }
	});
}
