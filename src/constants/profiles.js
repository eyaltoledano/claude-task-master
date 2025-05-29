/**
 * @typedef {'claude' | 'cline' | 'codex' | 'cursor' | 'roo' | 'trae' | 'windsurf'} RulesProfile
 */

/**
 * Available rule profiles for project initialization and rules command
 *
 * ⚠️  SINGLE SOURCE OF TRUTH: This is the authoritative list of all supported rule profiles.
 * This constant is used directly throughout the codebase (previously aliased as PROFILE_NAMES).
 *
 * @type {RulesProfile[]}
 * @description Defines possible rule profile sets:
 * - claude: Claude Code integration
 * - cline: Cline IDE rules
 * - codex: Codex integration
 * - cursor: Cursor IDE rules
 * - roo: Roo Code IDE rules
 * - trae: Trae IDE rules
 * - windsurf: Windsurf IDE rules
 *
 * To add a new rule profile:
 * 1. Add the profile name to this array
 * 2. Create a profile file in scripts/profiles/{profile}.js
 * 3. Export it as {profile}Profile in scripts/profiles/index.js
 */
export const RULE_PROFILES = [
	'claude',
	'cline',
	'codex',
	'cursor',
	'roo',
	'trae',
	'windsurf'
];

/**
 * Check if a given rule profile is valid
 * @param {string} rulesProfile - The rule profile to check
 * @returns {boolean} True if the rule profile is valid, false otherwise
 */
export function isValidRulesProfile(rulesProfile) {
	return RULE_PROFILES.includes(rulesProfile);
}
