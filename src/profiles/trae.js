// Trae profile using ProfileBuilder
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create trae profile using ProfileBuilder
const traeProfile = ProfileBuilder.minimal('trae')
	.display('Trae')
	.profileDir('.trae')
	.rulesDir('.trae/rules')
	.mcpConfig(false) // Trae doesn't use MCP
	.includeDefaultRules(true)
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'trae.ai' },
			{ from: /\[cursor\.so\]/g, to: '[trae.ai]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://trae.ai' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://trae.ai' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Trae' : 'trae')
			},
			{ from: /Cursor/g, to: 'Trae' }
		],
		// Documentation URL replacements
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'trae.ai/docs' }],
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

		// Tool context mappings (trae uses standard contexts)
		toolContexts: [],

		// Tool group mappings (trae uses standard groups)
		toolGroups: [],

		// File reference mappings (trae uses standard file references)
		fileReferences: []
	})
	.globalReplacements([
		// Directory structure changes
		{ from: /\.cursor\/rules/g, to: '.trae/rules' },

		// Essential markdown link transformations
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.trae/rules/$2.md)'
		},
		{
			from: /\[(.+?)\]\(mdc:\.trae\/rules\/(.+?)\.md\)/g,
			to: '(.trae/rules/$2.md)'
		}
	])
	.build();

// Export the trae profile
export { traeProfile };
