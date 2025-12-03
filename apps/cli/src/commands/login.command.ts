/**
 * @fileoverview Login command - alias for 'auth login'
 * Provides a convenient shorthand for authentication.
 *
 * This is a thin wrapper that delegates to AuthCommand.
 */

import { Command } from 'commander';
import { AuthCommand } from './auth.command.js';

/**
 * LoginCommand - Shorthand alias for 'tm auth login'
 * Reuses AuthCommand's login functionality to avoid code duplication.
 */
export class LoginCommand extends Command {
	private authCommand: AuthCommand;

	constructor(name?: string) {
		super(name || 'login');

		this.authCommand = new AuthCommand();

		this.description('Login to Hamster (alias for "auth login")');
		this.argument(
			'[token]',
			'Authentication token (optional, for SSH/remote environments)'
		);
		this.option('-y, --yes', 'Skip interactive prompts');

		this.addHelpText(
			'after',
			`
Examples:
  $ tm login              # Browser-based OAuth flow (interactive)
  $ tm login <token>      # Token-based authentication
  $ tm login <token> -y   # Non-interactive token auth (for scripts)
`
		);

		this.action(async (token?: string, options?: { yes?: boolean }) => {
			// Delegate to AuthCommand's executeLogin
			await this.authCommand.executeLogin(token, options?.yes, true);
		});
	}

	/**
	 * Register this command on a program
	 */
	static register(program: Command): LoginCommand {
		const cmd = new LoginCommand();
		program.addCommand(cmd);
		return cmd;
	}
}
