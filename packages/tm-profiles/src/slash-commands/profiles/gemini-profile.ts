/**
 * @fileoverview Gemini CLI Profile
 * Slash command profile for Google Gemini CLI.
 *
 * Format:
 * ```
 * description="..."
 * prompt = """
 * [content]
 * """
 * ```
 *
 * Location: .gemini/commands/*.toml
 */

import { BaseSlashCommandProfile } from './base-profile.js';
import type { SlashCommand, FormattedSlashCommand } from '../types.js';

/**
 * Gemini CLI profile for slash commands.
 *
 * Gemini uses a Python-style format with description and prompt fields.
 * The prompt content is wrapped in triple quotes.
 */
export class GeminiProfile extends BaseSlashCommandProfile {
	readonly name = 'gemini';
	readonly displayName = 'Gemini';
	readonly commandsDir = '.gemini/commands';
	readonly extension = '.toml';

	format(command: SlashCommand): FormattedSlashCommand {
		const description = this.escapeForPython(command.metadata.description);
		const content = this.escapeForTripleQuotedString(command.content.trim());

		return {
			filename: this.getFilename(command.metadata.name),
			content: `description="${description}"
prompt = """
${content}
"""
`
		};
	}

	/**
	 * Escape double quotes for Python string literals.
	 */
	private escapeForPython(str: string): string {
		return str.replace(/"/g, '\\"');
	}

	/**
	 * Escape content for use inside triple-quoted strings.
	 * Prevents `"""` sequences from breaking the TOML delimiter.
	 */
	private escapeForTripleQuotedString(str: string): string {
		return str.replace(/"""/g, '""\\"');
	}
}
