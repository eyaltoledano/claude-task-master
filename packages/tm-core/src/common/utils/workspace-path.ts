/**
 * @fileoverview Workspace-scoped path utilities
 *
 * Generates per-project directories under ~/.taskmaster/{projectId}/
 * to isolate workspace state (brief context, workflow sessions, etc.)
 * while keeping auth tokens global.
 *
 * Pattern matches Claude Code's ~/.claude/projects/<path-hash>/ approach.
 */

import os from 'node:os';
import path from 'node:path';

/**
 * Generate a unique, filesystem-safe identifier for a project path.
 *
 * Converts an absolute path into a sanitized string suitable for use
 * as a directory name. Uses Claude Code's convention: leading dash +
 * path segments joined by dashes.
 *
 * @example
 * getProjectIdentifier('/Volumes/Workspace/my-app')
 * // → '-Volumes-Workspace-my-app'
 */
export function getProjectIdentifier(projectRoot: string): string {
	const absolutePath = path.resolve(projectRoot);

	return (
		'-' +
		absolutePath
			.replace(/^\//, '')
			.replace(/[^a-zA-Z0-9]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/-+$/, '')
	);
}

/**
 * Get the workspace-specific directory under ~/.taskmaster/
 *
 * @example
 * getWorkspaceDir('/Volumes/Workspace/my-app')
 * // → '/Users/me/.taskmaster/-Volumes-Workspace-my-app'
 */
export function getWorkspaceDir(projectRoot: string): string {
	const projectId = getProjectIdentifier(projectRoot);
	return path.join(os.homedir(), '.taskmaster', projectId);
}

/**
 * Get the workspace-scoped context file path.
 * Context (brief/org selection) is per-workspace, not global.
 *
 * @example
 * getWorkspaceContextPath('/Volumes/Workspace/my-app')
 * // → '/Users/me/.taskmaster/-Volumes-Workspace-my-app/context.json'
 */
export function getWorkspaceContextPath(projectRoot: string): string {
	return path.join(getWorkspaceDir(projectRoot), 'context.json');
}
