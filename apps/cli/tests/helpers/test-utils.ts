/**
 * @fileoverview Shared test utilities for integration tests
 */

import path from 'node:path';

/**
 * Get the absolute path to the compiled CLI binary
 *
 * IMPORTANT: This resolves to the root dist/ directory, not apps/cli/dist/
 * The CLI is built to <repo-root>/dist/task-master.js
 *
 * @returns Absolute path to task-master.js binary
 */
export function getCliBinPath(): string {
	// From apps/cli/tests/helpers/ navigate to repo root
	const repoRoot = path.resolve(__dirname, '../../../..');
	return path.join(repoRoot, 'dist', 'task-master.js');
}
