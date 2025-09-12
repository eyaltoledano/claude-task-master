/**
 * @fileoverview Main entry point for @tm/cli package
 * Exports all public APIs for the CLI presentation layer
 */

// Commands
export { ListTasksCommand } from './commands/list.command.js';
export { ShowCommand } from './commands/show.command.js';
export { AuthCommand } from './commands/auth.command.js';
export { ContextCommand } from './commands/context.command.js';
export { StartCommand } from './commands/start.command.js';
export { SetStatusCommand } from './commands/set-status.command.js';

// UI utilities (for other commands to use)
export * as ui from './utils/ui.js';

// Auto-update utilities
export {
	checkForUpdate,
	performAutoUpdate,
	displayUpgradeNotification
} from './utils/auto-update.js';

// Re-export commonly used types from tm-core
export type {
	Task,
	TaskStatus,
	TaskPriority,
	TaskMasterCore
} from '@tm/core';
