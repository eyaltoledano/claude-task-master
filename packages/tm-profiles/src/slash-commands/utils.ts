/**
 * @fileoverview Utility functions for slash commands module
 */

import path from 'path';

/**
 * Resolve project root from a target directory by navigating up
 * based on a known relative path structure.
 *
 * This is useful when lifecycle hooks receive a nested directory
 * (like `.roo/rules`) and need to get back to the project root
 * to place commands in the correct location.
 *
 * @param targetDir - The target directory (usually rulesDir)
 * @param relativePath - The relative path from project root (e.g., ".roo/rules")
 * @returns The project root directory
 *
 * @example
 * ```typescript
 * // If targetDir is "/project/.roo/rules" and relativePath is ".roo/rules"
 * const projectRoot = resolveProjectRoot("/project/.roo/rules", ".roo/rules");
 * // Returns: "/project"
 *
 * // If relativePath is "." then targetDir is already project root
 * const projectRoot = resolveProjectRoot("/project", ".");
 * // Returns: "/project"
 * ```
 */
export function resolveProjectRoot(
	targetDir: string,
	relativePath: string
): string {
	// If relativePath is just "." then targetDir is already the project root
	if (relativePath === '.') {
		return targetDir;
	}

	// Count how many directory levels we need to go up
	const levels = relativePath.split(path.sep).filter(Boolean).length;
	let projectRoot = targetDir;
	for (let i = 0; i < levels; i++) {
		projectRoot = path.dirname(projectRoot);
	}
	return projectRoot;
}
