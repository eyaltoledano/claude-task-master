// VS Code profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create vscode profile using the new ProfileBuilder
const vscodeProfile = ProfileBuilder
	.minimal('vscode')
	.display('VS Code')
	.profileDir('.vscode')
	.rulesDir('.github/instructions') // VS Code instructions location
	.mcpConfig({
		configName: 'mcp.json' // Default name in .vscode directory
	})
	.includeDefaultRules(true)
	.fileMap({
		// Default mappings with .md extension
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'code.visualstudio.com' },
			{ from: /\[cursor\.so\]/g, to: '[code.visualstudio.com]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://code.visualstudio.com' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://code.visualstudio.com' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'VS Code' : 'vscode')
			},
			{ from: /Cursor/g, to: 'VS Code' }
		],
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'code.visualstudio.com/docs' }
		],
		// Standard tool mappings (no custom tools)
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
		// Core VS Code directory structure changes
		{ from: /\.cursor\/rules/g, to: '.github/instructions' },
		{ from: /\.cursor\/mcp\.json/g, to: '.vscode/mcp.json' },

		// Fix any remaining vscode/rules references that might be created during transformation
		{ from: /\.vscode\/rules/g, to: '.github/instructions' },

		// VS Code custom instructions format - use applyTo with quoted patterns instead of globs
		{ from: /^globs:\s*(.+)$/gm, to: 'applyTo: "$1"' },

		// Essential markdown link transformations for VS Code structure
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.github/instructions/$2.md)'
		},

		// VS Code specific terminology
		{ from: /rules directory/g, to: 'instructions directory' },
		{ from: /cursor rules/gi, to: 'VS Code instructions' }
	])
	.build();

// Export both the new Profile instance and a legacy-compatible version
export { vscodeProfile };

// Legacy-compatible export for backward compatibility
export const vscodeProfileLegacy = vscodeProfile.toLegacyFormat();

// Default export remains legacy format for maximum compatibility
export default vscodeProfileLegacy;
