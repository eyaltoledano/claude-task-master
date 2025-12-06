/**
 * Shared string utility functions
 */

/**
 * Escape special regex characters in a string
 * Used for safely building regex patterns from user input
 *
 * @param str - String to escape
 * @returns String with regex special characters escaped
 */
export function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

