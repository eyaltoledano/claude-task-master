/**
 * @fileoverview Path construction utilities for Task Master
 * Provides standardized paths for Task Master project structure
 */

import { join, resolve } from 'node:path';
import { TASKMASTER_TASKS_FILE } from '../constants/paths.js';
import { findProjectRoot } from './project-root-finder.js';

/**
 * Get standard Task Master project paths
 * Automatically detects project root using smart detection
 *
 * @param projectPath - Optional explicit project path (if not provided, auto-detects)
 * @returns Object with projectRoot and tasksPath
 *
 * @example
 * ```typescript
 * // Auto-detect project root
 * const { projectRoot, tasksPath } = getProjectPaths();
 *
 * // Or specify explicit path
 * const { projectRoot, tasksPath } = getProjectPaths('./my-project');
 * // projectRoot: '/absolute/path/to/my-project'
 * // tasksPath: '/absolute/path/to/my-project/.taskmaster/tasks/tasks.json'
 * ```
 */
export function getProjectPaths(projectPath?: string): {
	projectRoot: string;
	tasksPath: string;
} {
	const projectRoot = projectPath
		? resolve(process.cwd(), projectPath)
		: findProjectRoot();

	return {
		projectRoot,
		tasksPath: join(projectRoot, TASKMASTER_TASKS_FILE)
	};
}
