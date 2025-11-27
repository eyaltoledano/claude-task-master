/**
 * @fileoverview Auto-update utilities for task-master-ai CLI
 *
 * This module provides functionality for:
 * - Checking for updates from npm registry
 * - Downloading and installing updates with progress bar
 * - Displaying update notifications
 * - Restarting CLI after updates
 */

// Re-export types
export type { UpdateInfo, TarballInfo } from './types.js';

// Re-export version utilities
export { compareVersions } from './version.js';

// Re-export changelog utilities (parseChangelogHighlights exported for testing)
export { parseChangelogHighlights } from './changelog.js';

// Re-export update checking
export { checkForUpdate } from './check-update.js';

// Re-export display utilities
export { displayUpgradeNotification } from './display.js';

// Re-export installation
export { performAutoUpdate } from './install.js';

// Re-export restart functionality
export { restartWithNewVersion } from './restart.js';
