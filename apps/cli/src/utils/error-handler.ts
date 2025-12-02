/**
 * @fileoverview Centralized error handling utilities for CLI
 * Provides consistent error formatting and debug mode detection
 */

import { AuthenticationError } from '@tm/core';
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
 * Check if an error is a Supabase auth error
 * These have __isAuthError: true and a code property
 */
function isSupabaseAuthError(
	error: unknown
): error is Error & { code?: string; status?: number } {
	return (
		typeof error === 'object' &&
		error !== null &&
		'__isAuthError' in error &&
		(error as Record<string, unknown>).__isAuthError === true
	);
}

/**
 * User-friendly error messages for common Supabase auth error codes
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
	refresh_token_not_found:
		'Your session has expired. Please log in again with: task-master login',
	refresh_token_already_used:
		'Your session has expired (token was already used). Please log in again with: task-master login',
	invalid_refresh_token:
		'Your session has expired (invalid token). Please log in again with: task-master login',
	session_expired:
		'Your session has expired. Please log in again with: task-master login',
	user_not_found:
		'User account not found. Please log in again with: task-master login',
	invalid_credentials:
		'Invalid credentials. Please log in again with: task-master login'
};

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
	} else if (error instanceof AuthenticationError) {
		// Handle AuthenticationError with clean message (no "Error:" prefix)
		console.error(chalk.red(`\n${error.message}`));

		// Show stack trace in debug mode or if forced
		if ((isDebugMode() || options.forceStack) && error.stack) {
			console.error(chalk.gray('\nStack trace:'));
			console.error(chalk.gray(error.stack));
		}
	} else if (isSupabaseAuthError(error)) {
		// Handle raw Supabase auth errors with user-friendly messages
		const code = error.code;
		const userMessage = code
			? AUTH_ERROR_MESSAGES[code] || error.message
			: error.message;
		console.error(chalk.red(`\n${userMessage}`));

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
