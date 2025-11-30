/**
 * @fileoverview Project root detection utilities
 * Provides functionality to locate project roots by searching for marker files/directories
 */

import fs from 'node:fs';
import path from 'node:path';
import {
	OTHER_PROJECT_MARKERS,
	TASKMASTER_PROJECT_MARKERS
} from '../constants/paths.js';

/**
 * Find the project root directory by looking for project markers
 * Traverses upwards from startDir until a project marker is found or filesystem root is reached
 * Limited to 50 parent directory levels to prevent excessive traversal
 *
 * Strategy: First searches ALL parent directories for .taskmaster (highest priority).
 * If not found, then searches for other project markers starting from current directory.
 * This ensures .taskmaster in parent directories takes precedence over other markers in subdirectories.
 *
 * @param startDir - Directory to start searching from (defaults to process.cwd())
 * @returns Project root path (falls back to current directory if no markers found)
 *
 * @example
 * ```typescript
 * // In a monorepo structure:
 * // /project/.taskmaster
 * // /project/packages/my-package/.git
 * // When called from /project/packages/my-package:
 * const root = findProjectRoot(); // Returns /project (not /project/packages/my-package)
 * ```
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
	let currentDir = path.resolve(startDir);
	const rootDir = path.parse(currentDir).root;
	const maxDepth = 50; // Reasonable limit to prevent infinite loops
	let depth = 0;

	// FIRST PASS: Traverse ALL parent directories looking ONLY for Task Master markers
	// This ensures that a .taskmaster in a parent directory takes precedence over
	// other project markers (like .git, go.mod, etc.) in subdirectories
	let searchDir = currentDir;
	depth = 0;

	while (depth < maxDepth) {
		for (const marker of TASKMASTER_PROJECT_MARKERS) {
			const markerPath = path.join(searchDir, marker);
			try {
				if (fs.existsSync(markerPath)) {
					// Found a Task Master marker - this is our project root
					return searchDir;
				}
			} catch (error) {
				// Ignore permission errors and continue searching
				continue;
			}
		}

		// If we're at root, stop after checking it
		if (searchDir === rootDir) {
			break;
		}

		// Move up one directory level
		const parentDir = path.dirname(searchDir);

		// Safety check: if dirname returns the same path, we've hit the root
		if (parentDir === searchDir) {
			break;
		}

		searchDir = parentDir;
		depth++;
	}

	// SECOND PASS: No Task Master markers found in any parent directory
	// Now search for other project markers starting from the original directory
	currentDir = path.resolve(startDir);
	depth = 0;

	while (depth < maxDepth) {
		for (const marker of OTHER_PROJECT_MARKERS) {
			const markerPath = path.join(currentDir, marker);
			try {
				if (fs.existsSync(markerPath)) {
					// Found another project marker - return this as project root
					return currentDir;
				}
			} catch (error) {
				// Ignore permission errors and continue searching
				continue;
			}
		}

		// If we're at root, stop after checking it
		if (currentDir === rootDir) {
			break;
		}

		// Move up one directory level
		const parentDir = path.dirname(currentDir);

		// Safety check: if dirname returns the same path, we've hit the root
		if (parentDir === currentDir) {
			break;
		}

		currentDir = parentDir;
		depth++;
	}

	// Fallback to current working directory if no project root found
	// This ensures the function always returns a valid, existing path
	return process.cwd();
}

/**
 * Normalize project root to ensure it doesn't end with .taskmaster
 * This prevents double .taskmaster paths when using constants that include .taskmaster
 *
 * @param projectRoot - The project root path to normalize
 * @returns Normalized project root path
 *
 * @example
 * ```typescript
 * normalizeProjectRoot('/project/.taskmaster'); // Returns '/project'
 * normalizeProjectRoot('/project'); // Returns '/project'
 * normalizeProjectRoot('/project/.taskmaster/tasks'); // Returns '/project'
 * ```
 */
export function normalizeProjectRoot(
	projectRoot: string | null | undefined
): string {
	if (!projectRoot) return projectRoot || '';

	// Ensure it's a string
	const projectRootStr = String(projectRoot);

	// Split the path into segments
	const segments = projectRootStr.split(path.sep);

	// Find the index of .taskmaster segment
	const taskmasterIndex = segments.findIndex(
		(segment) => segment === '.taskmaster'
	);

	if (taskmasterIndex !== -1) {
		// If .taskmaster is found, return everything up to but not including .taskmaster
		const normalizedSegments = segments.slice(0, taskmasterIndex);
		return normalizedSegments.join(path.sep) || path.sep;
	}

	return projectRootStr;
}
