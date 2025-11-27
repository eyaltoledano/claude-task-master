/**
 * @fileoverview Main UI exports
 * Organized UI system with components, formatters, display primitives, and layout helpers
 */

// High-level UI components
export * from './components/index.js';

// Status formatters
export {
	getStatusWithColor,
	getBriefStatusWithColor,
	getBriefStatusIcon,
	getBriefStatusColor,
	capitalizeStatus
} from './formatters/status-formatters.js';

// Priority formatters
export { getPriorityWithColor } from './formatters/priority-formatters.js';

// Complexity formatters
export {
	getComplexityWithColor,
	getComplexityWithScore
} from './formatters/complexity-formatters.js';

// Dependency formatters
export { formatDependenciesWithStatus } from './formatters/dependency-formatters.js';

// Link formatters (clickable terminal links)
export {
	createLink,
	createUrlLink,
	createBriefLink,
	createTaskLink,
	supportsLinks
} from './formatters/link-formatters.js';

// Layout helpers
export {
	getBoxWidth,
	truncate,
	createProgressBar
} from './layout/helpers.js';

// Display messages
// Note: displayError alias is available via namespace (ui.displayError) for backward compat
// but not exported at package level to avoid conflicts with utils/error-handler.ts
export {
	displayBanner,
	displayErrorBox,
	displayError, // Backward compatibility alias
	displaySuccess,
	displayWarning,
	displayInfo
} from './display/messages.js';

// Display tables
export { createTaskTable } from './display/tables.js';
