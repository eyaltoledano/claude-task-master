/**
 * @fileoverview Auth module constants
 */

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
	'models'
] as const;

export type LocalOnlyCommand = (typeof LOCAL_ONLY_COMMANDS)[number];
