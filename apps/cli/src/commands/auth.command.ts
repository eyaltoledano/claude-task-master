/**
 * @fileoverview Auth command using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora, { type Ora } from 'ora';
import open from 'open';
import {
	AuthManager,
	AuthenticationError,
	type AuthCredentials
} from '@tm/core/auth';
import * as ui from '../utils/ui.js';

/**
 * Result type from auth command
 */
export interface AuthResult {
	success: boolean;
	action: 'login' | 'logout' | 'status' | 'refresh';
	credentials?: AuthCredentials;
	message?: string;
}

/**
 * AuthCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core's AuthManager
 */
export class AuthCommand extends Command {
	private authManager: AuthManager;
	private lastResult?: AuthResult;

	constructor(name?: string) {
		super(name || 'auth');

		// Initialize auth manager
		this.authManager = AuthManager.getInstance();

		// Configure the command with subcommands
		this.description('Manage authentication with tryhamster.com');

		// Add subcommands
		this.addLoginCommand();
		this.addLogoutCommand();
		this.addStatusCommand();
		this.addRefreshCommand();

		// Default action shows help
		this.action(() => {
			this.help();
		});
	}

	/**
	 * Add login subcommand
	 */
	private addLoginCommand(): void {
		this.command('login')
			.description('Authenticate with tryhamster.com')
			.action(async () => {
				await this.executeLogin();
			});
	}

	/**
	 * Add logout subcommand
	 */
	private addLogoutCommand(): void {
		this.command('logout')
			.description('Logout and clear credentials')
			.action(async () => {
				await this.executeLogout();
			});
	}

	/**
	 * Add status subcommand
	 */
	private addStatusCommand(): void {
		this.command('status')
			.description('Display authentication status')
			.action(async () => {
				await this.executeStatus();
			});
	}

	/**
	 * Add refresh subcommand
	 */
	private addRefreshCommand(): void {
		this.command('refresh')
			.description('Refresh authentication token')
			.action(async () => {
				await this.executeRefresh();
			});
	}

