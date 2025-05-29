// Roo Code conversion profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../modules/utils.js';
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';

// Lifecycle functions for Roo profile
function onAddRulesProfile(targetDir) {
	const sourceDir = path.join(process.cwd(), 'assets', 'roocode');
	copyRecursiveSync(sourceDir, targetDir);

	const rooModesDir = path.join(sourceDir, '.roo');
	const rooModes = ['architect', 'ask', 'boomerang', 'code', 'debug', 'test'];

	// Copy .roomodes to project root
	const roomodesSrc = path.join(sourceDir, '.roomodes');
	const roomodesDest = path.join(targetDir, '.roomodes');
	if (fs.existsSync(roomodesSrc)) {
		try {
			fs.copyFileSync(roomodesSrc, roomodesDest);
			log('debug', `[Roo] Copied .roomodes to ${roomodesDest}`);
		} catch (err) {
			log('debug', `[Roo] Failed to copy .roomodes: ${err.message}`);
		}
	} else {
		log('debug', `[Roo] .roomodes not found at ${roomodesSrc}`);
	}

	for (const mode of rooModes) {
		const src = path.join(rooModesDir, `rules-${mode}`, `${mode}-rules`);
		const dest = path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`);
		if (fs.existsSync(src)) {
			try {
				const destDir = path.dirname(dest);
				if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
				fs.copyFileSync(src, dest);
				log('debug', `[Roo] Copied ${src} to ${dest}`);
			} catch (err) {
				log('debug', `[Roo] Failed to copy ${src} to ${dest}: ${err.message}`);
			}
		} else {
			log('debug', `[Roo] Roo rule file not found for mode '${mode}': ${src}`);
		}
	}
}

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

function onRemoveRulesProfile(targetDir) {
	log('debug', `[Roo] onRemoveRulesProfile called for ${targetDir}`);
	const roomodesPath = path.join(targetDir, '.roomodes');
	if (fs.existsSync(roomodesPath)) {
		try {
			fs.rmSync(roomodesPath, { force: true });
			log('debug', `[Roo] Removed .roomodes from ${targetDir}`);
		} catch (err) {
			log('debug', `[Roo] Failed to remove .roomodes: ${err.message}`);
		}
	}

	const rooDir = path.join(targetDir, '.roo');
	if (fs.existsSync(rooDir)) {
		fs.readdirSync(rooDir).forEach((entry) => {
			if (entry.startsWith('rules-')) {
				const modeDir = path.join(rooDir, entry);
				try {
					fs.rmSync(modeDir, { recursive: true, force: true });
					log('debug', `[Roo] Removed ${modeDir}`);
				} catch (err) {
					log('debug', `[Roo] Failed to remove ${modeDir}: ${err.message}`);
				}
			}
		});
		if (fs.readdirSync(rooDir).length === 0) {
			try {
				fs.rmSync(rooDir, { recursive: true, force: true });
				log('debug', `[Roo] Removed empty .roo directory`);
			} catch (err) {
				log('debug', `[Roo] Failed to remove .roo directory: ${err.message}`);
			}
		}
	}
	log('debug', `[Roo] onRemoveRulesProfile completed for ${targetDir}`);
}

function onPostConvertRulesProfile(targetDir) {
	onAddRulesProfile(targetDir);
}

// Create and export roo profile using the base factory
export const rooProfile = createProfile({
	name: 'roo',
	displayName: 'Roo Code',
	url: 'roocode.com',
	docsUrl: 'docs.roocode.com',
	profileDir: '.roo',
	rulesDir: '.roo/rules',
	mcpConfig: true,
	mcpConfigName: 'mcp.json',
	fileExtension: '.mdc',
	targetExtension: '.md',
	toolMappings: COMMON_TOOL_MAPPINGS.ROO_STYLE,
	customFileMap: {
		'cursor_rules.mdc': 'roo_rules.md'
	},
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
