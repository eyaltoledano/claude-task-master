// Resolved VS Code profile using ProfileBuilder
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
	.profileDir('.vscode') // VS Code uses .vscode directory as expected by MCP validation
	.rulesDir('.github/instructions') // Instructions still in .github/instructions
	.mcpConfig(true)
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
		fileReferences: [],

		// Documentation URL mappings
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'code.visualstudio.com/docs' }]
	})
	.globalReplacements([
		// GitHub instructions directory structure
		{ from: /\.cursor\/rules/g, to: '.github/instructions' },
		{ from: /\.cursor\/mcp\.json/g, to: '.vscode/mcp.json' },
		{ from: /\.vs code\/rules/g, to: '.github/instructions' },
		{ from: /\.vs code\/mcp\.json/g, to: '.vscode/mcp.json' },
		{ from: /\.vs code\/instructions/g, to: '.github/instructions' },
		{ from: /\.github\/rules/g, to: '.github/instructions' },

		// Essential markdown link transformations
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.github/instructions/$2.md)'
		},
		{
			from: /\[(.+?)\]\(mdc:\.vs code\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.github/instructions/$2.md)'
		},
		{
			from: /\[(.+?)\]\(mdc:\.github\/instructions\/(.+?)\.mdc\)/g,
			to: '[$1](.github/instructions/$2.md)'
		},

		// File extension transformation
		{ from: /\.mdc/g, to: '.md' },

		// Globs to applyTo transformation for VS Code
		{ from: /globs:\s*(.+)/g, to: 'applyTo: "$1"' },

		// VS Code specific terminology
		{ from: /rules directory/g, to: 'instructions directory' },
		{ from: /cursor rules/gi, to: 'VS Code instructions' }
	])
	.build();

// Export
export { vscodeProfile };
export default vscodeProfile;
