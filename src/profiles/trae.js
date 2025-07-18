// Trae profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create trae profile using the new ProfileBuilder
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
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'docs.trae.ai' }],
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
		// Directory structure changes
		{ from: /\.cursor\/rules/g, to: '.trae/rules' },

		// Essential markdown link transformations
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.trae/rules/$2.md)'
		}
	])
	.build();

// Export only the new Profile instance
export { traeProfile };
