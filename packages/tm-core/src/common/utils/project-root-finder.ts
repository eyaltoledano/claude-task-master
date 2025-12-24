import fs from 'node:fs';
import path from 'node:path';
import {
	OTHER_PROJECT_MARKERS,
	PROJECT_BOUNDARY_MARKERS,
	TASKMASTER_PROJECT_MARKERS
} from '../constants/paths.js';

function markerExists(dir: string, marker: string): boolean {
	try {
		return fs.existsSync(path.join(dir, marker));
	} catch {
		return false;
	}
}

function hasAnyMarker(dir: string, markers: readonly string[]): boolean {
	return markers.some((marker) => markerExists(dir, marker));
}

/**
 * Find the project root by traversing upward from startDir looking for project markers.
 *
 * Search strategy prevents false matches from stray .taskmaster dirs (e.g., in home):
 * 1. If startDir has .taskmaster or a boundary marker (.git, package.json), return immediately
 * 2. Search parents for .taskmaster anchored by a boundary marker (or 1 level up without boundary)
 * 3. Fall back to searching for other project markers (pyproject.toml, Cargo.toml, etc.)
 * 4. If nothing found, return startDir (supports `tm init` in empty directories)
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
	let currentDir = path.resolve(startDir);
	const rootDir = path.parse(currentDir).root;
	const maxDepth = 50;
	let depth = 0;
	let projectBoundaryDir: string | null = null;

	// Check startDir first - if it has .taskmaster or a boundary marker, we're done
	if (hasAnyMarker(currentDir, TASKMASTER_PROJECT_MARKERS)) {
		return currentDir;
	}
	if (hasAnyMarker(currentDir, PROJECT_BOUNDARY_MARKERS)) {
		return currentDir;
	}

	// Search parent directories for .taskmaster
	let searchDir = path.dirname(currentDir);
	depth = 1;

	while (depth < maxDepth) {
		const hasTaskmaster = hasAnyMarker(searchDir, TASKMASTER_PROJECT_MARKERS);
		const hasBoundary = hasAnyMarker(searchDir, PROJECT_BOUNDARY_MARKERS);

		if (hasTaskmaster) {
			// Accept .taskmaster if anchored by boundary or only 1 level up
			if (hasBoundary || depth === 1) {
				return searchDir;
			}
			// Distant .taskmaster without boundary is likely stray (e.g., home dir) - skip it
		}

		if (hasBoundary && !hasTaskmaster) {
			// Hit project boundary without .taskmaster - stop searching upward
			projectBoundaryDir = searchDir;
			break;
		}

		if (searchDir === rootDir) break;

		const parentDir = path.dirname(searchDir);
		if (parentDir === searchDir) break;

		searchDir = parentDir;
		depth++;
	}

	// No .taskmaster found - search for other project markers
	currentDir = projectBoundaryDir || path.resolve(startDir);
	depth = 0;

	while (depth < maxDepth) {
		if (hasAnyMarker(currentDir, OTHER_PROJECT_MARKERS)) {
			return currentDir;
		}

		if (currentDir === rootDir) break;

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) break;

		currentDir = parentDir;
		depth++;
	}

	return path.resolve(startDir);
}

/**
 * Strip .taskmaster (and anything after it) from a path.
 * Prevents double .taskmaster paths when combining with constants that include .taskmaster.
 */
export function normalizeProjectRoot(
	projectRoot: string | null | undefined
): string {
	if (!projectRoot) return '';

	const segments = String(projectRoot).split(path.sep);
	const taskmasterIndex = segments.findIndex((s) => s === '.taskmaster');

	if (taskmasterIndex !== -1) {
		return segments.slice(0, taskmasterIndex).join(path.sep) || path.sep;
	}

	return String(projectRoot);
}
