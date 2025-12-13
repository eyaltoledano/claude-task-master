/**
 * @fileoverview Base Slash Command Profile
 * Abstract base class for all slash command profiles.
 * Follows the same pattern as ai-providers/base-provider.js
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SlashCommand, FormattedSlashCommand } from '../types.js';
import { filterCommandsByMode } from '../commands/index.js';

/** Default namespace for TaskMaster commands */
export const TM_NAMESPACE = 'tm';

/**
 * Result of adding or removing slash commands
 */
export interface SlashCommandResult {
	/** Whether the operation was successful */
	success: boolean;
	/** Number of commands affected */
	count: number;
	/** Directory where commands were written/removed */
	directory: string;
	/** List of filenames affected */
	files: string[];
	/** Error message if operation failed */
	error?: string;
}

/**
 * Options for adding slash commands
 */
export interface AddSlashCommandsOptions {
	/**
	 * Operating mode to filter commands.
	 * - 'solo': Solo + common commands (for local file storage)
	 * - 'team': Team-only commands (exclusive, for Hamster cloud)
	 * - undefined: All commands (no filtering)
	 */
	mode?: 'solo' | 'team';
}

/**
 * Abstract base class for slash command profiles.
 *
 * Each profile encapsulates its own formatting logic, directory structure,
 * and any profile-specific transformations. This follows SOLID principles:
 * - Single Responsibility: Each profile handles only its own formatting
 * - Open/Closed: Add new profiles without modifying existing code
 * - Liskov Substitution: All profiles are interchangeable via base class
 * - Interface Segregation: Base class defines minimal interface
 * - Dependency Inversion: Consumers depend on abstraction, not concrete profiles
 *
 * @example
 * ```ts
 * import { CursorProfile } from '@tm/profiles';
 * import { allCommands } from '@tm/profiles';
 *
 * const cursor = new CursorProfile();
 * cursor.addSlashCommands('/path/to/project', allCommands);
 * ```
 */
export abstract class BaseSlashCommandProfile {
	/** Profile identifier (lowercase, e.g., 'claude', 'cursor') */
	abstract readonly name: string;

	/** Display name for UI/logging (e.g., 'Claude Code', 'Cursor') */
	abstract readonly displayName: string;

	/** Commands directory relative to project root (e.g., '.claude/commands') */
	abstract readonly commandsDir: string;

	/** File extension for command files (e.g., '.md') */
	abstract readonly extension: string;

	/**
	 * Whether this profile supports nested command directories.
	 * - true: Commands go in a subdirectory (e.g., `.claude/commands/tm/help.md`)
	 * - false: Commands use a prefix (e.g., `.opencode/command/tm-help.md`)
	 *
	 * Override in profiles that don't support nested directories.
	 */
	readonly supportsNestedCommands: boolean = true;

	/**
	 * Check if this profile supports slash commands.
	 * Profiles with empty commandsDir do not support commands.
	 */
	get supportsCommands(): boolean {
		return this.commandsDir !== '';
	}

	/**
	 * Format a single command for this profile.
	 * Each profile implements its own formatting logic.
	 *
	 * @param command - The slash command to format
	 * @returns Formatted command ready to write to file
	 */
	abstract format(command: SlashCommand): FormattedSlashCommand;

	/**
	 * Format all commands for this profile.
	 *
	 * @param commands - Array of slash commands to format
	 * @returns Array of formatted commands
	 */
	formatAll(commands: SlashCommand[]): FormattedSlashCommand[] {
		return commands.map((cmd) => this.format(cmd));
	}

	/**
	 * Get the full filename for a command.
	 * - Nested profiles: `commandName.md` (goes in tm/ subdirectory)
	 * - Flat profiles: `tm-commandName.md` (uses prefix)
	 *
	 * @param commandName - The command name (without extension)
	 * @returns Full filename with extension
	 */
	getFilename(commandName: string): string {
		if (this.supportsNestedCommands) {
			return `${commandName}${this.extension}`;
		}
		return `${TM_NAMESPACE}-${commandName}${this.extension}`;
	}

	/**
	 * Transform the argument placeholder if needed.
	 * Override in profiles that use different placeholder syntax.
	 *
	 * @param content - The command content
	 * @returns Content with transformed placeholders
	 */
	transformArgumentPlaceholder(content: string): string {
		return content; // Default: no transformation ($ARGUMENTS stays as-is)
	}

	/**
	 * Hook for additional post-processing after formatting.
	 * Override for profile-specific transformations.
	 *
	 * @param content - The formatted content
	 * @returns Post-processed content
	 */
	postProcess(content: string): string {
		return content;
	}

	/**
	 * Get the absolute path to the commands directory for a project.
	 * - Nested profiles: Returns `projectRoot/commandsDir/tm/`
	 * - Flat profiles: Returns `projectRoot/commandsDir/`
	 *
	 * @param projectRoot - Absolute path to the project root
	 * @returns Absolute path to the commands directory
	 */
	getCommandsPath(projectRoot: string): string {
		if (this.supportsNestedCommands) {
			return path.join(projectRoot, this.commandsDir, TM_NAMESPACE);
		}
		return path.join(projectRoot, this.commandsDir);
	}

