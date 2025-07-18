// VS Code profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create vscode profile using the new ProfileBuilder
const vscodeProfile = ProfileBuilder
	.minimal('vscode')
	.display('VS Code')
	.profileDir('.github')
	.rulesDir('.github/instructions') // GitHub instructions directory
	.mcpConfig(true)
	.includeDefaultRules(true)
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'code.visualstudio.com' },
			{ from: /\[cursor\.so\]/g, to: '[code.visualstudio.com]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://code.visualstudio.com' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://code.visualstudio.com' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'VS Code' : 'vs code')
			},
			{ from: /Cursor/g, to: 'VS Code' }
		],
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'code.visualstudio.com/docs' }
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
		// GitHub instructions directory structure
		{ from: /\.cursor\/rules/g, to: '.github/instructions' },
		{ from: /\.cursor\/mcp\.json/g, to: '.github/instructions/mcp.json' },

		// Essential markdown link transformations
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.github/instructions/$2.md)'
		},

		// VS Code specific terminology 
		{ from: /rules directory/g, to: 'instructions directory' },
		{ from: /cursor rules/gi, to: 'VS Code instructions' }
	])
	.build();

// Export only the new Profile instance
export { vscodeProfile };
