/**
 * @fileoverview Main entry point for @tm/cli package
 * Exports all public APIs for the CLI presentation layer
 */

// Commands
export { ListTasksCommand } from './commands/list.command.js';
export { ShowCommand } from './commands/show.command.js';
export { NextCommand } from './commands/next.command.js';
export { AuthCommand } from './commands/auth.command.js';
export { ContextCommand } from './commands/context.command.js';
export { StartCommand } from './commands/start.command.js';
export { SetStatusCommand } from './commands/set-status.command.js';
export { ExportCommand } from './commands/export.command.js';

// Command Registry
export {
	CommandRegistry,
	registerAllCommands,
	registerCommandsByCategory,
	type CommandMetadata
} from './command-registry.js';

// UI utilities (for other commands to use)
export * as ui from './utils/ui.js';

// Error handling utilities
export { displayError, isDebugMode } from './utils/error-handler.js';

// Auto-update utilities
export {
	checkForUpdate,
	performAutoUpdate,
	displayUpgradeNotification,
	compareVersions,
	restartWithNewVersion
} from './utils/auto-update.js';

export { runInteractiveSetup } from './commands/models/index.js';

// Re-export commonly used types from tm-core
export type {
	Task,
	TaskStatus,
	TaskPriority,
	TmCore
} from '@tm/core';
