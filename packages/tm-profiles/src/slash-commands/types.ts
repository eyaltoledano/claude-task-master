/**
 * @fileoverview Slash Command Type Definitions
 * Uses discriminated unions for type-safe static vs dynamic commands.
 */

/**
 * Operating mode for Task Master
 * - 'solo': Local file-based storage (Taskmaster standalone)
 * - 'team': API-based storage via Hamster (collaborative features)
 * - 'common': Works in both modes
 */
export type OperatingMode = 'solo' | 'team' | 'common';

/**
 * Base metadata shared by all slash commands
 */
export interface SlashCommandMetadata {
	/** Command name (filename without extension) */
	readonly name: string;
	/** Short description shown in command picker */
	readonly description: string;
	/** Optional hint for arguments (e.g., "[brief-url]") */
	readonly argumentHint?: string;
	/** Operating mode - defaults to 'common' if not specified */
	readonly mode?: OperatingMode;
}

/**
 * A static slash command with fixed content (no $ARGUMENTS placeholder)
 * May still have an argumentHint for documentation purposes
 */
export interface StaticSlashCommand {
	readonly type: 'static';
	readonly metadata: SlashCommandMetadata;
	/** The markdown content */
	readonly content: string;
}

/**
 * A dynamic slash command that accepts arguments via $ARGUMENTS placeholder
 */
export interface DynamicSlashCommand {
	readonly type: 'dynamic';
	readonly metadata: SlashCommandMetadata & {
		/** Hint for arguments - required for dynamic commands */
		readonly argumentHint: string;
	};
	/** The markdown content containing $ARGUMENTS placeholder(s) */
	readonly content: string;
}

/**
 * Union type for all slash commands
 * Use `command.type` to narrow the type
 */
export type SlashCommand = StaticSlashCommand | DynamicSlashCommand;

/**
 * Formatted command output ready to be written to file
 */
export interface FormattedSlashCommand {
	/** Filename (e.g., "goham.md") */
	readonly filename: string;
	/** Formatted content for the target editor */
	readonly content: string;
}
