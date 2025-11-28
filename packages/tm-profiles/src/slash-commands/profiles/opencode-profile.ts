/**
 * @fileoverview OpenCode Profile
 * Slash command profile for OpenCode.
 *
 * Format:
 * ```
 * ---
 * description: "..."
 * ---
 * [content]
 * ```
 *
 * OpenCode uses YAML frontmatter format with description field.
 * Additional fields (agent, model, subtask) are optional.
 *
 * Location: .opencode/command/*.md (note: singular "command", not "commands")
 */

import type { FormattedSlashCommand, SlashCommand } from '../types.js';
import { BaseSlashCommandProfile } from './base-profile.js';

/**
 * OpenCode profile for slash commands.
 *
 * OpenCode uses YAML frontmatter for command metadata:
 * - description: Short description for the command picker
 * - agent (optional): Which agent should handle this command
 * - model (optional): Override model for this command
 * - subtask (optional): Whether to run as a subtask
 *
 * Supports $ARGUMENTS and positional args ($1, $2, etc.) placeholders.
 */
export class OpenCodeProfile extends BaseSlashCommandProfile {
	readonly name = 'opencode';
	readonly displayName = 'OpenCode';
	readonly commandsDir = '.opencode/command';
	readonly extension = '.md';
	readonly supportsNestedCommands = false;

	format(command: SlashCommand): FormattedSlashCommand {
		const frontmatter = this.buildFrontmatter(command);
		const content = this.transformArgumentPlaceholder(command.content);

		return {
			filename: this.getFilename(command.metadata.name),
			content: `${frontmatter}${content}`
		};
	}

	/**
	 * Build YAML frontmatter for OpenCode format.
	 * Includes description (required).
	 */
	private buildFrontmatter(command: SlashCommand): string {
		const lines = [
			'---',
			`description: ${command.metadata.description}`,
			'---',
			''
		];
		return lines.join('\n');
	}
}
