/**
 * @fileoverview Content rendering utilities for CLI
 * Handles HTML to Markdown conversion and terminal-friendly rendering
 */

import chalk from 'chalk';
import { MarkedExtension, marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import TurndownService from 'turndown';

// Initialize turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
	headingStyle: 'atx',
	codeBlockStyle: 'fenced',
	bulletListMarker: '-'
});

// Configure marked to use terminal renderer with subtle colors
marked.use(
	markedTerminal({
		// More subtle colors that match the overall design
		code: (code: string) => {
			// Custom code block handler to preserve formatting
			return code
				.split('\n')
				.map((line) => '    ' + chalk.cyan(line))
				.join('\n');
		},
		blockquote: chalk.gray.italic,
		html: chalk.gray, // Any remaining HTML will be grayed out (should be rare after turndown)
		heading: chalk.white.bold, // White bold for headings
		hr: chalk.gray,
		listitem: chalk.white, // White for list items
		paragraph: chalk.white, // White for paragraphs (default text color)
		strong: chalk.white.bold, // White bold for strong text
		em: chalk.white.italic, // White italic for emphasis
		codespan: chalk.cyan, // Cyan for inline code (no background)
		del: chalk.dim.strikethrough,
		link: chalk.blue,
		href: chalk.blue.underline,
		// Add more explicit code block handling
		showSectionPrefix: false,
		unescape: true,
		emoji: false,
		// Try to preserve whitespace in code blocks
		tab: 4,
		width: 120
	}) as MarkedExtension
);

// Also set marked options to preserve whitespace
marked.setOptions({
	breaks: true,
	gfm: true
});

/**
 * Convert HTML content to Markdown, then render for terminal
 * Handles tiptap HTML from Hamster gracefully
 */
export function renderContent(content: string): string {
	if (!content) return '';

	// Clean up escape characters first - order matters: handle escaped backslashes first
	let cleaned = content
		.replace(/\\\\/g, '\\')
		.replace(/\\n/g, '\n')
		.replace(/\\t/g, '\t')
		.replace(/\\"/g, '"');

	// Check if content has HTML tags - if so, convert to markdown first
	if (/<[^>]+>/.test(cleaned)) {
		cleaned = turndownService.turndown(cleaned);
	}

	// Render markdown to terminal
	const result = marked(cleaned);
	return typeof result === 'string' ? result.trim() : cleaned;
}
