/**
 * Activity.jsonl append-only logging system for workflow tracking.
 * Uses newline-delimited JSON (JSONL) format for structured event logging.
 *
 * @module activity-logger
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Activity log entry structure
 */
export interface ActivityEvent {
	timestamp: string;
	type: string;
	[key: string]: any;
}

/**
 * Filter criteria for activity log queries
 */
export interface ActivityFilter {
	type?: string;
	timestampFrom?: string;
	timestampTo?: string;
	predicate?: (event: ActivityEvent) => boolean;
}

/**
 * Appends an activity event to the log file.
 * Uses atomic append operations to ensure data integrity.
 *
 * @param {string} activityPath - Path to the activity.jsonl file
 * @param {Omit<ActivityEvent, 'timestamp'>} event - Event data to log (timestamp added automatically)
 * @returns {Promise<void>}
 *
 * @example
 * await logActivity('/path/to/activity.jsonl', {
 *   type: 'phase-start',
 *   phase: 'red'
 * });
 */
export async function logActivity(
	activityPath: string,
	event: Omit<ActivityEvent, 'timestamp'>
): Promise<void> {
	// Add timestamp to event
	const logEntry = {
		...event,
		timestamp: new Date().toISOString()
	} as ActivityEvent;

	// Ensure directory exists
	await fs.ensureDir(path.dirname(activityPath));

	// Convert to JSONL format (single line with newline)
	const line = JSON.stringify(logEntry) + '\n';

	// Append to file atomically
	// Using 'a' flag ensures atomic append on most systems
	await fs.appendFile(activityPath, line, 'utf-8');
}

/**
 * Reads and parses all events from an activity log file.
 * Returns events in chronological order.
 *
 * @param {string} activityPath - Path to the activity.jsonl file
 * @returns {Promise<ActivityEvent[]>} Array of activity events
 * @throws {Error} If file contains invalid JSON
 *
 * @example
 * const events = await readActivityLog('/path/to/activity.jsonl');
 * console.log(`Found ${events.length} events`);
 */
export async function readActivityLog(
	activityPath: string
): Promise<ActivityEvent[]> {
	// Return empty array if file doesn't exist
	if (!(await fs.pathExists(activityPath))) {
		return [];
	}

	// Read file content
	const content = await fs.readFile(activityPath, 'utf-8');

	// Parse JSONL (newline-delimited JSON)
	const lines = content.trim().split('\n');
	const events: ActivityEvent[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		// Skip empty lines
		if (!line) {
			continue;
		}

		// Parse JSON
		try {
			const event = JSON.parse(line);
			events.push(event);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new Error(`Invalid JSON at line ${i + 1}: ${errorMessage}`);
		}
	}

	return events;
}

/**
 * Filters activity log events based on criteria.
 * Supports filtering by event type, timestamp range, and custom predicates.
 *
 * @param {string} activityPath - Path to the activity.jsonl file
 * @param {ActivityFilter} filter - Filter criteria
 * @returns {Promise<ActivityEvent[]>} Filtered array of events
 *
 * @example
 * // Filter by event type
 * const phaseEvents = await filterActivityLog('/path/to/activity.jsonl', {
 *   type: 'phase-start'
 * });
 *
 * // Filter by timestamp range
 * const recentEvents = await filterActivityLog('/path/to/activity.jsonl', {
 *   timestampFrom: '2024-01-15T10:00:00.000Z'
 * });
 *
 * // Filter with custom predicate
 * const failedTests = await filterActivityLog('/path/to/activity.jsonl', {
 *   predicate: (event) => event.type === 'test-run' && event.result === 'fail'
 * });
 */
export async function filterActivityLog(
	activityPath: string,
	filter: ActivityFilter & Record<string, any>
): Promise<ActivityEvent[]> {
	const events = await readActivityLog(activityPath);

	return events.filter((event) => {
		// Filter by type
		if (filter.type && event.type !== filter.type) {
			return false;
		}

		// Filter by timestamp range
		if (filter.timestampFrom && event.timestamp < filter.timestampFrom) {
			return false;
		}

		if (filter.timestampTo && event.timestamp > filter.timestampTo) {
			return false;
		}

		// Filter by custom predicate
		if (filter.predicate && !filter.predicate(event)) {
			return false;
		}

		// Filter by other fields (exact match)
		for (const [key, value] of Object.entries(filter)) {
			if (
				key === 'type' ||
				key === 'timestampFrom' ||
				key === 'timestampTo' ||
				key === 'predicate'
			) {
				continue;
			}

			if (event[key] !== value) {
				return false;
			}
		}

		return true;
	});
}
