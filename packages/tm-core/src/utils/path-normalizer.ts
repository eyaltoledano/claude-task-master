/**
 * Path normalization utilities for global storage system.
 * Converts project paths to storage-safe directory names.
 *
 * IMPORTANT: This is a ONE-WAY normalization for storage purposes only.
 * It creates filesystem-safe directory names from project paths.
 * Round-trip conversion is NOT supported because directory names may contain
 * legitimate hyphens that would be indistinguishable from path separators.
 *
 * @module path-normalizer
 */

/**
 * Normalizes a project path to a storage-safe directory name.
 * - Replaces all slashes (forward and backward) with hyphens
 * - Removes leading slashes
 * - Handles multiple consecutive slashes
 * - Preserves other special characters in path names
 *
 * @param {string} projectPath - The project path to normalize
 * @returns {string} The normalized path safe for use as a directory name
 *
 * @example
 * normalizeProjectPath('/Users/test/project') // returns 'Users-test-project'
 * normalizeProjectPath('C:\\Users\\test') // returns 'C-Users-test'
 * normalizeProjectPath('/root//project') // returns 'root-project'
 * normalizeProjectPath('/projects/my-app') // returns 'projects-my-app'
 */
export function normalizeProjectPath(projectPath: string): string {
	if (!projectPath) {
		return '';
	}

	return projectPath
		// Replace Windows drive letter colons (e.g., 'C:' -> 'C')
		.replace(/^([A-Za-z]):/, '$1')
		// Replace all forward slashes and backslashes with hyphens
		.replace(/[/\\]+/g, '-')
		// Remove leading hyphens (from leading slashes)
		.replace(/^-+/, '');
}

/**
 * Denormalizes a storage directory name back to a path structure.
 * Converts hyphens back to forward slashes.
 *
 * WARNING: This function is provided for completeness but has limitations.
 * It cannot distinguish between hyphens that were path separators and
 * hyphens that are part of directory names (e.g., 'my-app').
 * Use with caution and prefer storing the original path separately if needed.
 *
 * @param {string} normalizedPath - The normalized path to convert back
 * @returns {string} The denormalized path with forward slashes
 *
 * @example
 * denormalizeProjectPath('Users-test-project') // returns 'Users/test/project'
 * // Note: 'projects-my-app' becomes 'projects/my/app' - hyphens cannot be preserved
 */
export function denormalizeProjectPath(normalizedPath: string): string {
	if (!normalizedPath) {
		return '';
	}

	return normalizedPath.replace(/-/g, '/');
}

/**
 * Validates whether a path is in normalized format.
 * A valid normalized path should not contain any slashes.
 *
 * @param {string} path - The path to validate
 * @returns {boolean} True if the path is in normalized format
 *
 * @example
 * isValidNormalizedPath('Users-test-project') // returns true
 * isValidNormalizedPath('Users/test/project') // returns false
 */
export function isValidNormalizedPath(path: string): boolean {
	if (path === '') {
		return true;
	}

	// Check if path contains any slashes
	return !path.includes('/') && !path.includes('\\');
}
