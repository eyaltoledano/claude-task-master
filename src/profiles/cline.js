// Cline profile using ProfileBuilder
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create cline profile using ProfileBuilder
const clineProfile = ProfileBuilder.minimal('cline')
	.display('Cline')
	.profileDir('.clinerules')
	.rulesDir('.clinerules')
	.mcpConfig(false) // Cline does not use MCP configuration
	.includeDefaultRules(true)
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'cline.bot' }, // Fixed: should be cline.bot not cline.dev
			{ from: /\[cursor\.so\]/g, to: '[cline.bot]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://cline.bot' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://cline.bot' },
			{ from: /cline\.dev/g, to: 'cline.bot' }, // Transform cline.dev to cline.bot
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Cline' : 'cline')
			},
			{ from: /Cursor/g, to: 'Cline' }
		],
		// Documentation URL replacements
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'cline.bot/docs' }],
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

		// Tool context mappings (cline uses standard contexts)
		toolContexts: [],

		// Tool group mappings (cline uses standard groups)
		toolGroups: [],

		// File reference mappings (cline uses standard file references)
		fileReferences: []
	})
	.globalReplacements([
		// Directory structure changes
		{ from: /\.cursor\/rules/g, to: '.clinerules' },
		{ from: /\.cursor\/mcp\.json/g, to: '.clinerules/mcp.json' },
		{ from: /\.cline\/rules/g, to: '.clinerules' },
		{ from: /\.cline\/mcp\.json/g, to: '.clinerules/mcp.json' },

		// Essential markdown link transformations
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.clinerules/$2.md)'
		},
		{
			from: /\[(.+?)\]\(mdc:\.cline\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.clinerules/$2.md)'
		},
		{
			from: /\[(.+?)\]\(mdc:\.clinerules\/(.+?)\.md\)/g,
			to: '(.clinerules/$2.md)'
		}
	])
	.build();

// Export the cline profile
export { clineProfile };