	/**
	 * Add slash commands to a project.
	 *
	 * Formats and writes all provided commands to the profile's commands directory.
	 * Creates the directory if it doesn't exist.
	 *
	 * @param projectRoot - Absolute path to the project root
	 * @param commands - Array of slash commands to add
	 * @param options - Options including mode filtering
	 * @returns Result of the operation
	 *
	 * @example
	 * ```ts
	 * const cursor = new CursorProfile();
	 * // Add all commands
	 * const result = cursor.addSlashCommands('/path/to/project', allCommands);
	 *
	 * // Add only solo mode commands
	 * const soloResult = cursor.addSlashCommands('/path/to/project', allCommands, { mode: 'solo' });
	 *
	 * // Add only team mode commands (exclusive)
	 * const teamResult = cursor.addSlashCommands('/path/to/project', allCommands, { mode: 'team' });
	 * ```
	 */
	addSlashCommands(
		projectRoot: string,
		commands: SlashCommand[],
		options?: AddSlashCommandsOptions
	): SlashCommandResult {
		const commandsPath = this.getCommandsPath(projectRoot);
		const files: string[] = [];

		if (!this.supportsCommands) {
			return {
				success: false,
				count: 0,
				directory: commandsPath,
				files: [],
				error: `Profile "${this.name}" does not support slash commands`
			};
		}

		try {
			// When mode is specified, first remove ALL existing TaskMaster commands
			// to ensure clean slate (prevents orphaned commands when switching modes)
			if (options?.mode) {
				this.removeSlashCommands(projectRoot, commands, false);
			}

			// Filter commands by mode if specified
			const filteredCommands = options?.mode
				? filterCommandsByMode(commands, options.mode)
				: commands;

			// Ensure directory exists
			if (!fs.existsSync(commandsPath)) {
				fs.mkdirSync(commandsPath, { recursive: true });
			}

			// Format and write each command
			const formatted = this.formatAll(filteredCommands);
			for (const output of formatted) {
				const filePath = path.join(commandsPath, output.filename);
				fs.writeFileSync(filePath, output.content);
				files.push(output.filename);
			}

			return {
				success: true,
				count: files.length,
				directory: commandsPath,
				files
			};
		} catch (err) {
			return {
				success: false,
				count: 0,
				directory: commandsPath,
				files: [],
				error: err instanceof Error ? err.message : String(err)
			};
		}
	}

	/**
	 * Remove slash commands from a project.
	 *
	 * Removes only the commands that match the provided command names.
	 * Preserves user's custom commands that are not in the list.
	 * Optionally removes the directory if empty after removal.
	 *
	 * @param projectRoot - Absolute path to the project root
	 * @param commands - Array of slash commands to remove (matches by name)
	 * @param removeEmptyDir - Whether to remove the directory if empty (default: true)
	 * @returns Result of the operation
	 *
	 * @example
	 * ```ts
	 * const cursor = new CursorProfile();
	 * const result = cursor.removeSlashCommands('/path/to/project', allCommands);
	 * console.log(`Removed ${result.count} commands`);
	 * ```
	 */
	removeSlashCommands(
		projectRoot: string,
		commands: SlashCommand[],
		removeEmptyDir: boolean = true
	): SlashCommandResult {
		const commandsPath = this.getCommandsPath(projectRoot);
		const files: string[] = [];

		if (!this.supportsCommands) {
			return {
				success: false,
				count: 0,
				directory: commandsPath,
				files: [],
				error: `Profile "${this.name}" does not support slash commands`
			};
		}

		if (!fs.existsSync(commandsPath)) {
			return {
				success: true,
				count: 0,
				directory: commandsPath,
				files: []
			};
		}

		try {
			// Get command names to remove (with appropriate prefix for flat profiles)
			const commandNames = new Set(
				commands.map((cmd) => {
					const name = cmd.metadata.name.toLowerCase();
					// For flat profiles, filenames have tm- prefix
					return this.supportsNestedCommands ? name : `${TM_NAMESPACE}-${name}`;
				})
			);

			// Get all files in directory
			const existingFiles = fs.readdirSync(commandsPath);

			for (const file of existingFiles) {
				const baseName = path.basename(file, path.extname(file)).toLowerCase();

				// Only remove files that match our command names
				if (commandNames.has(baseName)) {
					const filePath = path.join(commandsPath, file);
					fs.rmSync(filePath, { force: true });
					files.push(file);
				}
			}

			// Remove directory if empty and requested
			if (removeEmptyDir) {
				const remainingFiles = fs.readdirSync(commandsPath);
				if (remainingFiles.length === 0) {
					fs.rmSync(commandsPath, { recursive: true, force: true });
				}
			}

			return {
				success: true,
				count: files.length,
				directory: commandsPath,
				files
			};
		} catch (err) {
			return {
				success: false,
				count: files.length,
				directory: commandsPath,
				files,
				error: err instanceof Error ? err.message : String(err)
			};
		}
	}

	/**
	 * Replace slash commands for a new operating mode.
	 *
	 * Removes all existing TaskMaster commands and adds commands for the new mode.
	 * This is useful when switching between solo and team modes.
	 *
	 * @param projectRoot - Absolute path to the project root
	 * @param commands - Array of all slash commands (will be filtered by mode)
	 * @param newMode - The new operating mode to switch to
	 * @returns Result of the operation
	 *
	 * @example
	 * ```ts
	 * const cursor = new CursorProfile();
	 * // Switch from solo to team mode
	 * const result = cursor.replaceSlashCommands('/path/to/project', allCommands, 'team');
	 * ```
	 */
	replaceSlashCommands(
		projectRoot: string,
		commands: SlashCommand[],
		newMode: 'solo' | 'team'
	): SlashCommandResult {
		// Remove all existing TaskMaster commands
		const removeResult = this.removeSlashCommands(projectRoot, commands);
		if (!removeResult.success) {
			return removeResult;
		}

		// Add commands for the new mode
		return this.addSlashCommands(projectRoot, commands, { mode: newMode });
	}
}
