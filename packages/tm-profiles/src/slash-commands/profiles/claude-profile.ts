/**
 * @fileoverview Claude Code Profile
 * Slash command profile for Claude Code.
 *
 * Format:
 * ```
 * ${description}
 *
 * Arguments: $ARGUMENTS
 *
 * [content]
 * ```
 *
 * Location: .claude/commands/*.md
 */

import { BaseSlashCommandProfile } from './base-profile.js';
import type { SlashCommand, FormattedSlashCommand } from '../types.js';

/**
 * Claude Code profile for slash commands.
 *
 * Claude Code uses a simple format with the description as the first line,
 * followed by an optional "Arguments: $ARGUMENTS" line for dynamic commands,
 * then the main content.
 */
export class ClaudeProfile extends BaseSlashCommandProfile {
	readonly name = 'claude';
	readonly displayName = 'Claude Code';
	readonly commandsDir = '.claude/commands';
	readonly extension = '.md';

	format(command: SlashCommand): FormattedSlashCommand {
		const header = this.buildHeader(command);
		const content = this.transformArgumentPlaceholder(command.content);

		return {
			filename: this.getFilename(command.metadata.name),
			content: `${header}${content}`
		};
	}

	/**
	 * Build the header section for Claude Code format.
	 * Includes description and optional Arguments line.
	 */
	private buildHeader(command: SlashCommand): string {
		const lines = [command.metadata.description, ''];

		// Claude uses "Arguments: $ARGUMENTS" on second line for dynamic commands
		if (command.metadata.argumentHint) {
			lines.push('Arguments: $ARGUMENTS');
			lines.push('');
		}

		return lines.join('\n');
	}
}
