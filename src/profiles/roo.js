// Roo Code profile using ProfileBuilder
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { ProfileBuilder } from '../profile/ProfileBuilder.js';
import { ROO_MODES } from '../constants/profiles.js';

// Helper function to recursively copy directory
function copyRecursiveSync(src, dest) {
	const exists = fs.existsSync(src);
	const stats = exists && fs.statSync(src);
	const isDirectory = exists && stats.isDirectory();
	if (isDirectory) {
		if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
		fs.readdirSync(src).forEach((childItemName) => {
			copyRecursiveSync(
				path.join(src, childItemName),
				path.join(dest, childItemName)
			);
		});
	} else {
		fs.copyFileSync(src, dest);
	}
}

// Lifecycle functions for Roo profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Use the provided assets directory to find the roocode directory
	const sourceDir = path.join(assetsDir, 'roocode');

	if (!fs.existsSync(sourceDir)) {
		log('error', `[Roo] Source directory does not exist: ${sourceDir}`);
		return;
	}

	copyRecursiveSync(sourceDir, targetDir);
	log('debug', `[Roo] Copied roocode directory to ${targetDir}`);

	const rooModesDir = path.join(sourceDir, '.roo');

	// Copy .roomodes to project root
	const roomodesSrc = path.join(sourceDir, '.roomodes');
	const roomodesDest = path.join(targetDir, '.roomodes');
	if (fs.existsSync(roomodesSrc)) {
		try {
			fs.copyFileSync(roomodesSrc, roomodesDest);
			log('debug', `[Roo] Copied .roomodes to ${roomodesDest}`);
		} catch (err) {
			log('error', `[Roo] Failed to copy .roomodes: ${err.message}`);
		}
	}

	for (const mode of ROO_MODES) {
		const src = path.join(rooModesDir, `rules-${mode}`, `${mode}-rules`);
		const dest = path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`);
		if (fs.existsSync(src)) {
			try {
				const destDir = path.dirname(dest);
				if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
				fs.copyFileSync(src, dest);
				log('debug', `[Roo] Copied ${mode}-rules to ${dest}`);
			} catch (err) {
				log('error', `[Roo] Failed to copy ${src} to ${dest}: ${err.message}`);
			}
		}
	}
}

function onRemoveRulesProfile(targetDir) {
	const roomodesPath = path.join(targetDir, '.roomodes');
	if (fs.existsSync(roomodesPath)) {
		try {
			fs.rmSync(roomodesPath, { force: true });
			log('debug', `[Roo] Removed .roomodes from ${roomodesPath}`);
		} catch (err) {
			log('error', `[Roo] Failed to remove .roomodes: ${err.message}`);
		}
	}

	const rooDir = path.join(targetDir, '.roo');
	if (fs.existsSync(rooDir)) {
		fs.readdirSync(rooDir).forEach((entry) => {
			if (entry.startsWith('rules-')) {
				const modeDir = path.join(rooDir, entry);
				try {
					fs.rmSync(modeDir, { recursive: true, force: true });
					log('debug', `[Roo] Removed ${entry} directory from ${modeDir}`);
				} catch (err) {
					log('error', `[Roo] Failed to remove ${modeDir}: ${err.message}`);
				}
			}
		});
		if (fs.readdirSync(rooDir).length === 0) {
			try {
				fs.rmSync(rooDir, { recursive: true, force: true });
				log('debug', `[Roo] Removed empty .roo directory from ${rooDir}`);
			} catch (err) {
				log('error', `[Roo] Failed to remove .roo directory: ${err.message}`);
			}
		}
	}
}

function onPostConvertRulesProfile(targetDir, assetsDir) {
	onAddRulesProfile(targetDir, assetsDir);
}

// Create roo profile using ProfileBuilder
const rooProfile = ProfileBuilder.minimal('roo')
	.display('Roo Code')
	.profileDir('.roo')
	.rulesDir('.roo')
	.mcpConfig(true)
	.includeDefaultRules(false) // Roo manages its own complex fileMap
	.fileMap({
		// Multi-mode file mapping for different agent modes
		...ROO_MODES.reduce((map, mode) => {
			map[`rules/cursor_rules.mdc`] = `rules-${mode}/${mode}-rules`;
			return map;
		}, {}),
		'AGENTS.md': 'AGENTS.md'
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'roocode.com' },
			{ from: /\[cursor\.so\]/g, to: '[roocode.com]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://roocode.com' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://roocode.com' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Roo Code' : 'roo')
			},
			{ from: /Cursor/g, to: 'Roo Code' }
		],
		// Documentation URL replacements
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'roo.codeium.com/docs' }],
		// File extension mappings (.mdc to .md)
		fileExtensions: [{ from: /\.mdc/g, to: '.md' }],
		// Tool name mappings (Roo uses different tool names)
		toolNames: {
			create_file: 'write_to_file',
			edit_file: 'apply_diff',
			search: 'search_files',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'execute_command',
			use_mcp: 'use_mcp_tool'
		},

		// Tool context mappings (roo uses standard contexts)
		toolContexts: [],

		// Tool group mappings (roo uses standard groups)
		toolGroups: [],

		// File reference mappings (roo uses standard file references)
		fileReferences: [],

		// Documentation URL mappings
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'roo.codeium.com/docs' }]
	})
	.globalReplacements([
		// Additional tool transformations not handled by toolNames
		{ from: /run_command/g, to: 'execute_command' },

		// Directory structure changes
		{ from: /\.cursor\/rules/g, to: '.roo/rules' },

		// Essential markdown link transformations
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.roo/rules/$2.md)'
		},
		{
			from: /\[(.+?)\]\(mdc:\.roo\/rules\/(.+?)\.md\)/g,
			to: '(.roo/rules/$2.md)'
		}
	])
	.onAdd(onAddRulesProfile)
	.onRemove(onRemoveRulesProfile)
	.onPost(onPostConvertRulesProfile)
	.build();

// Export the roo profile
export { rooProfile };

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
