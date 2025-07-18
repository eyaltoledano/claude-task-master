// Cline profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create cline profile using the new ProfileBuilder
const clineProfile = ProfileBuilder
	.minimal('cline')
	.display('Cline')
	.profileDir('.clinerules')
	.rulesDir('.clinerules')
	.mcpConfig(true)
	.includeDefaultRules(true)
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'cline.dev' },
			{ from: /\[cursor\.so\]/g, to: '[cline.dev]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://cline.dev' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://cline.dev' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Cline' : 'cline')
			},
			{ from: /Cursor/g, to: 'Cline' }
		],
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'cline.dev/docs' }
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
		// Directory structure changes
		{ from: /\.cursor\/rules/g, to: '.clinerules' },
		{ from: /\.cursor\/mcp\.json/g, to: '.clinerules/mcp.json' },

		// Essential markdown link transformations
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.clinerules/$2.md)'
		}
	])
	.build();

// Export only the new Profile instance
export { clineProfile };
