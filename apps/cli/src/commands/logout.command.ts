/**
 * @fileoverview Logout command - alias for 'auth logout'
 * Provides a convenient shorthand for logging out
 */

import { AuthManager } from '@tm/core';
import { Command } from 'commander';
import ora from 'ora';
import { displayError } from '../utils/error-handler.js';
import * as ui from '../utils/ui.js';

/**
 * LogoutCommand - Shorthand alias for 'tm auth logout'
 */
export class LogoutCommand extends Command {
	private authManager: AuthManager;

	constructor(name?: string) {
		super(name || 'logout');

		this.authManager = AuthManager.getInstance();

		this.description('Logout from Hamster (alias for "auth logout")');

		this.addHelpText(
			'after',
			`
Examples:
  $ tm logout    # Clear credentials and logout
`
		);

		this.action(async () => {
			await this.executeLogout();
		});
	}

	/**
	 * Execute logout
	 */
	private async executeLogout(): Promise<void> {
		const spinner = ora('Logging out...').start();

		try {
			await this.authManager.logout();
			spinner.succeed('Logged out successfully');
			ui.displaySuccess('You have been logged out');
		} catch (error) {
			spinner.fail('Logout failed');
			this.handleAuthError(error);
			process.exit(1);
		}
	}

	/**
	 * Handle authentication errors
	 */
	private handleAuthError(error: unknown): void {
		if (error instanceof Error) {
			displayError(error);
		} else {
			displayError(
				new Error(String(error ?? 'An unknown error occurred during logout'))
			);
		}
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
