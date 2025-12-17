/**
 * Detection types for auto-detecting IDE markers in project directories.
 */

/**
 * Result of detecting an IDE marker in the project
 */
export interface DetectionResult {
	/** Profile name (e.g., 'cursor', 'claude') */
	profileName: string;
	/** The marker path that was found (e.g., '.cursor') */
	markerPath: string;
	/** Human-readable display name (e.g., 'Cursor', 'Claude Code') */
	displayName: string;
	/** Whether the marker exists */
	exists: boolean;
}

/**
 * Options for IDE detection
 */
export interface DetectionOptions {
	/** Project root directory to search in */
	projectRoot: string;
}
