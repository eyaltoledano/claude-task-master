// Kiro profile for rule-transformer
import { createProfile } from './base-profile.js';

// Create and export kiro profile using the base factory
export const kiroProfile = createProfile({
	name: 'kiro',
	displayName: 'Kiro',
	url: 'kiro.dev',
	docsUrl: 'kiro.dev/docs',
	profileDir: '.kiro',
	rulesDir: '.kiro/steering', // Kiro rules location (full path)
	mcpConfig: true,
	mcpConfigName: 'settings/mcp.json', // Create directly in settings subdirectory
	includeDefaultRules: true, // Include default rules to get all the standard files
	targetExtension: '.md',
	fileMap: {
		// Override specific mappings - the base profile will create:
		// 'rules/cursor_rules.mdc': 'kiro_rules.md'
		// 'rules/dev_workflow.mdc': 'dev_workflow.md'
		// 'rules/self_improve.mdc': 'self_improve.md'
		// 'rules/taskmaster.mdc': 'taskmaster.md'
		// We can add additional custom mappings here if needed
	},
	customReplacements: [
		// Core Kiro directory structure changes
		{ from: /\.cursor\/rules/g, to: '.kiro/steering' },
		{ from: /\.cursor\/mcp\.json/g, to: '.kiro/settings/mcp.json' },

		// Fix any remaining kiro/rules references that might be created during transformation
		{ from: /\.kiro\/rules/g, to: '.kiro/steering' },

		// Essential markdown link transformations for Kiro structure
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.kiro/steering/$2.md)'
		},

		// Kiro specific terminology
		{ from: /rules directory/g, to: 'steering directory' },
		{ from: /cursor rules/gi, to: 'Kiro steering files' }
	]
});
