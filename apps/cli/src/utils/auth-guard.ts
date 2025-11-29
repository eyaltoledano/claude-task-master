/**
 * @fileoverview Auth Guard Utility
 * Provides reusable authentication checking and OAuth flow triggering
 * for commands that require authentication.
 *
 * Includes MFA (Multi-Factor Authentication) support.
 */

import {
	AUTH_TIMEOUT_MS,
	type AuthCredentials,
	AuthDomain,
	AuthenticationError
} from '@tm/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import open from 'open';
import {
	AuthCountdownTimer,
	displayAuthInstructions,
	displayWaitingForAuth,
	handleMFAFlow
} from './auth-ui.js';

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
	const countdownTimer = new AuthCountdownTimer(AUTH_TIMEOUT_MS);

	try {
		const credentials = await authDomain.authenticateWithOAuth({
			// Callback to handle browser opening
			openBrowser: async (authUrl: string) => {
				await open(authUrl);
			},
			timeout: AUTH_TIMEOUT_MS,

			// Callback when auth URL is ready
			onAuthUrl: (authUrl: string) => {
				displayAuthInstructions(authUrl);
			},

			// Callback when waiting for authentication
			onWaitingForAuth: () => {
				displayWaitingForAuth();
				countdownTimer.start();
			},

			// Callback on success
			onSuccess: () => {
				countdownTimer.stop('success');
			},

			// Callback on error
			onError: () => {
				countdownTimer.stop('failure');
			}
		});

		return credentials;
	} catch (error: unknown) {
		// Check if MFA is required BEFORE showing failure message
		if (error instanceof AuthenticationError && error.code === 'MFA_REQUIRED') {
			// Stop spinner without showing failure - MFA is required, not a failure
			countdownTimer.stop('mfa');

			if (!error.mfaChallenge?.factorId) {
				throw new AuthenticationError(
					'MFA challenge information missing',
					'MFA_VERIFICATION_FAILED'
				);
			}

			// Use shared MFA flow handler
			return handleMFAFlow(
				authDomain.verifyMFAWithRetry.bind(authDomain),
				error.mfaChallenge.factorId
			);
		}

		countdownTimer.stop('failure');
		throw error;
	} finally {
		// Ensure cleanup
		countdownTimer.cleanup();
	}
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
