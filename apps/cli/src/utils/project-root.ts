/**
 * @fileoverview Project root utilities for CLI
 * Provides smart project root detection for command execution
 */

import { resolve } from 'node:path';
import { findProjectRoot as findProjectRootCore } from '@tm/core';

/**
 * Get the project root directory with fallback to provided path
 *
 * This function intelligently detects the project root by looking for markers like:
 * - .taskmaster directory (highest priority)
 * - .git directory
 * - package.json
 * - Other project markers
 *
 * If a projectPath is explicitly provided, it will be resolved to an absolute path.
 * Otherwise, it will attempt to find the project root starting from current directory.
 *
 * @param projectPath - Optional explicit project path from user
 * @returns The project root directory path (always absolute)
 *
 * @example
 * ```typescript
 * // Auto-detect project root
 * const root = getProjectRoot();
 *
 * // Use explicit path if provided (resolved to absolute path)
 * const root = getProjectRoot('./my-project'); // Resolves relative paths
 * const root = getProjectRoot('/explicit/path'); // Already absolute, returned as-is
 * ```
 */
export function getProjectRoot(projectPath?: string): string {
	// If explicitly provided, resolve it to an absolute path
	// This handles relative paths and ensures Windows paths are normalized
	if (projectPath) {
		return resolve(projectPath);
	}

	// Otherwise, intelligently find the project root
	return findProjectRootCore();
}
