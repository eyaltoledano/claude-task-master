/**
 * @fileoverview Auth Guard Utility
 * Provides reusable authentication checking and OAuth flow triggering
 * for commands that require authentication.
 *
 * Uses the shared authenticateWithBrowserMFA utility for consistent
 * login UX across all commands (auth login, parse-prd, export, etc.)
 *
 * After successful authentication, ensures org selection is completed.
 */

import { type AuthCredentials, AuthDomain, AuthManager } from '@tm/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { authenticateWithBrowserMFA } from './auth-ui.js';
import { ensureOrgSelected } from './org-selection.js';

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
		// Only get AuthManager when we need to check org selection
		const authManager = AuthManager.getInstance();

		// Check if org is already selected (quick check before any API calls)
		const context = authManager.getContext();
		if (context?.orgId) {
			// Org already selected, return immediately without further API calls
			return { authenticated: true };
		}

		// Org not selected, need to prompt
		const orgResult = await ensureOrgSelected(authManager, {
			promptMessage: 'Select an organization to continue:'
		});

		if (!orgResult.success) {
			return {
				authenticated: true,
				error: orgResult.message || 'Organization selection required'
			};
		}

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

	// Trigger OAuth flow using shared browser auth with MFA support
	try {
		const credentials = await authenticateWithBrowserMFA(authDomain);

		// Display user info (auth success message is already shown by authenticateWithBrowserMFA)
		if (credentials.email) {
			console.log(chalk.gray(`  Logged in as: ${credentials.email}`));
		}
		console.log('');

		// After successful authentication, ensure org is selected
		// This is REQUIRED for all Hamster operations
		const authManager = AuthManager.getInstance();
		const orgResult = await ensureOrgSelected(authManager, {
			promptMessage: 'Select an organization to continue:'
		});

		if (!orgResult.success) {
			return {
				authenticated: true, // Auth succeeded, but org selection failed
				credentials,
				error: orgResult.message || 'Organization selection required'
			};
		}

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
