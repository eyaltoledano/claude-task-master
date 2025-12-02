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

// Auth guard for commands requiring authentication
export {
	ensureAuthenticated,
	withAuth,
	type AuthGuardOptions,
	type AuthGuardResult
} from './auth-guard.js';

// Shared browser authentication with MFA support
export { authenticateWithBrowserMFA } from './auth-ui.js';

// Organization selection utility
export { ensureOrgSelected, type OrgSelectionResult } from './org-selection.js';

// Command guard for local-only commands
export {
	checkAndBlockIfAuthenticated,
	checkAndBlockDependencyCommand // Legacy export
} from './command-guard.js';

// Error handling utilities
export { displayError, isDebugMode } from './error-handler.js';

// Auto-update utilities
export {
	checkForUpdate,
	performAutoUpdate,
	displayUpgradeNotification,
	compareVersions,
	restartWithNewVersion
} from './auto-update/index.js';

// Display helpers (command-specific helpers)
export { displayCommandHeader } from './display-helpers.js';
