// src/utils/format.js

/**
 * Formats elapsed time as 0m 00s.
 * @param {number} seconds - Elapsed time in seconds
 * @returns {string} Formatted time string
 */
export function formatElapsedTime(seconds) {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
}
