/**
 * @fileoverview Utilities for working with task statuses
 * Re-exports status utilities from @tm/core for CLI convenience
 */

// Re-export terminal status utilities from @tm/core (single source of truth)
export {
	TERMINAL_COMPLETE_STATUSES,
	isTaskComplete
} from '@tm/core';
