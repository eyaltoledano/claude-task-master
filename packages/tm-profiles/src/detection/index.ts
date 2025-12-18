/**
 * IDE Detection Module
 *
 * Provides functions to auto-detect installed IDEs based on project markers.
 * Used for pre-selecting profiles in `tm rules add` and
 * non-interactive mode with `tm rules add -y`.
 */

export type { DetectionResult, DetectionOptions } from './types.js';
export type { IDEMarker } from './profiles-map.js';
export {
	IDE_MARKERS,
	getIDEMarker,
	isDetectableProfile
} from './profiles-map.js';
export {
	detectInstalledIDEs,
	getPreSelectedProfiles,
	detectProfile
} from './detector.js';
