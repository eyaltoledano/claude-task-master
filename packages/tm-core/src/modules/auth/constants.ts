/**
 * @fileoverview Auth module constants
 */

/**
 * Authentication timeout in milliseconds (10 minutes)
 * This allows time for email confirmation during sign-up
 */
export const AUTH_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Maximum number of MFA verification attempts
 */
export const MFA_MAX_ATTEMPTS = 3;

/**
 * Commands that are only available for local file storage
 * These commands are blocked when using Hamster (API storage)
 */
export const LOCAL_ONLY_COMMANDS = [
	'add-dependency',
	'remove-dependency',
	'validate-dependencies',
	'fix-dependencies',
	'clear-subtasks',
	'models',
	'generate'
] as const;

export type LocalOnlyCommand = (typeof LOCAL_ONLY_COMMANDS)[number];
