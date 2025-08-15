// Kiro profile using ProfileBuilder
import { ProfileBuilder } from '../profile/ProfileBuilder.js';
import fs from 'fs';
import path from 'path';
import { log } from '../../scripts/modules/utils.js';

// Create and export kiro profile using ProfileBuilder
export const kiroProfile = ProfileBuilder.minimal('kiro')
	.display('Kiro')
	.profileDir('.kiro')
	.rulesDir('.kiro/steering') // Kiro rules location
	.mcpConfig({
		configName: 'settings/mcp.json' // Custom name for Kiro
	})
	.includeDefaultRules(true) // Include default rules to get all the standard files
	.targetExtension('.md')
	.fileMap({
		// Override specific mappings - the base profile will create:
		// 'rules/cursor_rules.mdc': 'kiro_rules.md'
		// 'rules/dev_workflow.mdc': 'dev_workflow.md'
		// 'rules/self_improve.mdc': 'self_improve.md'
		// 'rules/taskmaster.mdc': 'taskmaster.md'
		// We can add additional custom mappings here if needed
		'rules/taskmaster_hooks_workflow.mdc': 'taskmaster_hooks_workflow.md'
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'kiro.dev' },
			{ from: /\[cursor\.so\]/g, to: '[kiro.dev]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://kiro.dev' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://kiro.dev' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Kiro' : 'kiro')
			},
			{ from: /Cursor/g, to: 'Kiro' },
			// Kiro specific terminology
			{ from: /rules directory/g, to: 'steering directory' },
			{ from: /cursor rules/gi, to: 'Kiro steering files' }
		],
		// Documentation URL replacements
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'kiro.dev/docs' }],
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
		// Tool context mappings (kiro uses standard contexts)
		toolContexts: [],
		// Tool group mappings (kiro uses standard groups)
		toolGroups: [],
		// File reference mappings (kiro uses standard file references)
		fileReferences: []
	})
	.globalReplacements([
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

		// Transform frontmatter to Kiro format
		// This regex matches the entire frontmatter block and replaces it
		{
			from: /^---\n(?:description:\s*[^\n]*\n)?(?:globs:\s*[^\n]*\n)?(?:alwaysApply:\s*true\n)?---/m,
			to: '---\ninclusion: always\n---'
		}
	])
	.onPost((projectRoot, assetsDir) => {
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
	})
	.build();
