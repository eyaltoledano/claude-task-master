// Kiro profile for rule-transformer
import { createProfile } from './base-profile.js';
import fs from 'fs';
import path from 'path';
import { log } from '../../scripts/modules/utils.js';

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
		'rules/taskmaster_hooks_workflow.mdc': 'taskmaster_hooks_workflow.md'
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
		{ from: /cursor rules/gi, to: 'Kiro steering files' },

		// Transform frontmatter to Kiro format
		// This regex matches the entire frontmatter block and replaces it
		{
			from: /^---\n(?:description:\s*[^\n]*\n)?(?:globs:\s*[^\n]*\n)?(?:alwaysApply:\s*true\n)?---/m,
			to: '---\ninclusion: always\n---'
		}
	],

	// Add lifecycle hook to copy Kiro hooks
	onPostConvert: (projectRoot, assetsDir) => {
		const hooksSourceDir = path.join(assetsDir, 'kiro-hooks');
		const hooksTargetDir = path.join(projectRoot, '.kiro', 'hooks');

		// Create hooks directory if it doesn't exist
		if (!fs.existsSync(hooksTargetDir)) {
			fs.mkdirSync(hooksTargetDir, { recursive: true });
		}

		// Copy all .kiro.hook files
		if (fs.existsSync(hooksSourceDir)) {
			const hookFiles = fs
				.readdirSync(hooksSourceDir)
				.filter((f) => f.endsWith('.kiro.hook'));

			hookFiles.forEach((file) => {
				const sourcePath = path.join(hooksSourceDir, file);
				const targetPath = path.join(hooksTargetDir, file);

				fs.copyFileSync(sourcePath, targetPath);
			});

			if (hookFiles.length > 0) {
				log(
					'info',
					`[Kiro] Installed ${hookFiles.length} Taskmaster hooks in .kiro/hooks/`
				);
			}
		}
	}
});
