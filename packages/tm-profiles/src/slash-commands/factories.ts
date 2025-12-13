/**
 * @fileoverview Factory Functions for Slash Commands
 * Simple functions to create type-safe slash command objects.
 */

import type {
	StaticSlashCommand,
	DynamicSlashCommand,
	OperatingMode
} from './types.js';

/**
 * Options for creating a static slash command
 */
export interface StaticCommandOptions {
	name: string;
	description: string;
	content: string;
	/** Optional argument hint for documentation (command doesn't use $ARGUMENTS) */
	argumentHint?: string;
	/** Operating mode - defaults to 'common' */
	mode?: OperatingMode;
}

/**
 * Create a static slash command (no $ARGUMENTS placeholder)
 *
 * @example
 * ```ts
 * // Simple static command
 * const help = staticCommand({
 *   name: 'help',
 *   description: 'Show available commands',
 *   content: '# Help\n\nList of commands...'
 * });
 *
 * // Static command with optional argument hint
 * const goham = staticCommand({
 *   name: 'goham',
 *   description: 'Start Working with Hamster Brief',
 *   argumentHint: '[brief-url]',
 *   content: '# Start Working...'
 * });
 * ```
 */
export function staticCommand(
	options: StaticCommandOptions
): StaticSlashCommand {
	const { name, description, content, argumentHint, mode } = options;
	return {
		type: 'static',
		metadata: {
			name,
			description,
			...(argumentHint && { argumentHint }),
			...(mode && { mode })
		},
		content
	};
}

/**
 * Create a dynamic slash command that accepts arguments
 *
 * The content must contain at least one `$ARGUMENTS` placeholder.
 *
 * @example
 * ```ts
 * const goham = dynamicCommand(
 *   'goham',
 *   'Start Working with Hamster Brief',
 *   '[brief-url]',
 *   '# Start Working\n\nBrief URL: $ARGUMENTS'
 * );
 * ```
 *
 * @throws Error if content doesn't contain $ARGUMENTS placeholder
 */
export function dynamicCommand(
	name: string,
	description: string,
	argumentHint: string,
	content: string,
	mode?: OperatingMode
): DynamicSlashCommand {
	if (!content.includes('$ARGUMENTS')) {
		throw new Error(
			`Dynamic slash command "${name}" must contain $ARGUMENTS placeholder`
		);
	}

	return {
		type: 'dynamic',
		metadata: {
			name,
			description,
			argumentHint,
			...(mode && { mode })
		},
		content
	};
}
