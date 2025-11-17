/**
 * @fileoverview Command guard for CLI commands
 * CLI presentation layer - uses tm-core for logic, displays with cardBox
 */

import chalk from 'chalk';
import { createTmCore, type TmCore } from '@tm/core';
import { displayCardBox } from '../ui/components/cardBox.component.js';

/**
 * Command-specific messaging configuration
 */
interface CommandMessage {
	header: string;
	getBody: (briefName: string) => string[];
	footer: string;
}

/**
 * Get command-specific message configuration
 */
function getCommandMessage(commandName: string): CommandMessage {
	// Dependency management commands
	if (
		[
			'add-dependency',
			'remove-dependency',
			'validate-dependencies',
			'fix-dependencies'
		].includes(commandName)
	) {
		return {
			header: 'Hamster Manages Dependencies',
			getBody: (briefName) => [
				`Hamster handles dependencies for the ${chalk.blue(`"${briefName}"`)} Brief.`,
				`To manage dependencies manually, log out with ${chalk.cyan('tm auth logout')} and work locally.`
			],
			footer:
				'Switch between local and remote workflows anytime by logging in/out.'
		};
	}

	// Subtask management commands
	if (commandName === 'clear-subtasks') {
		return {
			header: 'Hamster Manages Subtasks',
			getBody: (briefName) => [
				`Hamster handles subtask management for the ${chalk.blue(`"${briefName}"`)} Brief.`,
				`To manage subtasks manually, log out with ${chalk.cyan('tm auth logout')} and work locally.`
			],
			footer:
				'Switch between local and remote workflows anytime by logging in/out.'
		};
	}

	// Model configuration commands
	if (commandName === 'models') {
		return {
			header: 'Hamster Manages AI Models',
			getBody: (briefName) => [
				`Hamster configures AI models automatically for the ${chalk.blue(`"${briefName}"`)} Brief.`,
				`To configure models manually, log out with ${chalk.cyan('tm auth logout')} and work locally.`
			],
			footer:
				'Switch between local and remote workflows anytime by logging in/out.'
		};
	}

	// Default message for any other local-only commands
	return {
		header: 'Command Not Available in Hamster',
		getBody: (briefName) => [
			`The ${chalk.cyan(commandName)} command is managed by Hamster for the ${chalk.blue(`"${briefName}"`)} Brief.`,
			`To use this command, log out with ${chalk.cyan('tm auth logout')} and work locally.`
		],
		footer:
			'Switch between local and remote workflows anytime by logging in/out.'
	};
}

/**
 * Check if a command should be blocked when authenticated and display CLI message
 *
 * Use this for CLI commands that are only available for local file storage (not Hamster).
 * This uses tm-core's AuthDomain.guardCommand() and formats the result for CLI display.
 *
 * @param commandName - Name of the command being executed
 * @param tmCoreOrProjectRoot - TmCore instance or project root path
 * @returns true if command should be blocked, false otherwise
 *
 * @example
 * ```ts
 * const isBlocked = await checkAndBlockIfAuthenticated('add-dependency', projectRoot);
 * if (isBlocked) {
 *   process.exit(1);
 * }
 * ```
 */
export async function checkAndBlockIfAuthenticated(
	commandName: string,
	tmCoreOrProjectRoot: TmCore | string
): Promise<boolean> {
	// Get or create TmCore instance
	const tmCore =
		typeof tmCoreOrProjectRoot === 'string'
			? await createTmCore({ projectPath: tmCoreOrProjectRoot })
			: tmCoreOrProjectRoot;

	// Use tm-core's auth domain to check the command guard
	const result = await tmCore.auth.guardCommand(
		commandName,
		tmCore.tasks.getStorageType()
	);

	if (result.isBlocked) {
		// Get command-specific message configuration
		const message = getCommandMessage(commandName);
		const briefName = result.briefName || 'remote brief';

		// Format and display CLI message with cardBox
		console.log(
			displayCardBox({
				header: message.header,
				body: message.getBody(briefName),
				footer: message.footer,
				level: 'info'
			})
		);
		return true;
	}

	return false;
}

// Legacy export for backward compatibility
export const checkAndBlockDependencyCommand = checkAndBlockIfAuthenticated;
