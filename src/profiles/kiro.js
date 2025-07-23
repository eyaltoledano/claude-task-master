// Kiro profile using ProfileBuilder
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create kiro profile using ProfileBuilder
const kiroProfile = ProfileBuilder.minimal('kiro')
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
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'kiro.dev/docs' }],
		// File extension mappings (.mdc to .md)
		fileExtensions: [{ from: /\.mdc/g, to: '.md' }],
		// Tool name mappings (standard - no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		},

		// Tool context mappings (kiro uses standard contexts)
		toolContexts: [],

		// Tool group mappings (kiro uses standard groups)
		toolGroups: [],

		// File reference mappings (kiro uses standard file references)
		fileReferences: [],

		// Documentation URL mappings
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'kiro.ai/docs' }]
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

// Export the profile
export { kiroProfile };
