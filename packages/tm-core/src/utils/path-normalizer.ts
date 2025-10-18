/**
 * Path normalization utilities for global storage system.
 * Converts project paths to storage-safe directory names using base64url encoding.
 *
 * This provides a bijective (one-to-one) mapping that preserves all characters
 * and supports perfect round-trip conversion between paths and storage names.
 *
 * @module path-normalizer
 */

/**
 * Normalizes a project path to a storage-safe directory name using base64url encoding.
 * This encoding is filesystem-safe (no slashes, backslashes, or special characters)
 * and fully reversible, preserving hyphens and all other characters in paths.
 *
 * @param {string} projectPath - The project path to normalize
 * @returns {string} The base64url-encoded path safe for use as a directory name
 *
 * @example
 * normalizeProjectPath('/Users/test/project') // returns base64url encoded string
 * normalizeProjectPath('C:\\Users\\test') // returns base64url encoded string
 * normalizeProjectPath('/projects/my-app') // returns base64url encoded string (hyphens preserved)
 */
export function normalizeProjectPath(projectPath: string): string {
	if (!projectPath) {
		return '';
	}

	// Use base64url encoding: filesystem-safe and fully reversible
	return Buffer.from(projectPath, 'utf-8').toString('base64url');
}

/**
 * Denormalizes a storage directory name back to the original path.
 * Decodes base64url-encoded paths with perfect fidelity.
 *
 * @param {string} normalizedPath - The base64url-encoded path to decode
 * @returns {string} The original path with all characters preserved
 *
 * @example
 * denormalizeProjectPath(normalizeProjectPath('/Users/test/project')) // returns '/Users/test/project'
 * denormalizeProjectPath(normalizeProjectPath('/projects/my-app')) // returns '/projects/my-app'
 */
export function denormalizeProjectPath(normalizedPath: string): string {
	if (!normalizedPath) {
		return '';
	}

	// Validate that input is valid base64url before attempting to decode
	if (!isValidNormalizedPath(normalizedPath)) {
		// Return original string for backward compatibility with non-base64url inputs
		return normalizedPath;
	}

	return Buffer.from(normalizedPath, 'base64url').toString('utf-8');
}

/**
 * Validates whether a path is in normalized (base64url) format.
 * Valid base64url strings contain only: A-Z, a-z, 0-9, -, _
 *
 * @param {string} path - The path to validate
 * @returns {boolean} True if the path is in normalized base64url format
 *
 * @example
 * isValidNormalizedPath('VXNlcnMvdGVzdC9wcm9qZWN0') // returns true (valid base64url)
 * isValidNormalizedPath('Users/test/project') // returns false (contains slashes)
 */
export function isValidNormalizedPath(path: string): boolean {
	if (path === '') {
		return true;
	}

	// Check if path is valid base64url: only A-Z, a-z, 0-9, -, _
	return /^[A-Za-z0-9_-]*$/.test(path);
}
