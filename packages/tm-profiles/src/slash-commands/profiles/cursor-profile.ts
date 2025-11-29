/**
 * @fileoverview Cursor Profile
 * Slash command profile for Cursor.
 *
 * Format:
 * ```
 * [content as-is]
 * ```
 *
 * Cursor uses plain markdown format with no header or transformation.
 *
 * Location: .cursor/commands/*.md
 */

import { BaseSlashCommandProfile } from './base-profile.js';
import type { SlashCommand, FormattedSlashCommand } from '../types.js';

/**
 * Cursor profile for slash commands.
 *
 * Cursor uses plain markdown format - commands are written as-is
 * without any header or transformation. The content is simply
 * passed through directly.
 */
export class CursorProfile extends BaseSlashCommandProfile {
	readonly name = 'cursor';
	readonly displayName = 'Cursor';
	readonly commandsDir = '.cursor/commands';
	readonly extension = '.md';

	format(command: SlashCommand): FormattedSlashCommand {
		return {
			filename: this.getFilename(command.metadata.name),
			content: command.content
		};
	}
}
