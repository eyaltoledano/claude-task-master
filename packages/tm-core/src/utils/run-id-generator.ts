/**
 * Run ID generation and validation utilities for the global storage system.
 * Uses ISO 8601 timestamps with millisecond precision for unique, chronologically-ordered run IDs.
 *
 * @module run-id-generator
 */

// Collision detection state
let lastTimestamp = 0;
let counter = 0;

/**
 * Generates a unique run ID using ISO 8601 timestamp format with millisecond precision.
 * The ID is guaranteed to be chronologically sortable and URL-safe.
 * Includes collision detection to ensure uniqueness even when called in rapid succession.
 *
 * @param {Date} [date=new Date()] - Optional date to use for the run ID. Defaults to current time.
 * @returns {string} ISO 8601 formatted timestamp (e.g., '2024-01-15T10:30:45.123Z')
 *
 * @example
 * generateRunId() // returns '2024-01-15T10:30:45.123Z'
 * generateRunId(new Date('2024-01-15T10:00:00.000Z')) // returns '2024-01-15T10:00:00.000Z'
 */
export function generateRunId(date: Date = new Date()): string {
	const timestamp = date.getTime();

	// Collision detection: if same millisecond, wait for next millisecond
	if (timestamp === lastTimestamp) {
		counter++;
		// Wait for next millisecond to ensure uniqueness
		let newTimestamp = timestamp;
		while (newTimestamp === timestamp) {
			newTimestamp = Date.now();
		}
		date = new Date(newTimestamp);
		lastTimestamp = newTimestamp;
		counter = 0;
	} else {
		lastTimestamp = timestamp;
		counter = 0;
	}

	return date.toISOString();
}

/**
 * Validates whether a string is a valid run ID.
 * A valid run ID must be:
 * - In ISO 8601 format with milliseconds
 * - In UTC timezone (ends with 'Z')
 * - A valid date when parsed
 *
 * @param {any} runId - The value to validate
 * @returns {boolean} True if the value is a valid run ID
 *
 * @example
 * isValidRunId('2024-01-15T10:30:45.123Z') // returns true
 * isValidRunId('invalid') // returns false
 * isValidRunId('2024-01-15T10:30:45Z') // returns false (missing milliseconds)
 */
export function isValidRunId(runId: any): boolean {
	if (!runId || typeof runId !== 'string') {
		return false;
	}

	// Check format: YYYY-MM-DDTHH:mm:ss.sssZ
	const isoFormatRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
	if (!isoFormatRegex.test(runId)) {
		return false;
	}

	// Validate it's a real date
	const date = new Date(runId);
	if (isNaN(date.getTime())) {
		return false;
	}

	// Ensure the parsed date matches the input (catches invalid dates like 2024-13-01)
	return date.toISOString() === runId;
}

/**
 * Parses a run ID string into a Date object.
 *
 * @param {any} runId - The run ID to parse
 * @returns {Date | null} Date object if valid, null if invalid
 *
 * @example
 * parseRunId('2024-01-15T10:30:45.123Z') // returns Date object
 * parseRunId('invalid') // returns null
 */
export function parseRunId(runId: any): Date | null {
	if (!isValidRunId(runId)) {
		return null;
	}

	return new Date(runId);
}

/**
 * Compares two run IDs chronologically.
 * Returns a negative number if id1 is earlier, positive if id1 is later, or 0 if equal.
 * Can be used as a comparator function for Array.sort().
 *
 * @param {string} id1 - First run ID to compare
 * @param {string} id2 - Second run ID to compare
 * @returns {number} Negative if id1 < id2, positive if id1 > id2, zero if equal
 * @throws {Error} If either run ID is invalid
 *
 * @example
 * compareRunIds('2024-01-15T10:00:00.000Z', '2024-01-15T11:00:00.000Z') // returns negative number
 * ['2024-01-15T14:00:00.000Z', '2024-01-15T10:00:00.000Z'].sort(compareRunIds)
 * // returns ['2024-01-15T10:00:00.000Z', '2024-01-15T14:00:00.000Z']
 */
export function compareRunIds(id1: string, id2: string): number {
	if (!isValidRunId(id1)) {
		throw new Error(`Invalid run ID: ${id1}`);
	}

	if (!isValidRunId(id2)) {
		throw new Error(`Invalid run ID: ${id2}`);
	}

	// String comparison works for ISO 8601 timestamps
	// because they are lexicographically sortable
	if (id1 < id2) return -1;
	if (id1 > id2) return 1;
	return 0;
}
