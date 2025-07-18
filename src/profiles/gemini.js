// Gemini profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create gemini profile using the new ProfileBuilder
const geminiProfile = ProfileBuilder.minimal('gemini')
	.display('Gemini')
	.profileDir('.gemini') // Gemini uses .gemini directory
	.rulesDir('.')
	.mcpConfig({
		configName: 'settings.json' // Custom name for Gemini
	})
	.includeDefaultRules(false) // Gemini manages its own rules
	.fileMap({
		'AGENTS.md': 'GEMINI.md' // Gemini-specific file mapping
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'ai.google.dev' },
			{ from: /\[cursor\.so\]/g, to: '[ai.google.dev]' },
			{
				from: /href="https:\/\/cursor\.so/g,
				to: 'href="https://ai.google.dev'
			},
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://ai.google.dev' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Gemini' : 'gemini')
			},
			{ from: /Cursor/g, to: 'Gemini' }
		],
		// Documentation URL replacements
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'ai.google.dev/docs' }],
		// Tool name mappings (standard - no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		},

		// Tool context mappings (gemini uses standard contexts)
		toolContexts: [],

		// Tool group mappings (gemini uses standard groups)
		toolGroups: [],

		// File reference mappings (gemini uses standard file references)
		fileReferences: [],

		// Documentation URL mappings
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'ai.google.dev/docs' }]
	})
	.globalReplacements([
		// Simple directory structure (files in root)
		{ from: /\.cursor\/rules/g, to: '.' },
		{ from: /\.cursor\/mcp\.json/g, to: './settings.json' },

		// Markdown link transformations for root structure
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](./$2.md)'
		}
	])
	.build();

// Export only the new Profile instance
export { geminiProfile };
