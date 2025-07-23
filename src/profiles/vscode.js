// VS Code profile using ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// VS Code schema integration function
async function setupSchemaIntegration(projectRoot) {
	// Schema integration logic for VS Code
	// This function sets up VS Code-specific schema integration
	try {
		console.log(`Setting up VS Code schema integration for ${projectRoot}`);
		// Add any VS Code-specific schema setup here
	} catch (error) {
		console.error(
			`Failed to setup VS Code schema integration: ${error.message}`
		);
		throw error;
	}
}

// Create vscode profile using the new ProfileBuilder
const vscodeProfile = ProfileBuilder.minimal('vscode')
	.display('VS Code')
	.profileDir('.vscode') // VS Code uses .vscode directory for configuration
	.rulesDir('.github/instructions') // VS Code uses .github/instructions for rules
	.mcpConfig(true) // Enable MCP configuration
	.includeDefaultRules(true)
	.onAdd(setupSchemaIntegration) // Add schema integration lifecycle function
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'code.visualstudio.com' },
			{ from: /\[cursor\.so\]/g, to: '[code.visualstudio.com]' },
			{
				from: /href="https:\/\/cursor\.so/g,
				to: 'href="https://code.visualstudio.com'
			},
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://code.visualstudio.com' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'VS Code' : 'vs code')
			},
			{ from: /Cursor/g, to: 'VS Code' }
		],
		// Documentation URL replacements
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'code.visualstudio.com/docs' }],
		// File extension mappings (.mdc to .instructions.md for VS Code)
		fileExtensions: [{ from: /\.mdc/g, to: '.instructions.md' }],
		// Tool name mappings (standard - no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		},

		// Tool context mappings (vscode uses standard contexts)
		toolContexts: [],

		// Tool group mappings (vscode uses standard groups)
		toolGroups: [],

		// File reference mappings (vscode uses standard file references)
		fileReferences: []
	})
	.globalReplacements([
		// Core VS Code directory structure changes
		{ from: /\.cursor\/rules/g, to: '.github/instructions' },
		{ from: /\.cursor\/mcp\.json/g, to: '.vscode/mcp.json' },
		{ from: /\.vs code\/rules/g, to: '.github/instructions' },
		{ from: /\.vs code\/mcp\.json/g, to: '.vscode/mcp.json' },
		{ from: /\.vs code\/instructions/g, to: '.github/instructions' },
		{ from: /\.github\/rules/g, to: '.github/instructions' },

		// Fix any remaining vscode/rules references that might be created during transformation
		{ from: /\.vscode\/rules/g, to: '.github/instructions' },

		// VS Code custom instructions format - use applyTo with quoted patterns instead of globs
		{ from: /^globs:\s*(.+)$/gm, to: 'applyTo: "$1"' },

		// Remove unsupported property - alwaysApply
		{ from: /^alwaysApply:\s*(true|false)\s*\n?/gm, to: '' },

		// Essential markdown link transformations for VS Code structure
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.github/instructions/$2.instructions.md)'
		},
		{
			from: /\[(.+?)\]\(mdc:\.vs code\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.github/instructions/$2.instructions.md)'
		},
		{
			from: /\[(.+?)\]\(mdc:\.github\/instructions\/(.+?)\.mdc\)/g,
			to: '[$1](.github/instructions/$2.instructions.md)'
		},

		// File extension transformation
		{ from: /\.mdc/g, to: '.instructions.md' },

		// Globs to applyTo transformation for VS Code
		{ from: /globs:\s*(.+)/g, to: 'applyTo: "$1"' },

		// VS Code specific terminology
		{ from: /rules directory/g, to: 'instructions directory' },
		{ from: /cursor rules/gi, to: 'VS Code instructions' }
	])
	.build();

// Export only the new Profile instance
export { vscodeProfile };
export default vscodeProfile;
