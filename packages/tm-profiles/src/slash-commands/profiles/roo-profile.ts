/**
 * @fileoverview Roo Code Profile
 * Slash command profile for Roo Code.
 *
 * Format:
 * ```
 * ---
 * description: Short description for command picker
 * argument-hint: <optional-hint>
 * ---
 *
 * [content]
 * ```
 *
 * Roo Code uses YAML frontmatter for metadata, similar to other markdown-based tools.
 * The frontmatter contains a description (required) and optional argument-hint.
 *
 * Location: .roo/commands/*.md
 */

import { BaseSlashCommandProfile } from './base-profile.js';
import type { SlashCommand, FormattedSlashCommand } from '../types.js';

/**
 * Roo Code profile for slash commands.
 *
 * Roo Code uses YAML frontmatter for command metadata:
 * - description: Appears in the command menu to help users understand the command's purpose
 * - argument-hint: Optional hint about expected arguments when using the command
 *
 * The content follows the frontmatter and supports $ARGUMENTS placeholders.
 */
export class RooProfile extends BaseSlashCommandProfile {
	readonly name = 'roo';
	readonly displayName = 'Roo Code';
	readonly commandsDir = '.roo/commands';
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
	 * Build YAML frontmatter for Roo Code format.
	 * Includes description (required) and optional argument-hint.
	 * Adds a blank line after the closing --- for proper markdown separation.
	 */
	private buildFrontmatter(command: SlashCommand): string {
		const lines = ['---', `description: ${command.metadata.description}`];

		if (command.metadata.argumentHint) {
			lines.push(`argument-hint: ${command.metadata.argumentHint}`);
		}

		// Add closing --- and two empty strings to produce "---\n\n" (blank line before content)
		lines.push('---', '', '');

		return lines.join('\n');
	}
}
