// Windsurf profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create windsurf profile using the new ProfileBuilder
const windsurfProfile = ProfileBuilder.minimal('windsurf')
	.display('Windsurf')
	.profileDir('.windsurf') // Windsurf uses .windsurf directory as expected by MCP validation
	.rulesDir('.windsurf/rules') // Rules subdirectory
	.mcpConfig(true) // Use standard MCP configuration
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
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'codeium.com/windsurf' }],
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

		// Tool context mappings (windsurf uses standard contexts)
		toolContexts: [],

		// Tool group mappings (windsurf uses standard groups)
		toolGroups: [],

		// File reference mappings (windsurf uses standard file references)
		fileReferences: [],

		// Documentation URL mappings
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'codeium.com/windsurf/docs' }]
	})
	.globalReplacements([
		// Directory structure changes
		{ from: /\.cursor\/rules/g, to: '.windsurf/rules' },
		{ from: /\.cursor\/mcp\.json/g, to: '.windsurf/mcp.json' },

		// Essential markdown link transformations
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.windsurf/rules/$2.md)' // Direct transformation to expected format
		},
		{
			from: /\[(.+?)\]\(mdc:\.windsurf\/rules\/(.+?)\.md\)/g,
			to: '(.windsurf/rules/$2.md)' // Convert to parentheses format for tests
		}
	])
	.build();

// Export only the new Profile instance
export { windsurfProfile };
