/**
 * State.json management for mutable workflow checkpoints.
 * Handles creation, reading, updating, and deletion of state files
 * that track current workflow state and progress.
 *
 * Unlike manifest.json (immutable run metadata) and activity.jsonl (append-only logs),
 * state.json is designed to be frequently updated as workflow progresses.
 *
 * @module state-manager
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * State structure for tracking mutable workflow checkpoints
 */
export interface State {
	data: Record<string, any>;
	lastUpdated: string;
}

/**
 * Creates a new state file with initial data.
 * Uses atomic write operations to prevent corruption.
 *
 * @param {string} statePath - Path where state file should be created
 * @param {Record<string, any>} initialData - Initial state data
 * @returns {Promise<State>} The created state object
 * @throws {Error} If state file already exists
 *
 * @example
 * const state = await createState('/path/to/state.json', {
 *   currentPhase: 'red',
 *   testsPassing: false,
 *   attemptCount: 1
 * });
 */
export async function createState(
	statePath: string,
	initialData: Record<string, any>
): Promise<State> {
	// Check if state already exists
	if (await fs.pathExists(statePath)) {
		throw new Error('State file already exists');
	}

	// Create state object
	const state: State = {
		data: initialData,
		lastUpdated: new Date().toISOString()
	};

	// Ensure directory exists
	await fs.ensureDir(path.dirname(statePath));

	// Write atomically using tmp file + rename
	const tmpPath = `${statePath}.tmp`;
	await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
	await fs.rename(tmpPath, statePath);

	return state;
}

/**
 * Reads and parses a state file.
 * Validates the state structure.
 *
 * @param {string} statePath - Path to the state file
 * @returns {Promise<State>} The parsed state object
 * @throws {Error} If file doesn't exist, can't be parsed, or is invalid
 *
 * @example
 * const state = await readState('/path/to/state.json');
 * console.log(state.data.currentPhase);
 */
export async function readState(statePath: string): Promise<State> {
	// Read file
	const content = await fs.readFile(statePath, 'utf-8');

	// Parse JSON
	let state: State;
	try {
		state = JSON.parse(content);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to parse state JSON: ${errorMessage}`);
	}

	// Validate structure
	validateState(state);

	return state;
}

/**
 * Updates an existing state file with new data.
 * Uses atomic write operations and deep merges nested objects.
 * Updates the lastUpdated timestamp automatically.
 *
 * @param {string} statePath - Path to the state file
 * @param {Record<string, any>} updates - Data fields to update
 * @returns {Promise<State>} The updated state object
 * @throws {Error} If state doesn't exist or update fails
 *
 * @example
 * const updated = await updateState('/path/to/state.json', {
 *   testsPassing: true,
 *   attemptCount: 2
 * });
 */
export async function updateState(
	statePath: string,
	updates: Record<string, any>
): Promise<State> {
	// Read current state
	const current = await readState(statePath);

	// Deep merge updates with current data
	const updatedData = deepMerge(current.data, updates);

	// Create updated state with new timestamp
	const updated: State = {
		data: updatedData,
		lastUpdated: new Date().toISOString()
	};

	// Write atomically using tmp file + rename
	const tmpPath = `${statePath}.tmp`;
	await fs.writeFile(tmpPath, JSON.stringify(updated, null, 2), 'utf-8');
	await fs.rename(tmpPath, statePath);

	return updated;
}

/**
 * Deletes a state file.
 * Does not throw if file doesn't exist (idempotent).
 *
 * @param {string} statePath - Path to the state file
 * @returns {Promise<void>}
 *
 * @example
 * await deleteState('/path/to/state.json');
 */
export async function deleteState(statePath: string): Promise<void> {
	// Remove file if it exists (idempotent)
	await fs.remove(statePath);
}

/**
 * Validates a state object against the expected schema.
 *
 * @param {any} state - Object to validate
 * @throws {Error} If state is invalid
 *
 * @example
 * validateState(stateData); // throws if invalid
 */
export function validateState(state: any): void {
	// Check required fields exist
	if (state.data === undefined) {
		throw new Error('Invalid state: missing data field');
	}

	if (!state.lastUpdated) {
		throw new Error('Invalid state: missing lastUpdated field');
	}

	// Validate data is an object
	if (typeof state.data !== 'object' || state.data === null) {
		throw new Error('Invalid state: data must be an object');
	}

	// Validate lastUpdated is a valid ISO 8601 timestamp
	const timestamp = new Date(state.lastUpdated);
	if (isNaN(timestamp.getTime())) {
		throw new Error(
			'Invalid state: lastUpdated must be a valid ISO 8601 timestamp'
		);
	}
}

/**
 * Deep merge helper for merging nested objects.
 * Arrays are replaced, not merged.
 *
 * @param {any} target - Target object
 * @param {any} source - Source object
 * @returns {any} Merged object
 */
function deepMerge(target: any, source: any): any {
	// Handle non-object cases
	if (typeof source !== 'object' || source === null) {
		return source;
	}

	if (typeof target !== 'object' || target === null) {
		return source;
	}

	// Handle arrays (replace, don't merge)
	if (Array.isArray(source)) {
		return source;
	}

	// Deep merge objects
	const result: any = { ...target };

	for (const key of Object.keys(source)) {
		if (
			typeof source[key] === 'object' &&
			source[key] !== null &&
			!Array.isArray(source[key])
		) {
			// Recursively merge nested objects
			result[key] = deepMerge(result[key], source[key]);
		} else {
			// Replace primitives and arrays
			result[key] = source[key];
		}
	}

	return result;
}
