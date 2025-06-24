// VS Code conversion profile for rule-transformer
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';

// Create and export vscode profile using the base factory
export const vscodeProfile = createProfile({
	name: 'vscode',
	displayName: 'VS Code',
	url: 'code.visualstudio.com',
	docsUrl: 'code.visualstudio.com/docs',
	profileDir: '.vscode', // MCP config location
	rulesDir: '.github/instructions', // VS Code instructions location
	mcpConfig: true,
	mcpConfigName: 'mcp.json',
	fileExtension: '.mdc',
	targetExtension: '.md',
	toolMappings: COMMON_TOOL_MAPPINGS.STANDARD, // VS Code uses standard tool names
	customFileMap: {
		'cursor_rules.mdc': 'vscode_rules.md' // Rename cursor_rules to vscode_rules
	},
	customReplacements: [
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
	]
});
