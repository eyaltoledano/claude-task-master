// Roo Code conversion profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';
import { ROO_MODES } from '../constants/profiles.js';

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

// Create and export roo profile using the base factory
export const rooProfile = createProfile({
	name: 'roo',
	displayName: 'Roo Code',
	url: 'roocode.com',
	docsUrl: 'docs.roocode.com',
	toolMappings: COMMON_TOOL_MAPPINGS.ROO_STYLE,
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
