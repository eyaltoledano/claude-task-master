/**
 * @fileoverview Interactive command to launch the Terminal UI
 * Extends Commander.Command for integration with the CLI framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { launchTerminalUI } from '@tm/terminal-ui';

/**
 * Options interface for the interactive command
 */
export interface InteractiveCommandOptions {
	panel?: string;
	section?: string;
	project?: string;
}

/**
 * InteractiveCommand extending Commander's Command class
 * Launches the Terminal UI with optional panel and section targeting
 */
export class InteractiveCommand extends Command {
	constructor(name?: string) {
		super(name || 'interactive');

		// Configure the command
		this.description('Launch the interactive terminal UI')
			.alias('tui')
			.option('--panel <panel>', 'Initial panel to display (dashboard, help)')
			.option('--section <section>', 'Initial section to focus')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
			.action(async (options: InteractiveCommandOptions) => {
				await this.executeCommand(options);
			});
	}

	/**
	 * Execute the interactive command
	 */
	private async executeCommand(
		options: InteractiveCommandOptions
	): Promise<void> {
		try {
			// Validate options
			if (!this.validateOptions(options)) {
				process.exit(1);
			}

			// Resolve and validate project path
			const projectPath = options.project
				? resolve(options.project)
				: process.cwd();

			// If --project was explicitly provided, validate it exists
			if (options.project && !existsSync(projectPath)) {
				console.error(
					chalk.red(`Error: Project path does not exist: ${projectPath}`)
				);
				console.error(
					chalk.gray(
						'\nPlease check the path and try again, or omit --project to use the current directory.'
					)
				);
				process.exit(1);
			}

			// Display launch message
			console.log(chalk.cyan('Launching Task Master Terminal UI...'));
			console.log(chalk.gray(`Project: ${projectPath}`));

			if (options.panel) {
				console.log(chalk.gray(`Panel: ${options.panel}`));
			}
			if (options.section) {
				console.log(chalk.gray(`Section: ${options.section}`));
			}

			console.log(); // Empty line

			// Launch the terminal UI
			await launchTerminalUI({
				panel: options.panel,
				section: options.section,
				projectPath: projectPath,
				explicitProject: !!options.project // Flag to indicate --project was used
			});
		} catch (error: any) {
			console.error(
				chalk.red(
					`Error launching terminal UI: ${error?.message || String(error)}`
				)
			);
			if (error.stack && process.env.DEBUG) {
				console.error(chalk.gray(error.stack));
			}
			process.exit(1);
		}
	}

	/**
	 * Validate command options
	 */
	private validateOptions(options: InteractiveCommandOptions): boolean {
		// Validate panel name
		const validPanels = ['dashboard', 'help'];
		if (options.panel && !validPanels.includes(options.panel.toLowerCase())) {
			console.error(chalk.red(`Invalid panel: ${options.panel}`));
			console.error(chalk.gray(`Valid panels: ${validPanels.join(', ')}`));
			return false;
		}

		// Validate section is only provided with panel
		if (options.section && !options.panel) {
			console.error(chalk.red('--section requires --panel to be specified'));
			return false;
		}

		return true;
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): InteractiveCommand {
		const interactiveCommand = new InteractiveCommand(name);
		program.addCommand(interactiveCommand);
		return interactiveCommand;
	}
}
