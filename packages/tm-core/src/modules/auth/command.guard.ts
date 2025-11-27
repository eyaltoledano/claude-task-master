/**
 * @fileoverview Command guard - Core logic for blocking local-only commands
 * Pure business logic - no presentation layer concerns
 */

import type { StorageType } from '../../common/types/index.js';
import { LOCAL_ONLY_COMMANDS, type LocalOnlyCommand } from './constants.js';

/**
 * Result from checking if a command should be blocked
 */
export interface AuthBlockResult {
	/** Whether the command should be blocked */
	isBlocked: boolean;
	/** Brief name if authenticated with Hamster */
	briefName?: string;
	/** Command name that was checked */
	commandName: string;
}

/**
 * Check if a command is local-only
 */
export function isLocalOnlyCommand(
	commandName: string
): commandName is LocalOnlyCommand {
	return LOCAL_ONLY_COMMANDS.includes(commandName as LocalOnlyCommand);
}

/**
 * Parameters for auth block check
 */
export interface AuthBlockParams {
	/** Whether user has a valid auth session */
	hasValidSession: boolean;
	/** Brief name from auth context */
	briefName?: string;
	/** Current storage type being used */
	storageType: StorageType;
	/** Command name to check */
	commandName: string;
}

/**
 * Check if a command should be blocked because user is authenticated with Hamster
 *
 * This is pure business logic with dependency injection - returns data only, no display/formatting
 * Presentation layers (CLI, MCP) should format the response appropriately
 *
 * @param params - Auth block parameters
 * @returns AuthBlockResult with blocking decision and context
 */
export function checkAuthBlock(params: AuthBlockParams): AuthBlockResult {
	const { hasValidSession, briefName, storageType, commandName } = params;

	// Only check auth for local-only commands
	if (!isLocalOnlyCommand(commandName)) {
		return { isBlocked: false, commandName };
	}

	// Not authenticated - command is allowed
	if (!hasValidSession) {
		return { isBlocked: false, commandName };
	}

	// Authenticated but using file storage - command is allowed
	if (storageType !== 'api') {
		return { isBlocked: false, commandName };
	}

	// User is authenticated AND using API storage - block the command
	return {
		isBlocked: true,
		briefName: briefName || 'remote brief',
		commandName
	};
}
