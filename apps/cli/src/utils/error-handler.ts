/**
 * @fileoverview Centralized error handling utilities for CLI
 * Provides consistent error formatting and debug mode detection
 */

import chalk from 'chalk';

/**
 * Check if debug mode is enabled via environment variable
 * Only returns true when DEBUG is explicitly set to 'true' or '1'
 *
 * @returns True if debug mode is enabled
 */
export function isDebugMode(): boolean {
	return process.env.DEBUG === 'true' || process.env.DEBUG === '1';
}

/**
 * Display an error to the user with optional stack trace in debug mode
 * Handles both TaskMasterError instances and regular errors
 *
 * @param error - The error to display
 * @param options - Display options
 */
export function displayError(
	error: any,
	options: {
		/** Skip exit, useful when caller wants to handle exit */
		skipExit?: boolean;
		/** Force show stack trace regardless of debug mode */
		forceStack?: boolean;
	} = {}
): void {
	// Check if it's a TaskMasterError with sanitized details
	if (error?.getSanitizedDetails) {
		const sanitized = error.getSanitizedDetails();
		console.error(chalk.red(`\n${sanitized.message}`));

		// Show stack trace in debug mode or if forced
		if ((isDebugMode() || options.forceStack) && error.stack) {
			console.error(chalk.gray('\nStack trace:'));
			console.error(chalk.gray(error.stack));
		}
	} else {
		// For other errors, show the message
		const message = error?.message ?? String(error);
		console.error(chalk.red(`\nError: ${message}`));

		// Show stack trace in debug mode or if forced
		if ((isDebugMode() || options.forceStack) && error?.stack) {
			console.error(chalk.gray('\nStack trace:'));
			console.error(chalk.gray(error.stack));
		}
	}

	// Exit if not skipped
	if (!options.skipExit) {
		process.exit(1);
	}
}
