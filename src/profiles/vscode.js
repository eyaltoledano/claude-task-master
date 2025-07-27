// VS Code profile using ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

import fs from 'fs';
import path from 'path';

// VS Code schema integration function
async function setupSchemaIntegration(projectRoot) {
	try {
		const vscodeDir = path.join(projectRoot, '.vscode');
		const settingsPath = path.join(vscodeDir, 'settings.json');

		// Only proceed if .vscode directory exists or can be created
		try {
			if (!fs.existsSync(vscodeDir)) {
				fs.mkdirSync(vscodeDir, { recursive: true });
			}
		} catch (error) {
			console.warn(`Could not create .vscode directory: ${error.message}`);
			return; // Skip schema setup if directory can't be created
		}

		// Initialize settings object
		let settings = {};
		if (fs.existsSync(settingsPath)) {
			try {
				settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
			} catch (error) {
				console.warn(
					'Could not parse existing settings.json, skipping schema setup'
				);
				return; // Don't overwrite corrupted settings
			}
		}

		// Initialize json.schemas array if it doesn't exist
		if (!settings['json.schemas']) {
			settings['json.schemas'] = [];
		}

		// Add schema for tasks.json if not already present
		const tasksSchema = {
			fileMatch: ['**/tasks.json'],
			url: 'https://json.schemastore.org/tasks.json'
		};

		const schemaExists = settings['json.schemas'].some(
			(schema) =>
				schema.fileMatch &&
				Array.isArray(schema.fileMatch) &&
				schema.fileMatch.includes('**/tasks.json')
		);

		if (!schemaExists) {
			settings['json.schemas'].push(tasksSchema);

			try {
				fs.writeFileSync(
					settingsPath,
					JSON.stringify(settings, null, 2) + '\n',
					'utf8'
				);
				console.log('VS Code schema integration complete');
			} catch (error) {
				console.warn(`Could not update settings.json: ${error.message}`);
			}
		}
	} catch (error) {
		console.warn(`VS Code schema integration failed: ${error.message}`);
	}
}

// Create vscode profile using ProfileBuilder
const vscodeProfile = ProfileBuilder.minimal('vscode')
	.display('VS Code')
	.profileDir('.vscode') // VS Code uses .vscode directory for configuration
	.rulesDir('.github/instructions') // VS Code uses .github/instructions for rules
	.mcpConfig(true) // Enable MCP configuration
	.includeDefaultRules(true)
	.targetExtension('.instructions.md') // VS Code uses .instructions.md extension
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
		// Remove mdc: protocol from any remaining links
		{ from: /\(mdc:/g, to: '(' },
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
		{ from: /vs code rules/gi, to: 'VS Code instructions' }
	])
	.build();

// Export the vscode profile
export { vscodeProfile };
