/**
 * @fileoverview Terminal link formatters for clickable URLs
 * Uses OSC 8 protocol for terminals that support it, with graceful fallback
 */

import chalk from 'chalk';
import terminalLink from 'terminal-link';

/**
 * Creates a clickable terminal link if supported, otherwise returns styled text
 * @param text - The visible text to display
 * @param url - The URL to link to
 * @param options - Optional styling options
 */
export function createLink(
	text: string,
	url: string,
	options?: { color?: 'cyan' | 'blue' | 'gray' | 'green' | 'yellow' }
): string {
	const colorFn = options?.color ? chalk[options.color] : chalk.cyan;

	// terminal-link automatically falls back to plain text if unsupported
	const link = terminalLink(text, url, {
		fallback: (displayText, linkUrl) => `${displayText} (${linkUrl})`
	});

	return colorFn(link);
}

/**
 * Creates a clickable URL that displays the full URL as the text
 * @param url - The URL to display and link to
 * @param options - Optional styling options
 */
export function createUrlLink(
	url: string,
	options?: { color?: 'cyan' | 'blue' | 'gray' | 'green' | 'yellow' }
): string {
	return createLink(url, url, options);
}

/**
 * Creates a clickable brief ID link
 * @param briefId - The brief ID (e.g., "HAM-123")
 * @param briefUrl - The full URL to the brief
 */
export function createBriefLink(briefId: string, briefUrl: string): string {
	return createLink(briefId, briefUrl, { color: 'cyan' });
}

/**
 * Creates a clickable task ID link
 * @param taskId - The task ID (e.g., "TAS-67")
 * @param taskUrl - The full URL to the task
 */
export function createTaskLink(taskId: string, taskUrl: string): string {
	return createLink(taskId, taskUrl, { color: 'cyan' });
}

/**
 * Checks if the terminal supports clickable links
 * Note: terminal-link handles this internally, but exposed for conditional logic
 */
export function supportsLinks(): boolean {
	return terminalLink.isSupported;
}
