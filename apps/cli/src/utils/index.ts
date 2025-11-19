/**
 * @fileoverview CLI utilities main export
 * General-purpose utilities (non-UI)
 *
 * Note: UI-related utilities have been moved to src/ui/
 * For backward compatibility, use src/utils/ui.ts which re-exports from src/ui/
 */

// Authentication helpers
export {
	checkAuthentication,
	type CheckAuthOptions
} from './auth-helpers.js';

// Error handling utilities
export { displayError, isDebugMode } from './error-handler.js';

// Auto-update utilities
export {
	checkForUpdate,
	performAutoUpdate,
	displayUpgradeNotification,
	compareVersions,
	restartWithNewVersion
} from './auto-update.js';

// Display helpers (command-specific helpers)
export { displayCommandHeader } from './display-helpers.js';
