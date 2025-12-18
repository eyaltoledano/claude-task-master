/**
 * IDE detection logic for auto-detecting installed IDEs in project directories.
 */
import fs from 'fs';
import path from 'path';
import { IDE_MARKERS } from './profiles-map.js';
import type { DetectionResult, DetectionOptions } from './types.js';

/**
 * Detect installed IDEs by checking for marker directories/files.
 *
 * @param options - Detection options including project root
 * @returns Array of detected IDE profiles
 *
 * @example
 * ```typescript
 * const detected = detectInstalledIDEs({ projectRoot: '/path/to/project' });
 * // Returns: [{ profileName: 'cursor', markerPath: '.cursor', displayName: 'Cursor', exists: true }]
 * ```
 */
export function detectInstalledIDEs(
	options: DetectionOptions
): DetectionResult[] {
	const { projectRoot } = options;
	const results: DetectionResult[] = [];

	for (const ideMarker of IDE_MARKERS) {
		// Check each marker (directory or file) - first match wins
		for (const marker of ideMarker.markers) {
			const fullPath = path.join(projectRoot, marker.path);

			try {
				const stat = fs.statSync(fullPath);
				const exists =
					marker.type === 'directory' ? stat.isDirectory() : stat.isFile();

				if (exists) {
					results.push({
						profileName: ideMarker.profileName,
						markerPath: marker.path,
						displayName: ideMarker.displayName,
						exists: true
					});
					break; // Found one marker, no need to check others for this IDE
				}
			} catch {
				// File/directory doesn't exist or can't be accessed - continue to next marker
			}
		}
	}

	return results;
}

/**
 * Get profile names that should be pre-selected based on detected IDEs.
 *
 * @param options - Detection options including project root
 * @returns Array of profile names (e.g., ['cursor', 'claude'])
 *
 * @example
 * ```typescript
 * const profiles = getPreSelectedProfiles({ projectRoot: '/path/to/project' });
 * // Returns: ['cursor', 'claude']
 * ```
 */
export function getPreSelectedProfiles(options: DetectionOptions): string[] {
	return detectInstalledIDEs(options).map((r) => r.profileName);
}

/**
 * Detect a specific profile's IDE marker.
 *
 * @param profileName - Profile to check (e.g., 'cursor')
 * @param projectRoot - Project root directory
 * @returns Detection result if found, null otherwise
 */
export function detectProfile(
	profileName: string,
	projectRoot: string
): DetectionResult | null {
	const detected = detectInstalledIDEs({ projectRoot });
	return detected.find((r) => r.profileName === profileName) ?? null;
}
