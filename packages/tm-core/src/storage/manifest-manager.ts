/**
 * Manifest.json management for workflow runs.
 * Handles creation, reading, updating, and validation of manifest files
 * that track run metadata, configuration, and workflow state.
 *
 * @module manifest-manager
 */

import fs from 'fs-extra';
import path from 'path';
import { generateRunId, isValidRunId } from '../utils/run-id-generator.js';

/**
 * Manifest structure for tracking workflow run metadata
 */
export interface Manifest {
	version: string;
	runId: string;
	metadata: ManifestMetadata;
	timestamps: ManifestTimestamps;
	phase: WorkflowPhase;
	config: Record<string, any>;
}

/**
 * Metadata tracked in the manifest
 */
export interface ManifestMetadata {
	taskId?: string;
	tag?: string;
	branch?: string;
	projectRoot?: string;
	[key: string]: any;
}

/**
 * Timestamp tracking for workflow run
 */
export interface ManifestTimestamps {
	startTime: string;
	endTime: string | null;
}

/**
 * Workflow phases
 */
export type WorkflowPhase =
	| 'preflight'
	| 'branch-setup'
	| 'red'
	| 'green'
	| 'commit'
	| 'finalize'
	| 'complete';

/**
 * Creates a new manifest file with initial metadata.
 * Uses atomic write operations to prevent corruption.
 *
 * @param {string} manifestPath - Path where manifest file should be created
 * @param {ManifestMetadata} metadata - Initial metadata for the run
 * @param {string} [runId] - Optional run ID (generates one if not provided)
 * @returns {Promise<Manifest>} The created manifest object
 * @throws {Error} If manifest file already exists
 *
 * @example
 * const manifest = await createManifest('/path/to/manifest.json', {
 *   taskId: '1.1',
 *   tag: 'feature-branch',
 *   branch: 'feature/test'
 * });
 */
export async function createManifest(
	manifestPath: string,
	metadata: ManifestMetadata,
	runId?: string
): Promise<Manifest> {
	// Check if manifest already exists
	if (await fs.pathExists(manifestPath)) {
		throw new Error('Manifest already exists');
	}

	// Create manifest object
	const manifest: Manifest = {
		version: '1.0.0',
		runId: runId || generateRunId(),
		metadata,
		timestamps: {
			startTime: new Date().toISOString(),
			endTime: null
		},
		phase: 'preflight',
		config: {}
	};

	// Ensure directory exists
	await fs.ensureDir(path.dirname(manifestPath));

	// Write atomically using tmp file + rename
	const tmpPath = `${manifestPath}.tmp`;
	await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2), 'utf-8');
	await fs.rename(tmpPath, manifestPath);

	return manifest;
}

/**
 * Reads and parses a manifest file.
 * Validates the manifest structure.
 *
 * @param {string} manifestPath - Path to the manifest file
 * @returns {Promise<Manifest>} The parsed manifest object
 * @throws {Error} If file doesn't exist, can't be parsed, or is invalid
 *
 * @example
 * const manifest = await readManifest('/path/to/manifest.json');
 * console.log(manifest.runId);
 */
export async function readManifest(manifestPath: string): Promise<Manifest> {
	// Read file
	const content = await fs.readFile(manifestPath, 'utf-8');

	// Parse JSON
	let manifest: Manifest;
	try {
		manifest = JSON.parse(content);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to parse manifest JSON: ${errorMessage}`);
	}

	// Validate structure
	validateManifest(manifest);

	return manifest;
}

/**
 * Updates an existing manifest file with new data.
 * Uses atomic write operations and deep merges nested objects.
 *
 * @param {string} manifestPath - Path to the manifest file
 * @param {Partial<Manifest>} updates - Fields to update
 * @returns {Promise<Manifest>} The updated manifest object
 * @throws {Error} If manifest doesn't exist or update fails
 *
 * @example
 * const updated = await updateManifest('/path/to/manifest.json', {
 *   phase: 'red',
 *   metadata: { status: 'in-progress' }
 * });
 */
export async function updateManifest(
	manifestPath: string,
	updates: Partial<Manifest>
): Promise<Manifest> {
	// Read current manifest
	const current = await readManifest(manifestPath);

	// Deep merge updates
	const updated: Manifest = {
		...current,
		...updates,
		metadata: {
			...current.metadata,
			...(updates.metadata || {})
		},
		timestamps: {
			...current.timestamps,
			...(updates.timestamps || {})
		},
		config: {
			...current.config,
			...(updates.config || {})
		}
	};

	// Write atomically using tmp file + rename
	const tmpPath = `${manifestPath}.tmp`;
	await fs.writeFile(tmpPath, JSON.stringify(updated, null, 2), 'utf-8');
	await fs.rename(tmpPath, manifestPath);

	return updated;
}

/**
 * Validates a manifest object against the expected schema.
 *
 * @param {any} manifest - Object to validate
 * @throws {Error} If manifest is invalid
 *
 * @example
 * validateManifest(manifestData); // throws if invalid
 */
export function validateManifest(manifest: any): void {
	// Check required fields exist
	if (!manifest.version) {
		throw new Error('Invalid manifest: missing version field');
	}

	if (!manifest.runId) {
		throw new Error('Invalid manifest: missing runId field');
	}

	if (!manifest.metadata) {
		throw new Error('Invalid manifest: missing metadata field');
	}

	if (!manifest.timestamps) {
		throw new Error('Invalid manifest: missing timestamps field');
	}

	if (!manifest.phase) {
		throw new Error('Invalid manifest: missing phase field');
	}

	// Validate version format (semver)
	if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
		throw new Error(
			'Invalid manifest: version must be in semver format (e.g., 1.0.0)'
		);
	}

	// Validate runId format
	if (!isValidRunId(manifest.runId)) {
		throw new Error(
			'Invalid manifest: runId must be a valid ISO 8601 timestamp'
		);
	}

	// Validate metadata is an object
	if (typeof manifest.metadata !== 'object' || manifest.metadata === null) {
		throw new Error('Invalid manifest: metadata must be an object');
	}

	// Validate timestamps structure
	if (typeof manifest.timestamps !== 'object' || manifest.timestamps === null) {
		throw new Error('Invalid manifest: timestamps must be an object');
	}

	if (!manifest.timestamps.startTime) {
		throw new Error('Invalid manifest: timestamps.startTime is required');
	}

	// Validate phase is a string
	if (typeof manifest.phase !== 'string') {
		throw new Error('Invalid manifest: phase must be a string');
	}
}
