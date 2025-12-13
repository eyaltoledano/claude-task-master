/**
 * @fileoverview Codex Profile
 * Slash command profile for OpenAI Codex CLI.
 *
 * Format:
 * ```
 * ---
 * description: "..."
 * argument-hint: "..."
 * ---
 * [content]
 * ```
 *
 * Location: ~/.codex/prompts/*.md (user's home directory)
 *
 * Note: Unlike other profiles, Codex stores prompts in the user's home directory,
 * not project-relative. This is how Codex CLI discovers custom prompts.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { BaseSlashCommandProfile } from './base-profile.js';
import type { SlashCommand, FormattedSlashCommand } from '../types.js';

/**
 * Options for CodexProfile constructor.
 */
export interface CodexProfileOptions {
	/**
	 * Override the home directory path.
	 * Used primarily for testing to avoid modifying the real home directory.
	 * If not provided, uses os.homedir().
	 */
	homeDir?: string;
}

/**
 * Codex CLI profile for slash commands.
 *
 * Codex uses YAML frontmatter format with description and optional argument-hint.
 */
export class CodexProfile extends BaseSlashCommandProfile {
	readonly name = 'codex';
	readonly displayName = 'Codex';
	readonly commandsDir = '.codex/prompts';
	readonly extension = '.md';
	readonly supportsNestedCommands = false;

	/**
	 * Whether this profile uses the user's home directory instead of project root.
	 * Codex CLI reads prompts from ~/.codex/prompts, not project-relative paths.
	 */
	readonly isHomeRelative = true;

	/**
	 * The home directory to use for command paths.
	 * Defaults to os.homedir() but can be overridden for testing.
	 */
	private readonly homeDir: string;

	constructor(options?: CodexProfileOptions) {
		super();
		this.homeDir = options?.homeDir ?? os.homedir();
	}

	/**
	 * Override to return home directory path instead of project-relative path.
	 * Codex CLI reads prompts from ~/.codex/prompts.
	 *
	 * @param _projectRoot - Ignored for Codex (uses home directory)
	 * @returns Absolute path to ~/.codex/prompts
	 */
	override getCommandsPath(_projectRoot: string): string {
		return path.join(this.homeDir, this.commandsDir);
	}

	format(command: SlashCommand): FormattedSlashCommand {
		const frontmatter = this.buildFrontmatter(command);

		return {
			filename: this.getFilename(command.metadata.name),
			content: `${frontmatter}${command.content}`
		};
	}

	private buildFrontmatter(command: SlashCommand): string {
		const escapeQuotes = (str: string): string => str.replace(/"/g, '\\"');
		const lines = [
			'---',
			`description: "${escapeQuotes(command.metadata.description)}"`
		];

		// Include argument-hint if present
		if (command.metadata.argumentHint) {
			lines.push(
				`argument-hint: "${escapeQuotes(command.metadata.argumentHint)}"`
			);
		}

		lines.push('---', '');
		return lines.join('\n');
	}
}
