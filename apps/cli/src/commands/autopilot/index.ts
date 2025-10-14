/**
 * @fileoverview Autopilot CLI Commands for AI Agent Orchestration
 * Provides subcommands for starting, resuming, and advancing the TDD workflow
 * with JSON output for machine parsing.
 */

import { Command } from 'commander';
import { StartCommand } from './start.command.js';
import { ResumeCommand } from './resume.command.js';
import { NextCommand } from './next.command.js';
import { CompleteCommand } from './complete.command.js';
import { CommitCommand } from './commit.command.js';
import { StatusCommand } from './status.command.js';
import { AbortCommand } from './abort.command.js';

/**
 * Shared command options for all autopilot commands
 */
export interface AutopilotBaseOptions {
	json?: boolean;
	verbose?: boolean;
	projectRoot?: string;
}

/**
 * AutopilotCommand with subcommands for TDD workflow orchestration
 */
export class AutopilotCommand extends Command {
	constructor() {
		super('autopilot');

		// Configure main command
		this.description('AI agent orchestration for TDD workflow execution')
			.alias('ap')
			// Global options for all subcommands
			.option('--json', 'Output in JSON format for machine parsing')
			.option('-v, --verbose', 'Enable verbose output')
			.option(
				'-p, --project-root <path>',
				'Project root directory',
				process.cwd()
			);

		// Register subcommands
		this.registerSubcommands();
	}

	/**
	 * Register all autopilot subcommands
	 */
	private registerSubcommands(): void {
		// Start new TDD workflow
		this.addCommand(new StartCommand());

		// Resume existing workflow
		this.addCommand(new ResumeCommand());

		// Get next action
		this.addCommand(new NextCommand());

		// Complete current phase
		this.addCommand(new CompleteCommand());

		// Create commit
		this.addCommand(new CommitCommand());

		// Show status
		this.addCommand(new StatusCommand());

		// Abort workflow
		this.addCommand(new AbortCommand());
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command): AutopilotCommand {
		const autopilotCommand = new AutopilotCommand();
		program.addCommand(autopilotCommand);
		return autopilotCommand;
	}
}
