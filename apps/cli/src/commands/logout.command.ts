/**
 * @fileoverview Logout command - alias for 'auth logout'
 * Provides a convenient shorthand for logging out.
 *
 * This is a thin wrapper that delegates to AuthCommand.
 */

import { Command } from 'commander';
import { AuthCommand } from './auth.command.js';

/**
 * LogoutCommand - Shorthand alias for 'tm auth logout'
 * Reuses AuthCommand's logout functionality to avoid code duplication.
 */
export class LogoutCommand extends Command {
	private authCommand: AuthCommand;

	constructor(name?: string) {
		super(name || 'logout');

		this.authCommand = new AuthCommand();

		this.description('Logout from Hamster (alias for "auth logout")');

		this.addHelpText(
			'after',
			`
Examples:
  $ tm logout    # Clear credentials and logout
`
		);

		this.action(async () => {
			// Delegate to AuthCommand's executeLogout
			await this.authCommand.executeLogout();
		});
	}

	/**
	 * Register this command on a program
	 */
	static register(program: Command): LogoutCommand {
		const cmd = new LogoutCommand();
		program.addCommand(cmd);
		return cmd;
	}
}
