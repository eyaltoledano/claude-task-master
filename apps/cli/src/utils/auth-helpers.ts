/**
 * @fileoverview Authentication helpers for CLI commands
 */

import type { AuthManager } from '@tm/core';
import { displayCardBox } from '../ui/components/cardBox.component.js';

/**
 * Options for authentication check
 */
export interface CheckAuthOptions {
	/** Custom message describing what requires authentication (defaults to generic message) */
	message?: string;
	/** Optional footer text (e.g., alternative local commands) */
	footer?: string;
	/** Command to run to authenticate (defaults to "tm auth login") */
	authCommand?: string;
}

/**
 * Check if user is authenticated and display a friendly card box if not.
 * Used by commands that require Hamster authentication (briefs, context, etc.)
 *
 * @param authManager - AuthManager instance
 * @param options - Optional customization for the authentication prompt
 * @returns true if authenticated, false if not
 *
 * @example
 * ```typescript
 * const isAuthenticated = await checkAuthentication(authManager, {
 *   message: 'The "briefs" command requires you to be logged in to your Hamster account.',
 *   footer: 'Working locally instead?\n  → Use "tm tags" for local tag management.'
 * });
 *
 * if (!isAuthenticated) {
 *   process.exit(1);
 * }
 * ```
 */
export async function checkAuthentication(
	authManager: AuthManager,
	options: CheckAuthOptions = {}
): Promise<boolean> {
	const hasSession = await authManager.hasValidSession();

	if (!hasSession) {
		const {
			message = 'This command requires you to be logged in to your Hamster account.',
			footer,
			authCommand = 'tm auth login'
		} = options;

		console.log(
			displayCardBox({
				header: '[!] Not logged in to Hamster',
				body: [message],
				callToAction: {
					label: 'To get started:',
					action: authCommand
				},
				footer
			})
		);
		return false;
	}

	return true;
}
