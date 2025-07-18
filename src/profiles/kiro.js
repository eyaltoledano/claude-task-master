// Kiro profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create kiro profile using the new ProfileBuilder
const kiroProfile = ProfileBuilder
	.minimal('kiro')
	.display('Kiro')
	.profileDir('.kiro')
	.rulesDir('.kiro/steering') // Kiro rules location
	.mcpConfig({
		configName: 'settings/mcp.json' // Create directly in settings subdirectory
	})
	.includeDefaultRules(true) // Include default rules to get all the standard files
	.fileMap({
		// Default mappings with .md extension (handled by base profile)
		// Override specific mappings if needed
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'kiro.dev' },
			{ from: /\[cursor\.so\]/g, to: '[kiro.dev]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://kiro.dev' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://kiro.dev' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Kiro' : 'kiro')
			},
			{ from: /Cursor/g, to: 'Kiro' }
		],
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'kiro.dev/docs' }
		],
		// Tool name mappings (standard - no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		}
	})
	.globalReplacements([
		// Core Kiro directory structure changes
		{ from: /\.cursor\/rules/g, to: '.kiro/steering' },
		{ from: /\.cursor\/mcp\.json/g, to: '.kiro/settings/mcp.json' },

		// Fix any remaining kiro/rules references that might be created during transformation
		{ from: /\.kiro\/rules/g, to: '.kiro/steering' },

		// Essential markdown link transformations for Kiro structure
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.kiro/steering/$2.md)'
		},

		// Kiro specific terminology
		{ from: /rules directory/g, to: 'steering directory' },
		{ from: /cursor rules/gi, to: 'Kiro steering files' }
	])
	.build();

// Export both the new Profile instance and a legacy-compatible version
export { kiroProfile };

// Legacy-compatible export for backward compatibility
export const kiroProfileLegacy = kiroProfile.toLegacyFormat();

// Default export remains legacy format for maximum compatibility
export default kiroProfileLegacy;
