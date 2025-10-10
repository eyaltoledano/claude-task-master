/**
 * Directory structure management for TDD Autopilot workflow runs.
 * Handles creation, validation, and cleanup of run directories.
 *
 * Directory structure:
 * .tdd-autopilot/
 *   └── {normalized-project-path}/
 *       └── {run-id}/
 *           ├── manifest.json
 *           ├── activity.jsonl
 *           ├── state.json
 *           └── snapshots/
 *
 * @module directory-manager
 */

import fs from 'fs-extra';
import path from 'path';
import { normalizeProjectPath } from '../utils/path-normalizer.js';
import { createManifest } from './manifest-manager.js';
import { createState } from './state-manager.js';

/**
 * Creates a complete run directory structure with all required files.
 *
 * @param {string} storageRoot - Root storage directory (e.g., .tdd-autopilot)
 * @param {string} runId - ISO 8601 timestamp run ID
 * @param {string} projectPath - Absolute path to the project
 * @returns {Promise<string>} Absolute path to the created run directory
 * @throws {Error} If directory already exists
 *
 * @example
 * const runDir = await createRunDirectory(
 *   '/path/to/.tdd-autopilot',
 *   '2024-01-15T10:30:45.123Z',
 *   '/Users/test/projects/myapp'
 * );
 * // Returns: /path/to/.tdd-autopilot/Users-test-projects-myapp/2024-01-15T10:30:45.123Z
 */
export async function createRunDirectory(
	storageRoot: string,
	runId: string,
	projectPath: string
): Promise<string> {
	// Generate run directory path
	const runDir = getRunDirectoryPath(storageRoot, runId, projectPath);

	// Check if directory already exists
	if (await fs.pathExists(runDir)) {
		throw new Error('Run directory already exists');
	}

	// Create directory structure
	await fs.ensureDir(runDir);
	await fs.ensureDir(path.join(runDir, 'snapshots'));

	// Create manifest.json with the provided runId
	const manifestPath = path.join(runDir, 'manifest.json');
	await createManifest(manifestPath, {
		projectRoot: projectPath
	}, runId);

	// Create empty activity.jsonl
	const activityPath = path.join(runDir, 'activity.jsonl');
	await fs.writeFile(activityPath, '', 'utf-8');

	// Create state.json with empty data
	const statePath = path.join(runDir, 'state.json');
	await createState(statePath, {});

	return runDir;
}

/**
 * Removes a run directory and all its contents.
 * Idempotent - does not throw if directory doesn't exist.
 *
 * @param {string} runDir - Absolute path to the run directory
 * @returns {Promise<void>}
 *
 * @example
 * await cleanupRunDirectory('/path/to/.tdd-autopilot/project/run-id');
 */
export async function cleanupRunDirectory(runDir: string): Promise<void> {
	// Remove directory and all contents (idempotent)
	await fs.remove(runDir);
}

/**
 * Validates that a run directory has the expected structure.
 * Synchronous validation for immediate feedback.
 *
 * @param {string} runDir - Absolute path to the run directory
 * @throws {Error} If directory structure is invalid
 *
 * @example
 * validateRunDirectory('/path/to/.tdd-autopilot/project/run-id');
 * // Throws if manifest.json, activity.jsonl, state.json, or snapshots/ missing
 */
export function validateRunDirectory(runDir: string): void {
	// Check directory exists
	if (!fs.pathExistsSync(runDir)) {
		throw new Error(`Run directory does not exist: ${runDir}`);
	}

	// Check required files exist
	const manifestPath = path.join(runDir, 'manifest.json');
	if (!fs.pathExistsSync(manifestPath)) {
		throw new Error(`Missing manifest.json in run directory: ${runDir}`);
	}

	const activityPath = path.join(runDir, 'activity.jsonl');
	if (!fs.pathExistsSync(activityPath)) {
		throw new Error(`Missing activity.jsonl in run directory: ${runDir}`);
	}

	const statePath = path.join(runDir, 'state.json');
	if (!fs.pathExistsSync(statePath)) {
		throw new Error(`Missing state.json in run directory: ${runDir}`);
	}

	// Check snapshots directory exists
	const snapshotsDir = path.join(runDir, 'snapshots');
	if (!fs.pathExistsSync(snapshotsDir)) {
		throw new Error(`Missing snapshots directory in run directory: ${runDir}`);
	}
}

/**
 * Generates the path for a run directory without creating it.
 * Useful for determining where a run directory would be located.
 *
 * @param {string} storageRoot - Root storage directory
 * @param {string} runId - ISO 8601 timestamp run ID
 * @param {string} projectPath - Absolute path to the project
 * @returns {string} Absolute path where the run directory would be located
 *
 * @example
 * const runDir = getRunDirectoryPath(
 *   '/path/to/.tdd-autopilot',
 *   '2024-01-15T10:30:45.123Z',
 *   '/Users/test/projects/myapp'
 * );
 * // Returns: /path/to/.tdd-autopilot/Users-test-projects-myapp/2024-01-15T10:30:45.123Z
 */
export function getRunDirectoryPath(
	storageRoot: string,
	runId: string,
	projectPath: string
): string {
	// Normalize project path for directory name
	const normalizedPath = normalizeProjectPath(projectPath);

	// Build run directory path: storageRoot/normalizedPath/runId
	return path.join(storageRoot, normalizedPath, runId);
}
