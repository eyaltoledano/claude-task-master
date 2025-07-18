// Codex profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create codex profile using the new ProfileBuilder
const codexProfile = ProfileBuilder.minimal('codex')
	.display('Codex')
	.profileDir('.') // Root directory
	.rulesDir('.')
	.mcpConfig(false) // No MCP configuration for Codex
	.includeDefaultRules(false) // Codex manages its own simple setup
	.fileMap({
		'AGENTS.md': 'CODEX.md' // Basic codex file mapping
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'github.com/microsoft/vscode' },
			{ from: /\[cursor\.so\]/g, to: '[github.com/microsoft/vscode]' },
			{
				from: /href="https:\/\/cursor\.so/g,
				to: 'href="https://github.com/microsoft/vscode'
			},
			{
				from: /\(https:\/\/cursor\.so/g,
				to: '(https://github.com/microsoft/vscode'
			},
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Codex' : 'codex')
			},
			{ from: /Cursor/g, to: 'Codex' }
		],
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'github.com/microsoft/vscode/docs' }
		],
		// Tool name mappings (standard - no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		},

		// Tool context mappings (codex uses standard contexts)
		toolContexts: [],

		// Tool group mappings (codex uses standard groups)
		toolGroups: [],

		// File reference mappings (codex uses standard file references)
		fileReferences: [],

		// Documentation URL mappings
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'github.com/microsoft/vscode/docs' }
		]
	})
	.globalReplacements([
		// Simple directory structure (files in root)
		{ from: /\.cursor\/rules/g, to: '.' },

		// Markdown link transformations for root structure
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](./$2.md)'
		}
	])
	.build();

// Export only the new Profile instance
export { codexProfile };