	/**
	 * Execute login command
	 */
	private async executeLogin(): Promise<void> {
		try {
			const result = await this.performInteractiveAuth();
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}

			// Exit cleanly after successful authentication
			// Small delay to ensure all output is flushed
			setTimeout(() => {
				process.exit(0);
			}, 100);
		} catch (error: any) {
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Execute logout command
	 */
	private async executeLogout(): Promise<void> {
		try {
			const result = await this.performLogout();
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Execute status command
	 */
	private async executeStatus(): Promise<void> {
		try {
			const result = this.displayStatus();
			this.setLastResult(result);
		} catch (error: any) {
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Execute refresh command
	 */
	private async executeRefresh(): Promise<void> {
		try {
			const result = await this.refreshToken();
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Display authentication status
	 */
	private displayStatus(): AuthResult {
		const credentials = this.authManager.getCredentials();

		console.log(chalk.cyan('\n🔐 Authentication Status\n'));

		if (credentials) {
			console.log(chalk.green('✓ Authenticated'));
			console.log(chalk.gray(`  Email: ${credentials.email || 'N/A'}`));
			console.log(chalk.gray(`  User ID: ${credentials.userId}`));
			console.log(
				chalk.gray(`  Token Type: ${credentials.tokenType || 'standard'}`)
			);

			if (credentials.expiresAt) {
				const expiresAt = new Date(credentials.expiresAt);
				const now = new Date();
				const hoursRemaining = Math.floor(
					(expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
				);

				if (hoursRemaining > 0) {
					console.log(
						chalk.gray(
							`  Expires: ${expiresAt.toLocaleString()} (${hoursRemaining} hours remaining)`
						)
					);
				} else {
					console.log(
						chalk.yellow(`  Token expired at: ${expiresAt.toLocaleString()}`)
					);
				}
			} else {
				console.log(chalk.gray('  Expires: Never (API key)'));
			}

			console.log(
				chalk.gray(`  Saved: ${new Date(credentials.savedAt).toLocaleString()}`)
			);

			return {
				success: true,
				action: 'status',
				credentials,
				message: 'Authenticated'
			};
		} else {
			console.log(chalk.yellow('✗ Not authenticated'));
			console.log(
				chalk.gray('\n  Run "task-master auth login" to authenticate')
			);

			return {
				success: false,
				action: 'status',
				message: 'Not authenticated'
			};
		}
	}

	/**
	 * Perform logout
	 */
	private async performLogout(): Promise<AuthResult> {
		try {
			await this.authManager.logout();
			ui.displaySuccess('Successfully logged out');

			return {
				success: true,
				action: 'logout',
				message: 'Successfully logged out'
			};
		} catch (error) {
			const message = `Failed to logout: ${(error as Error).message}`;
			ui.displayError(message);

			return {
				success: false,
				action: 'logout',
				message
			};
		}
	}

	/**
	 * Refresh authentication token
	 */
	private async refreshToken(): Promise<AuthResult> {
		const spinner = ora('Refreshing authentication token...').start();

		try {
			const credentials = await this.authManager.refreshToken();
			spinner.succeed('Token refreshed successfully');

			console.log(
				chalk.gray(
					`  New expiration: ${credentials.expiresAt ? new Date(credentials.expiresAt).toLocaleString() : 'Never'}`
				)
			);

			return {
				success: true,
				action: 'refresh',
				credentials,
				message: 'Token refreshed successfully'
			};
		} catch (error) {
			spinner.fail('Failed to refresh token');

			if ((error as AuthenticationError).code === 'NO_REFRESH_TOKEN') {
				ui.displayWarning(
					'No refresh token available. Please re-authenticate.'
				);
			} else {
				ui.displayError(`Refresh failed: ${(error as Error).message}`);
			}

			return {
				success: false,
				action: 'refresh',
				message: `Failed to refresh: ${(error as Error).message}`
			};
		}
	}

	/**
	 * Perform interactive authentication
	 */
	private async performInteractiveAuth(): Promise<AuthResult> {
		ui.displayBanner('Task Master Authentication');

		// Check if already authenticated
		if (this.authManager.isAuthenticated()) {
			const { continueAuth } = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'continueAuth',
					message:
						'You are already authenticated. Do you want to re-authenticate?',
					default: false
				}
			]);

			if (!continueAuth) {
				const credentials = this.authManager.getCredentials();
				ui.displaySuccess('Using existing authentication');

				if (credentials) {
					console.log(chalk.gray(`  Email: ${credentials.email || 'N/A'}`));
					console.log(chalk.gray(`  User ID: ${credentials.userId}`));
				}

				return {
					success: true,
					action: 'login',
					credentials: credentials || undefined,
					message: 'Using existing authentication'
				};
			}
		}

		try {
			// Direct browser authentication - no menu needed
			const credentials = await this.authenticateWithBrowser();

			ui.displaySuccess('Authentication successful!');
			console.log(
				chalk.gray(`  Logged in as: ${credentials.email || credentials.userId}`)
			);

			return {
				success: true,
				action: 'login',
				credentials,
				message: 'Authentication successful'
			};
		} catch (error) {
			this.handleAuthError(error as AuthenticationError);

			return {
				success: false,
				action: 'login',
				message: `Authentication failed: ${(error as Error).message}`
			};
		}
	}

	/**
	 * Authenticate with browser using OAuth 2.0 with PKCE
	 */
	private async authenticateWithBrowser(): Promise<AuthCredentials> {
		let authSpinner: Ora | null = null;

		try {
			// Use AuthManager's new unified OAuth flow method with callbacks
			const credentials = await this.authManager.authenticateWithOAuth({
				// Callback to handle browser opening
				openBrowser: async (authUrl) => {
					await open(authUrl);
				},
				timeout: 5 * 60 * 1000, // 5 minutes

				// Callback when auth URL is ready
				onAuthUrl: (authUrl) => {
					// Display authentication instructions
					console.log(chalk.blue.bold('\n🔐 Browser Authentication\n'));
					console.log(chalk.white('  Opening your browser to authenticate...'));
					console.log(chalk.gray("  If the browser doesn't open, visit:"));
					console.log(chalk.cyan.underline(`  ${authUrl}\n`));
				},

				// Callback when waiting for authentication
				onWaitingForAuth: () => {
					authSpinner = ora({
						text: 'Waiting for authentication...',
						spinner: 'dots'
					}).start();
				},

				// Callback on success
				onSuccess: () => {
					if (authSpinner) {
						authSpinner.succeed('Authentication successful!');
					}
				},

				// Callback on error
				onError: () => {
					if (authSpinner) {
						authSpinner.fail('Authentication failed');
					}
				}
			});

			return credentials;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Handle authentication errors
	 */
	private handleAuthError(error: AuthenticationError): void {
		console.error(chalk.red(`\n✗ ${error.message}`));

		switch (error.code) {
			case 'NETWORK_ERROR':
				ui.displayWarning(
					'Please check your internet connection and try again.'
				);
				break;
			case 'INVALID_CREDENTIALS':
				ui.displayWarning('Please check your credentials and try again.');
				break;
			case 'AUTH_EXPIRED':
				ui.displayWarning(
					'Your session has expired. Please authenticate again.'
				);
				break;
			default:
				if (process.env.DEBUG) {
					console.error(chalk.gray(error.stack || ''));
				}
		}
	}

	/**
	 * Handle general errors
	 */
	private handleError(error: any): void {
		if (error instanceof AuthenticationError) {
			this.handleAuthError(error);
		} else {
			const msg = error?.getSanitizedDetails?.() ?? {
				message: error?.message ?? String(error)
			};
			console.error(chalk.red(`Error: ${msg.message || 'Unexpected error'}`));

			if (error.stack && process.env.DEBUG) {
				console.error(chalk.gray(error.stack));
			}
		}
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: AuthResult): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): AuthResult | undefined {
		return this.lastResult;
	}

	/**
	 * Get current authentication status (for programmatic usage)
	 */
	isAuthenticated(): boolean {
		return this.authManager.isAuthenticated();
	}

	/**
	 * Get current credentials (for programmatic usage)
	 */
	getCredentials(): AuthCredentials | null {
		return this.authManager.getCredentials();
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		// No resources to clean up for auth command
		// But keeping method for consistency with other commands
	}

	/**
	 * Static method to register this command on an existing program
	 * This is for gradual migration - allows commands.js to use this
	 */
	static registerOn(program: Command): Command {
		const authCommand = new AuthCommand();
		program.addCommand(authCommand);
		return authCommand;
	}

	/**
	 * Alternative registration that returns the command for chaining
	 * Can also configure the command name if needed
	 */
	static register(program: Command, name?: string): AuthCommand {
		const authCommand = new AuthCommand(name);
		program.addCommand(authCommand);
		return authCommand;
	}
}
