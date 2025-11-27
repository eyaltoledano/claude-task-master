/**
 * @fileoverview Login command - alias for 'auth login'
 * Provides a convenient shorthand for authentication
 */

import { AuthManager, AuthenticationError } from '@tm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import open from 'open';
import ora, { type Ora } from 'ora';
import { displayError } from '../utils/error-handler.js';
import * as ui from '../utils/ui.js';

/**
 * LoginCommand - Shorthand alias for 'tm auth login'
 */
export class LoginCommand extends Command {
	private authManager: AuthManager;

	constructor(name?: string) {
		super(name || 'login');

		this.authManager = AuthManager.getInstance();

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
			await this.executeLogin(token, options?.yes);
		});
	}

	/**
	 * Execute login
	 */
	private async executeLogin(token?: string, yes?: boolean): Promise<void> {
		try {
			const result = token
				? await this.performTokenAuth(token, yes)
				: await this.performInteractiveAuth(yes);

			if (!result.success) {
				process.exit(1);
			}

			// Exit cleanly after successful authentication
			setTimeout(() => {
				process.exit(0);
			}, 100);
		} catch (error) {
			this.handleAuthError(error);
			process.exit(1);
		}
	}

	/**
	 * Perform token-based authentication
	 */
	private async performTokenAuth(
		token: string,
		skipPrompts?: boolean
	): Promise<{ success: boolean; message?: string }> {
		const spinner = ora('Authenticating with token...').start();

		try {
			await this.authManager.authenticateWithToken(token);
			spinner.succeed('Authenticated successfully');
			ui.displaySuccess('You are now logged in');
			return { success: true };
		} catch (error) {
			spinner.fail('Authentication failed');

			// Check for MFA required error
			if (
				error instanceof AuthenticationError &&
				error.code === 'MFA_REQUIRED'
			) {
				spinner.stop();
				return this.handleMFAVerification(skipPrompts);
			}

			throw error;
		}
	}

	/**
	 * Perform interactive browser-based authentication
	 */
	private async performInteractiveAuth(
		skipPrompts?: boolean
	): Promise<{ success: boolean; message?: string }> {
		let spinner: Ora | null = null;

		try {
			// Check if already authenticated
			if (await this.authManager.hasValidSession()) {
				const credentials = await this.authManager.getCredentials();
				ui.displayInfo(
					`Already authenticated as ${credentials?.user?.email || 'unknown user'}`
				);

				if (!skipPrompts) {
					const response = await inquirer.prompt<{ reauth: boolean }>([
						{
							type: 'confirm',
							name: 'reauth',
							message: 'Re-authenticate?',
							default: false
						}
					]);

					if (!response.reauth) {
						return { success: true, message: 'Already authenticated' };
					}
				}
			}

			// Start browser auth flow
			spinner = ora('Starting browser authentication...').start();

			const authUrl = await this.authManager.authenticateWithBrowser(
				async (url: string) => {
					spinner?.succeed('Opening browser for authentication');
					console.log(chalk.gray(`  ${url}`));

					try {
						await open(url);
					} catch {
						console.log(chalk.yellow('\n  Could not open browser automatically.'));
						console.log(chalk.yellow('  Please open the URL above manually.\n'));
					}
				}
			);

			if (!authUrl) {
				ui.displaySuccess('Authentication successful');
				return { success: true };
			}

			return { success: true };
		} catch (error) {
			if (spinner?.isSpinning) {
				spinner.fail('Authentication failed');
			}

			// Check for MFA required error
			if (
				error instanceof AuthenticationError &&
				error.code === 'MFA_REQUIRED'
			) {
				return this.handleMFAVerification(skipPrompts);
			}

			throw error;
		}
	}

	/**
	 * Handle MFA verification flow
	 */
	private async handleMFAVerification(
		skipPrompts?: boolean
	): Promise<{ success: boolean; message?: string }> {
		console.log(chalk.yellow('\nMulti-factor authentication required'));

		if (skipPrompts) {
			ui.displayError(
				'MFA verification required but running in non-interactive mode'
			);
			return { success: false, message: 'MFA required but skipped' };
		}

		try {
			await this.authManager.verifyMFAWithRetry(async (attempt) => {
				const response = await inquirer.prompt<{ code: string }>([
					{
						type: 'input',
						name: 'code',
						message:
							attempt > 1
								? `Enter verification code (attempt ${attempt}/3):`
								: 'Enter verification code:',
						validate: (input: string) => {
							if (!input || input.trim().length === 0) {
								return 'Verification code is required';
							}
							if (!/^\d{6}$/.test(input.trim())) {
								return 'Please enter a 6-digit code';
							}
							return true;
						}
					}
				]);
				return response.code.trim();
			});

			ui.displaySuccess('MFA verification successful');
			return { success: true };
		} catch (error) {
			if (error instanceof AuthenticationError) {
				ui.displayError(`MFA verification failed: ${error.message}`);
			}
			return { success: false, message: 'MFA verification failed' };
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
				new Error(String(error ?? 'An unknown authentication error occurred'))
			);
		}
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

