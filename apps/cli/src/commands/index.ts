/**
 * Command registry - exports all CLI commands for central registration
 */

import type { Command } from 'commander';
import { ListTasksCommand } from './list.command.js';
import { AuthCommand } from './auth.command.js';
import WorkflowCommand from './workflow.command.js';

// Define interface for command classes that can register themselves
export interface CommandRegistrar {
	register(program: Command, name?: string): any;
}

// Future commands can be added here as they're created
// The pattern is: each command exports a class with a static register(program: Command, name?: string) method

/**
 * Auto-register all exported commands that implement the CommandRegistrar interface
 */
export function registerAllCommands(program: Command): void {
	// Get all exports from this module
	const commands = [
		ListTasksCommand,
		AuthCommand,
		WorkflowCommand
		// Add new commands here as they're imported above
	];

	commands.forEach((CommandClass) => {
		if (
			'register' in CommandClass &&
			typeof CommandClass.register === 'function'
		) {
			CommandClass.register(program);
		}
	});
}
