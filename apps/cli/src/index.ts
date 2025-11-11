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
export { TagsCommand } from './commands/tags.command.js';
export { BriefsCommand } from './commands/briefs.command.js';

// Command Registry
export {
	CommandRegistry,
	registerAllCommands,
	registerCommandsByCategory,
	type CommandMetadata
} from './command-registry.js';

// General utilities (error handling, auto-update, etc.)
export * from './utils/index.js';

// UI utilities - exported only via ui namespace to avoid naming conflicts
// Import via: import { ui } from '@tm/cli'; ui.displayBanner();
export * as ui from './ui/index.js';

export { runInteractiveSetup } from './commands/models/index.js';

// Re-export commonly used types from tm-core
export type {
	Task,
	TaskStatus,
	TaskPriority,
	TmCore
} from '@tm/core';
