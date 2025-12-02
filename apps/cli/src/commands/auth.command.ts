/**
 * @fileoverview Auth command using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import {
	type AuthCredentials,
	AuthManager,
	AuthenticationError
} from '@tm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { authenticateWithBrowserMFA, handleMFAFlow } from '../utils/auth-ui.js';
import { displayError } from '../utils/error-handler.js';
import * as ui from '../utils/ui.js';
import { ContextCommand } from './context.command.js';

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
			.option('--no-header', 'Suppress the Task Master header banner')
			.addHelpText(
				'after',
				`
Examples:
  $ tm auth login         # Browser-based OAuth flow (interactive)
  $ tm auth login <token> # Token-based authentication
  $ tm auth login <token> -y # Non-interactive token auth (for scripts)
                             # Note: MFA prompts cannot be skipped if enabled
`
			)
			.action(
				async (
					token?: string,
					options?: { yes?: boolean; header?: boolean }
				) => {
					await this.executeLogin(
						token,
						options?.yes,
						options?.header !== false
					);
				}
			);
	}

	/**
	 * Add logout subcommand
	 */
	private addLogoutCommand(): void {
		this.command('logout')
			.description('Logout and clear credentials')
			.option('--no-header', 'Suppress the Task Master header banner')
			.action(async (_options?: { header?: boolean }) => {
				await this.executeLogout();
			});
	}

	/**
	 * Add status subcommand
	 */
	private addStatusCommand(): void {
		this.command('status')
			.description('Display authentication status')
			.option('--no-header', 'Suppress the Task Master header banner')
			.action(async (_options?: { header?: boolean }) => {
				await this.executeStatus();
			});
	}

	/**
	 * Add refresh subcommand
	 */
	private addRefreshCommand(): void {
		this.command('refresh')
			.description('Refresh authentication token')
			.option('--no-header', 'Suppress the Task Master header banner')
			.action(async (_options?: { header?: boolean }) => {
				await this.executeRefresh();
			});
	}

	/**
	 * Handle authentication errors with proper type safety
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
	 * Execute login command
	 * Exported for reuse by login.command.ts
	 */
	async executeLogin(
		token?: string,
		yes?: boolean,
		showHeader = true
	): Promise<void> {
		try {
			const result = token
				? await this.performTokenAuth(token, yes, showHeader)
				: await this.performInteractiveAuth(yes, showHeader);
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}

			// Exit cleanly after successful authentication
			// Small delay to ensure all output is flushed
			setTimeout(() => {
				process.exit(0);
			}, 100);
		} catch (error) {
			this.handleAuthError(error);
		}
	}

	/**
	 * Execute logout command
	 * Exported for reuse by logout.command.ts
	 */
	async executeLogout(): Promise<void> {
		try {
			const result = await this.performLogout();
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error) {
			this.handleAuthError(error);
		}
	}

	/**
	 * Execute status command
	 */
	private async executeStatus(): Promise<void> {
		try {
			const result = await this.displayStatus();
			this.setLastResult(result);
		} catch (error) {
			this.handleAuthError(error);
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
		} catch (error) {
			this.handleAuthError(error);
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
	 * Exported for reuse by logout.command.ts
	 */
	async performLogout(): Promise<AuthResult> {
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
	 * Exported for reuse by login.command.ts
	 */
	async performInteractiveAuth(
		yes?: boolean,
		showHeader = true
	): Promise<AuthResult> {
		if (showHeader) {
			ui.displayBanner('Task Master Authentication');
		}
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

			// Display user info (auth success message is already shown by authenticateWithBrowserMFA)
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
							chalk.yellow('⚠️ Context setup was skipped or encountered issues')
						);
						console.log(
							chalk.gray('  You can set up context later with "tm context"')
						);
					}
				} catch (contextError) {
					console.log(chalk.yellow('⚠️ Context setup encountered an error'));
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
	 * Uses shared authenticateWithBrowserMFA for consistent login UX
	 * across all commands (auth login, parse-prd, export, etc.)
	 */
	private async authenticateWithBrowser(): Promise<AuthCredentials> {
		return authenticateWithBrowserMFA(this.authManager);
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
			// Check if MFA is required BEFORE showing failure message
			if (
				error instanceof AuthenticationError &&
				error.code === 'MFA_REQUIRED'
			) {
				// Stop spinner without showing failure - MFA is required, not a failure
				spinner.stop();

				if (!error.mfaChallenge?.factorId) {
					throw new AuthenticationError(
						'MFA challenge information missing',
						'MFA_VERIFICATION_FAILED'
					);
				}

				// Use shared MFA flow handler
				return this.handleMFAVerification(error);
			}

			// Only show "Authentication failed" for actual failures
			spinner.fail('Authentication failed');
			throw error;
		}
	}

	/**
	 * Handle MFA verification flow
	 * Uses shared MFA utilities from auth-ui.ts
	 */
	private async handleMFAVerification(
		mfaError: AuthenticationError
	): Promise<AuthCredentials> {
		if (!mfaError.mfaChallenge?.factorId) {
			throw new AuthenticationError(
				'MFA challenge information missing',
				'MFA_VERIFICATION_FAILED'
			);
		}

		return handleMFAFlow(
			this.authManager.verifyMFAWithRetry.bind(this.authManager),
			mfaError.mfaChallenge.factorId
		);
	}

	/**
	 * Perform token-based authentication flow
	 */
	private async performTokenAuth(
		token: string,
		yes?: boolean,
		showHeader = true
	): Promise<AuthResult> {
		if (showHeader) {
			ui.displayBanner('Task Master Authentication');
		}

		try {
			// Authenticate with the token
			const credentials = await this.authenticateWithToken(token);

			// Display user info (auth success message is already shown by authenticateWithToken spinner)
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
							chalk.yellow('⚠️ Context setup was skipped or encountered issues')
						);
						console.log(
							chalk.gray('  You can set up context later with "tm context"')
						);
					}
				} catch (contextError) {
					console.log(chalk.yellow('⚠️ Context setup encountered an error'));
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
