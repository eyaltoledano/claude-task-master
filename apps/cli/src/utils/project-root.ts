/**
 * @fileoverview Project root utilities for CLI
 * Provides smart project root detection for command execution
 */

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
 * If a projectPath is explicitly provided, it will be used as-is.
 * Otherwise, it will attempt to find the project root starting from current directory.
 *
 * @param projectPath - Optional explicit project path from user
 * @returns The project root directory path
 *
 * @example
 * ```typescript
 * // Auto-detect project root
 * const root = getProjectRoot();
 *
 * // Use explicit path if provided
 * const root = getProjectRoot('/explicit/path');
 * ```
 */
export function getProjectRoot(projectPath?: string): string {
	// If explicitly provided, use it
	if (projectPath) {
		return projectPath;
	}

	// Otherwise, intelligently find the project root
	return findProjectRootCore();
}
