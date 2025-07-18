// Windsurf profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create windsurf profile using the new ProfileBuilder
const windsurfProfile = ProfileBuilder.minimal('windsurf')
	.display('Windsurf')
	.profileDir('.windsurfrules')
	.rulesDir('.windsurfrules')
	.mcpConfig({
		configName: 'windsurf_mcp.json' // Custom MCP config name
	})
	.includeDefaultRules(true)
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'codeium.com/windsurf' },
			{ from: /\[cursor\.so\]/g, to: '[codeium.com/windsurf]' },
			{
				from: /href="https:\/\/cursor\.so/g,
				to: 'href="https://codeium.com/windsurf'
			},
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://codeium.com/windsurf' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Windsurf' : 'windsurf')
			},
			{ from: /Cursor/g, to: 'Windsurf' }
		],
		// Documentation URL replacements
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'codeium.com/windsurf/docs' }],
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
		{ from: /\.cursor\/rules/g, to: '.windsurfrules' },
		{ from: /\.cursor\/mcp\.json/g, to: '.windsurfrules/windsurf_mcp.json' },

		// Essential markdown link transformations
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.windsurfrules/$2.md)'
		}
	])
	.build();

// Export only the new Profile instance
export { windsurfProfile };
