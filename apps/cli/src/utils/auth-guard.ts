/**
 * @fileoverview Auth Guard Utility
 * Provides reusable authentication checking and OAuth flow triggering
 * for commands that require authentication.
 *
 * Includes MFA (Multi-Factor Authentication) support.
 */

import {
	AuthDomain,
	type AuthCredentials,
	AuthenticationError
} from '@tm/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import open from 'open';
import ora, { type Ora } from 'ora';
import * as ui from './ui.js';

/**
 * Options for the auth guard
 */
export interface AuthGuardOptions {
	/** Custom message to show when not authenticated */
	message?: string;
	/** Whether to skip the confirmation prompt and go straight to login */
	skipConfirmation?: boolean;
	/** Action name for the prompt (e.g., "export tasks", "view briefs") */
	actionName?: string;
}

/**
 * Result of the auth guard check
 */
export interface AuthGuardResult {
	/** Whether authentication succeeded */
	authenticated: boolean;
	/** The credentials if authenticated */
	credentials?: AuthCredentials;
	/** Whether the user cancelled the flow */
	cancelled?: boolean;
	/** Error message if auth failed */
	error?: string;
}

/**
 * Ensures the user is authenticated before proceeding with an action.
 * If not authenticated, prompts the user and triggers OAuth flow.
 * Supports MFA if enabled on the user's account.
 *
 * @param options - Auth guard options
 * @returns Promise resolving to auth guard result
 *
 * @example
 * ```typescript
 * const result = await ensureAuthenticated({
 *   actionName: 'export tasks'
 * });
 *
 * if (!result.authenticated) {
 *   if (result.cancelled) {
 *     console.log('Export cancelled');
 *   }
 *   return;
 * }
 *
 * // Proceed with authenticated action
 * await exportTasks();
 * ```
 */
export async function ensureAuthenticated(
	options: AuthGuardOptions = {}
): Promise<AuthGuardResult> {
	const authDomain = new AuthDomain();

	// Check if already authenticated
	const hasSession = await authDomain.hasValidSession();
	if (hasSession) {
		return { authenticated: true };
	}

	// Not authenticated - prompt user
	const actionName = options.actionName || 'continue';
	const message =
		options.message || `You're not logged in. Log in to ${actionName}?`;

	console.log('');
	console.log(chalk.yellow('🔒 Authentication Required'));
	console.log('');

	// Skip confirmation if requested
	if (!options.skipConfirmation) {
		const { shouldLogin } = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'shouldLogin',
				message,
				default: true
			}
		]);

		if (!shouldLogin) {
			return {
				authenticated: false,
				cancelled: true
			};
		}
	}

	// Trigger OAuth flow
	try {
		const credentials = await authenticateWithBrowser(authDomain);
		return {
			authenticated: true,
			credentials
		};
	} catch (error) {
		return {
			authenticated: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Authenticate with browser using OAuth 2.0 with PKCE
 * Includes MFA handling if the user has MFA enabled.
 */
async function authenticateWithBrowser(
	authDomain: AuthDomain
): Promise<AuthCredentials> {
	let authSpinner: Ora | null = null;

	try {
		const credentials = await authDomain.authenticateWithOAuth({
			// Callback to handle browser opening
			openBrowser: async (authUrl: string) => {
				await open(authUrl);
			},
			timeout: 5 * 60 * 1000, // 5 minutes

			// Callback when auth URL is ready
			onAuthUrl: (authUrl: string) => {
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
	} catch (error: unknown) {
		// Check if MFA is required BEFORE showing failure message
		if (error instanceof AuthenticationError && error.code === 'MFA_REQUIRED') {
			// Stop spinner without showing failure - MFA is required, not a failure
			if (authSpinner) {
				(authSpinner as Ora).stop();
			}

			// MFA is required - prompt the user for their MFA code
			return handleMFAVerification(authDomain, error);
		}

		throw error;
	}
}

/**
 * Handle MFA verification flow
 * Prompts user for 6-digit code and verifies with retry support
 */
async function handleMFAVerification(
	authDomain: AuthDomain,
	mfaError: AuthenticationError
): Promise<AuthCredentials> {
	if (!mfaError.mfaChallenge?.factorId) {
		throw new AuthenticationError(
			'MFA challenge information missing',
			'MFA_VERIFICATION_FAILED'
		);
	}

	const { factorId } = mfaError.mfaChallenge;

	console.log(
		chalk.yellow('\n⚠️  Multi-factor authentication is enabled on your account')
	);
	console.log(
		chalk.white('  Please enter the 6-digit code from your authenticator app\n')
	);

	// Use AuthDomain's retry logic - presentation layer just handles UI
	const result = await authDomain.verifyMFAWithRetry(
		factorId,
		async () => {
			// Prompt for MFA code
			try {
				const response = await inquirer.prompt([
					{
						type: 'input',
						name: 'mfaCode',
						message: 'Enter your 6-digit MFA code:',
						validate: (input: string) => {
							const trimmed = (input || '').trim();

							if (trimmed.length === 0) {
								return 'MFA code cannot be empty';
							}

							if (!/^\d{6}$/.test(trimmed)) {
								return 'MFA code must be exactly 6 digits (0-9)';
							}

							return true;
						}
					}
				]);

				return response.mfaCode.trim();
			} catch (error: any) {
				// Handle user cancellation (Ctrl+C)
				if (
					error.name === 'ExitPromptError' ||
					error.message?.includes('force closed')
				) {
					ui.displayWarning(' MFA verification cancelled by user');
					throw new AuthenticationError(
						'MFA verification cancelled',
						'MFA_VERIFICATION_FAILED'
					);
				}
				throw error;
			}
		},
		{
			maxAttempts: 3,
			onInvalidCode: (_attempt: number, remaining: number) => {
				// Callback invoked when invalid code is entered
				if (remaining > 0) {
					ui.displayError(`Invalid MFA code. Please try again.`);
				}
			}
		}
	);

	// Handle result from core
	if (result.success && result.credentials) {
		console.log(chalk.green('\n✓ MFA verification successful!'));
		return result.credentials;
	}

	// Show error with attempt count
	throw new AuthenticationError(
		`MFA verification failed after ${result.attemptsUsed} attempts`,
		'MFA_VERIFICATION_FAILED'
	);
}

/**
 * Higher-order function that wraps a command action with auth checking.
 * Use this to easily protect any command that requires authentication.
 * Includes MFA support.
 *
 * @param action - The action to execute after authentication
 * @param options - Auth guard options
 * @returns Wrapped action function
 *
 * @example
 * ```typescript
 * this.action(withAuth(async (options) => {
 *   // This only runs if authenticated
 *   await doProtectedAction(options);
 * }, { actionName: 'export tasks' }));
 * ```
 */
export function withAuth<T extends (...args: any[]) => Promise<void>>(
	action: T,
	options: AuthGuardOptions = {}
): T {
	return (async (...args: Parameters<T>) => {
		const result = await ensureAuthenticated(options);

		if (!result.authenticated) {
			if (result.cancelled) {
				console.log(chalk.yellow('\nOperation cancelled.\n'));
			} else if (result.error) {
				console.log(chalk.red(`\nAuthentication failed: ${result.error}\n`));
			}
			process.exit(1);
		}

		// User is now authenticated, proceed with action
		return action(...args);
	}) as T;
}
