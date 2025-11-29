/**
 * Slash Command Profiles Index
 *
 * This module exports all slash command profile classes and provides
 * utility functions for profile lookup and management.
 *
 * Supported profiles (with slash commands):
 * - Claude Code: .claude/commands
 * - Cursor: .cursor/commands
 * - Roo Code: .roo/commands
 * - Gemini: .gemini/commands
 * - Codex: .codex/prompts
 * - OpenCode: .opencode/command
 */

// Base profile class and types
import { BaseSlashCommandProfile } from './base-profile.js';
export type { SlashCommandResult } from './base-profile.js';

// Individual profile classes
import { ClaudeProfile } from './claude-profile.js';
import { CodexProfile } from './codex-profile.js';
import { CursorProfile } from './cursor-profile.js';
import { GeminiProfile } from './gemini-profile.js';
import { OpenCodeProfile } from './opencode-profile.js';
import { RooProfile } from './roo-profile.js';

// Re-export base class and all profile classes for direct use
export { BaseSlashCommandProfile };
export { ClaudeProfile };
export { CodexProfile };
export type { CodexProfileOptions } from './codex-profile.js';
export { CursorProfile };
export { GeminiProfile };
export { OpenCodeProfile };
export { RooProfile };

/**
 * Singleton instances of all available slash command profiles.
 * Keys are lowercase profile names for case-insensitive lookup.
 */
const profiles: Record<string, BaseSlashCommandProfile> = {
	claude: new ClaudeProfile(),
	codex: new CodexProfile(),
	cursor: new CursorProfile(),
	gemini: new GeminiProfile(),
	opencode: new OpenCodeProfile(),
	roo: new RooProfile()
};

/**
 * Get a slash command profile by name.
 *
 * @param name - The profile name (case-insensitive)
 * @returns The profile instance if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const claudeProfile = getProfile('claude');
 * const cursorProfile = getProfile('CURSOR'); // Case-insensitive
 * ```
 */
export function getProfile(name: string): BaseSlashCommandProfile | undefined {
	return profiles[name.toLowerCase()];
}

/**
 * Get all available slash command profiles.
 *
 * @returns Array of all profile instances
 *
 * @example
 * ```typescript
 * const allProfiles = getAllProfiles();
 * allProfiles.forEach(profile => {
 *   console.log(profile.name, profile.commandsDir);
 * });
 * ```
 */
export function getAllProfiles(): BaseSlashCommandProfile[] {
	return Object.values(profiles);
}

/**
 * Get all available profile names.
 *
 * @returns Array of profile names (lowercase)
 *
 * @example
 * ```typescript
 * const names = getProfileNames();
 * // ['claude', 'cursor', 'roo', 'gemini']
 * ```
 */
export function getProfileNames(): string[] {
	return Object.keys(profiles);
}
