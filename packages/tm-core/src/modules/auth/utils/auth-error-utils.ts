/**
 * Shared authentication error utilities
 * These utilities are used by both tm-core (Supabase client) and CLI (error handler)
 */

import { isAuthError, type AuthError } from '@supabase/supabase-js';
import { AuthenticationError } from '../types.js';

/**
 * Check if an error is a Supabase auth error.
 * Uses Supabase's public isAuthError helper for stable identification.
 */
export function isSupabaseAuthError(
	error: unknown
): error is AuthError & { code?: string } {
	return isAuthError(error);
}

/**
 * User-friendly error messages for common Supabase auth error codes
 * Note: refresh_token_not_found and refresh_token_already_used are expected
 * during MFA flows and should not trigger these messages in that context.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
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
 * Error codes caused by stale sessions that can be recovered from
 * by clearing the session storage and retrying.
 *
 * These errors occur when there's a stale session with an invalid refresh token
 * and Supabase tries to use it during authentication. The fix is to clear
 * the stale session and retry the operation.
 */
export const RECOVERABLE_STALE_SESSION_ERRORS = [
	'refresh_token_not_found',
	'refresh_token_already_used'
] as const;

/**
 * Check if an error is caused by a stale session and can be recovered
 * by clearing the session storage and retrying.
 */
export function isRecoverableStaleSessionError(error: unknown): boolean {
	if (!isSupabaseAuthError(error)) return false;
	return RECOVERABLE_STALE_SESSION_ERRORS.includes(
		(error.code || '') as (typeof RECOVERABLE_STALE_SESSION_ERRORS)[number]
	);
}

/**
 * Convert a Supabase auth error to a user-friendly AuthenticationError
 */
export function toAuthenticationError(
	error: AuthError,
	defaultMessage: string
): AuthenticationError {
	const code = error.code;
	const userMessage = code
		? AUTH_ERROR_MESSAGES[code] || `${defaultMessage}: ${error.message}`
		: `${defaultMessage}: ${error.message}`;

	// Map Supabase error codes to our AuthErrorCode
	let authErrorCode:
		| 'REFRESH_FAILED'
		| 'NOT_AUTHENTICATED'
		| 'INVALID_CREDENTIALS' = 'REFRESH_FAILED';
	if (
		code === 'refresh_token_not_found' ||
		code === 'refresh_token_already_used' ||
		code === 'invalid_refresh_token' ||
		code === 'session_expired' ||
		code === 'user_not_found'
	) {
		authErrorCode = 'NOT_AUTHENTICATED';
	} else if (code === 'invalid_credentials') {
		authErrorCode = 'INVALID_CREDENTIALS';
	}

	return new AuthenticationError(userMessage, authErrorCode, error);
}
