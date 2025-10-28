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
} from '@tm/core';
import * as ui from '../utils/ui.js';
import { ContextCommand } from './context.command.js';
import { displayError } from '../utils/error-handler.js';

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
			.argument(
				'[token]',
				'Authentication token (optional, for SSH/remote environments)'
			)
			.option('-y, --yes', 'Skip interactive prompts')
			.addHelpText(
				'after',
				`
Examples:
  $ tm auth login         # Browser-based OAuth flow (interactive)
  $ tm auth login <token> # Token-based authentication
  $ tm auth login <token> -y # Non-interactive token auth (for scripts)
`
			)
			.action(async (token?: string, options?: { yes?: boolean }) => {
				await this.executeLogin(token, options?.yes);
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
	private async executeLogin(token?: string, yes?: boolean): Promise<void> {
		try {
			const result = token
				? await this.performTokenAuth(token, yes)
				: await this.performInteractiveAuth(yes);
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
			displayError(error);
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
			displayError(error);
		}
	}

	/**
	 * Execute status command
	 */
	private async executeStatus(): Promise<void> {
		try {
			const result = await this.displayStatus();
			this.setLastResult(result);
		} catch (error: any) {
			displayError(error);
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
			displayError(error);
		}
	}

	/**
	 * Display authentication status
	 */
	private async displayStatus(): Promise<AuthResult> {
		console.log(chalk.cyan('\n🔐 Authentication Status\n'));

		// Check if user has valid session
		const hasSession = await this.authManager.hasValidSession();

		if (hasSession) {
			// Get session from Supabase (has tokens and expiry)
			const session = await this.authManager.getSession();

			// Get user context (has email, userId, org/brief selection)
			const context = this.authManager.getContext();
			const contextStore = this.authManager.getStoredContext();

			console.log(chalk.green('✓ Authenticated'));
			console.log(chalk.gray(`  Email: ${contextStore?.email || 'N/A'}`));
			console.log(chalk.gray(`  User ID: ${contextStore?.userId || 'N/A'}`));
			console.log(chalk.gray(`  Token Type: standard`));

			// Display expiration info
			if (session?.expires_at) {
				const expiresAt = new Date(session.expires_at * 1000);
				const now = new Date();
				const timeRemaining = expiresAt.getTime() - now.getTime();
				const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
				const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));

				if (timeRemaining > 0) {
					// Token is still valid
					if (hoursRemaining > 0) {
						console.log(
							chalk.gray(
								`  Expires at: ${expiresAt.toLocaleString()} (${hoursRemaining} hours remaining)`
							)
						);
					} else {
						console.log(
							chalk.gray(
								`  Expires at: ${expiresAt.toLocaleString()} (${minutesRemaining} minutes remaining)`
							)
						);
					}
				} else {
					// Token has expired
					console.log(
						chalk.yellow(`  Expired at: ${expiresAt.toLocaleString()}`)
					);
				}
			}

			// Display context if available
			if (context) {
				console.log(chalk.gray('\n  Context:'));
				if (context.orgName) {
					console.log(chalk.gray(`    Organization: ${context.orgName}`));
				}
				if (context.briefName) {
					console.log(chalk.gray(`    Brief: ${context.briefName}`));
				}
			}

			// Build credentials for backward compatibility
			const credentials = {
				token: session?.access_token || '',
				refreshToken: session?.refresh_token,
				userId: contextStore?.userId || '',
				email: contextStore?.email,
				expiresAt: session?.expires_at
					? new Date(session.expires_at * 1000).toISOString()
					: undefined,
				tokenType: 'standard' as const,
				savedAt: contextStore?.lastUpdated || new Date().toISOString(),
				selectedContext: context || undefined
			};

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
	private async performInteractiveAuth(yes?: boolean): Promise<AuthResult> {
		ui.displayBanner('Task Master Authentication');
		const isAuthenticated = await this.authManager.hasValidSession();

		// Check if already authenticated (skip if --yes is used)
		if (isAuthenticated && !yes) {
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
				const credentials = await this.authManager.getAuthCredentials();
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

			// Post-auth: Set up workspace context (skip if --yes flag is used)
			if (!yes) {
				console.log(); // Add spacing
				try {
					const contextCommand = new ContextCommand();
					const contextResult = await contextCommand.setupContextInteractive();
					if (contextResult.success) {
						if (contextResult.orgSelected && contextResult.briefSelected) {
							console.log(
								chalk.green('✓ Workspace context configured successfully')
							);
						} else if (contextResult.orgSelected) {
							console.log(chalk.green('✓ Organization selected'));
						}
					} else {
						console.log(
							chalk.yellow('⚠ Context setup was skipped or encountered issues')
						);
						console.log(
							chalk.gray('  You can set up context later with "tm context"')
						);
					}
				} catch (contextError) {
					console.log(chalk.yellow('⚠ Context setup encountered an error'));
					console.log(
						chalk.gray('  You can set up context later with "tm context"')
					);
					if (process.env.DEBUG) {
						console.error(chalk.gray((contextError as Error).message));
					}
				}
			} else {
				console.log(
					chalk.gray(
						'\n  Skipped interactive setup. Use "tm context" to configure later.'
					)
				);
			}

			return {
				success: true,
				action: 'login',
				credentials,
				message: 'Authentication successful'
			};
		} catch (error) {
			displayError(error, { skipExit: true });

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
	 * Authenticate with token
	 */
	private async authenticateWithToken(token: string): Promise<AuthCredentials> {
		const spinner = ora('Verifying authentication token...').start();

		try {
			const credentials = await this.authManager.authenticateWithCode(token);
			spinner.succeed('Successfully authenticated!');
			return credentials;
		} catch (error) {
			spinner.fail('Authentication failed');
			throw error;
		}
	}

	/**
	 * Perform token-based authentication flow
	 */
	private async performTokenAuth(
		token: string,
		yes?: boolean
	): Promise<AuthResult> {
		ui.displayBanner('Task Master Authentication');

		try {
			// Authenticate with the token
			const credentials = await this.authenticateWithToken(token);

			ui.displaySuccess('Authentication successful!');
			console.log(
				chalk.gray(`  Logged in as: ${credentials.email || credentials.userId}`)
			);

			// Post-auth: Set up workspace context (skip if --yes flag is used)
			if (!yes) {
				console.log(); // Add spacing
				try {
					const contextCommand = new ContextCommand();
					const contextResult = await contextCommand.setupContextInteractive();
					if (contextResult.success) {
						if (contextResult.orgSelected && contextResult.briefSelected) {
							console.log(
								chalk.green('✓ Workspace context configured successfully')
							);
						} else if (contextResult.orgSelected) {
							console.log(chalk.green('✓ Organization selected'));
						}
					} else {
						console.log(
							chalk.yellow('⚠ Context setup was skipped or encountered issues')
						);
						console.log(
							chalk.gray('  You can set up context later with "tm context"')
						);
					}
				} catch (contextError) {
					console.log(chalk.yellow('⚠ Context setup encountered an error'));
					console.log(
						chalk.gray('  You can set up context later with "tm context"')
					);
					if (process.env.DEBUG) {
						console.error(chalk.gray((contextError as Error).message));
					}
				}
			} else {
				console.log(
					chalk.gray(
						'\n  Skipped interactive setup. Use "tm context" to configure later.'
					)
				);
			}

			return {
				success: true,
				action: 'login',
				credentials,
				message: 'Authentication successful'
			};
		} catch (error) {
			displayError(error, { skipExit: true });

			return {
				success: false,
				action: 'login',
				message: `Authentication failed: ${(error as Error).message}`
			};
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
	 * Get current credentials (for programmatic usage)
	 */
	async getCredentials(): Promise<AuthCredentials | null> {
		return this.authManager.getAuthCredentials();
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		// No resources to clean up for auth command
		// But keeping method for consistency with other commands
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): AuthCommand {
		const authCommand = new AuthCommand(name);
		program.addCommand(authCommand);
		return authCommand;
	}
}
