/**
 * @fileoverview Pager utility for wide CLI output.
 * Pipes content through `less -RSF` so users can scroll horizontally
 * and press q to exit, similar to git's pager behavior.
 */

import { spawnSync } from 'node:child_process';

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

/**
 * Strip ANSI escape codes and return the visible character length.
 * @param str - A string that may contain ANSI escape sequences
 * @returns The number of visible characters after stripping ANSI codes
 */
function visibleLength(str: string): number {
	return str.replace(ANSI_REGEX, '').length;
}

/**
 * Output content through a pager when any line exceeds terminal width.
 * Falls back to plain console.log when:
 * - stdout is not a TTY (piped/redirected)
 * - all lines fit within terminal width
 * - `less` is not available
 *
 * @param content - The string to display (may contain ANSI color codes)
 */
export function pageOutput(content: string): void {
	if (!process.stdout.isTTY) {
		process.stdout.write(content + '\n');
		return;
	}

	const termWidth = process.stdout.columns || 80;
	const needsPager = content
		.split('\n')
		.some((line) => visibleLength(line) > termWidth);

	if (!needsPager) {
		console.log(content);
		return;
	}

	// -R: interpret ANSI colors
	// -S: don't wrap lines (enable horizontal scroll)
	// -F: quit immediately if content fits on one screen
	const result = spawnSync('less', ['-RSF'], {
		input: content + '\n',
		stdio: ['pipe', 'inherit', 'inherit']
	});

	// If less failed or isn't available, print directly
	if (result.error || (result.status !== 0 && result.status !== null)) {
		process.stdout.write(content + '\n');
	}
}
