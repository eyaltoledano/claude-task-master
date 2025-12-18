/**
 * @fileoverview Project root detection utilities
 * Provides functionality to locate project roots by searching for marker files/directories
 */

import fs from 'node:fs';
import path from 'node:path';
import {
	OTHER_PROJECT_MARKERS,
	PROJECT_BOUNDARY_MARKERS,
	TASKMASTER_PROJECT_MARKERS
} from '../constants/paths.js';

/**
 * Check if a marker file/directory exists at the given path
 */
function markerExists(dir: string, marker: string): boolean {
	try {
		return fs.existsSync(path.join(dir, marker));
	} catch {
		return false;
	}
}

/**
 * Check if any of the given markers exist in a directory
 */
function hasAnyMarker(dir: string, markers: readonly string[]): boolean {
	return markers.some((marker) => markerExists(dir, marker));
}

/**
 * Find the project root directory by looking for project markers
 * Traverses upwards from startDir until a project marker is found or filesystem root is reached
 * Limited to 50 parent directory levels to prevent excessive traversal
 *
 * Strategy:
 * 1. PASS 1: Search for .taskmaster markers, but STOP at project boundaries
 *    - If .taskmaster found, return that directory
 *    - If a project boundary (package.json, .git, lock files) is found WITHOUT .taskmaster,
 *      stop searching further up (prevents finding .taskmaster in home directory)
 * 2. PASS 2: If no .taskmaster found, search for other project markers
 *
 * This ensures:
 * - .taskmaster in a parent directory takes precedence (within project boundary)
 * - .taskmaster outside the project boundary (e.g., home dir) is NOT returned
 *
 * @param startDir - Directory to start searching from (defaults to process.cwd())
 * @returns Project root path (falls back to startDir if no markers found)
 *
 * @example
 * ```typescript
 * // In a monorepo structure:
 * // /project/.taskmaster
 * // /project/packages/my-package/.git
 * // When called from /project/packages/my-package:
 * const root = findProjectRoot(); // Returns /project (not /project/packages/my-package)
 *
 * // When .taskmaster is outside project boundary:
 * // /home/user/.taskmaster (should be ignored!)
 * // /home/user/code/myproject/package.json
 * // When called from /home/user/code/myproject:
 * const root = findProjectRoot(); // Returns /home/user/code/myproject (NOT /home/user)
 * ```
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
	let currentDir = path.resolve(startDir);
	const rootDir = path.parse(currentDir).root;
	const maxDepth = 50; // Reasonable limit to prevent infinite loops
	let depth = 0;

	// Track if we've seen a project boundary - we'll stop searching for .taskmaster beyond it
	let projectBoundaryDir: string | null = null;

	// FIRST PASS: Search for Task Master markers, but respect project boundaries
	// A project boundary is a directory containing .git, package.json, lock files, etc.
	// If we find a boundary without .taskmaster, we stop searching further up
	let searchDir = currentDir;
	depth = 0;

	while (depth < maxDepth) {
		// First, check for Task Master markers in this directory
		for (const marker of TASKMASTER_PROJECT_MARKERS) {
			if (markerExists(searchDir, marker)) {
				// Found a Task Master marker - this is our project root
				return searchDir;
			}
		}

		// Check if this directory is a project boundary
		// (has markers like .git, package.json, lock files, etc.)
		if (hasAnyMarker(searchDir, PROJECT_BOUNDARY_MARKERS)) {
			// This is a project boundary - record it and STOP looking for .taskmaster
			// beyond this point. The .taskmaster in home directory should NOT be found
			// when the user is inside a different project.
			projectBoundaryDir = searchDir;
			break; // Stop Pass 1 - don't look for .taskmaster beyond this boundary
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

	// SECOND PASS: No Task Master markers found within project boundary
	// Now search for other project markers starting from the original directory
	// If we found a project boundary in Pass 1, start from there (it will match immediately)
	currentDir = projectBoundaryDir || path.resolve(startDir);
	depth = 0;

	while (depth < maxDepth) {
		for (const marker of OTHER_PROJECT_MARKERS) {
			if (markerExists(currentDir, marker)) {
				// Found another project marker - return this as project root
				return currentDir;
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

	// Fallback to startDir if no project root found
	// This handles empty repos or directories with no recognized project markers
	// (e.g., a repo with just a .env file should still use that directory as root)
	return path.resolve(startDir);
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
