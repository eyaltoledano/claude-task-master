// Kilo Code conversion profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';
import { KILO_MODES } from '../constants/profiles.js';

// Lifecycle functions for Kilo profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Use the provided assets directory to find the kilocode directory
	const sourceDir = path.join(assetsDir, 'kilocode');

	if (!fs.existsSync(sourceDir)) {
		log('error', `[Kilo] Source directory does not exist: ${sourceDir}`);
		return;
	}

	copyRecursiveSync(sourceDir, targetDir);
	log('debug', `[Kilo] Copied kilocode directory to ${targetDir}`);

	const kiloModesDir = path.join(sourceDir, '.kilo');

	// Copy .kilocodemodes to project root
	const kilomodesSrc = path.join(sourceDir, '.kilocodemodes');
	const kilomodesDest = path.join(targetDir, '.kilocodemodes');
	if (fs.existsSync(kilomodesSrc)) {
		try {
			fs.copyFileSync(kilomodesSrc, kilomodesDest);
			log('debug', `[Kilo] Copied .kilocodemodes to ${kilomodesDest}`);
		} catch (err) {
			log('error', `[Kilo] Failed to copy .kilocodemodes: ${err.message}`);
		}
	}

	for (const mode of KILO_MODES) {
		const src = path.join(kiloModesDir, `rules-${mode}`, `${mode}-rules`);
		const dest = path.join(targetDir, '.kilo', `rules-${mode}`, `${mode}-rules`);
		if (fs.existsSync(src)) {
			try {
				const destDir = path.dirname(dest);
				if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
				fs.copyFileSync(src, dest);
				log('debug', `[Kilo] Copied ${mode}-rules to ${dest}`);
			} catch (err) {
				log('error', `[Kilo] Failed to copy ${src} to ${dest}: ${err.message}`);
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
	const kilomodesPath = path.join(targetDir, '.kilocodemodes');
	if (fs.existsSync(kilomodesPath)) {
		try {
			fs.rmSync(kilomodesPath, { force: true });
			log('debug', `[Kilo] Removed .kilocodemodes from ${kilomodesPath}`);
		} catch (err) {
			log('error', `[Kilo] Failed to remove .kilocodemodes: ${err.message}`);
		}
	}

	const kiloDir = path.join(targetDir, '.kilo');
	if (fs.existsSync(kiloDir)) {
		fs.readdirSync(kiloDir).forEach((entry) => {
			if (entry.startsWith('rules-')) {
				const modeDir = path.join(kiloDir, entry);
				try {
					fs.rmSync(modeDir, { recursive: true, force: true });
					log('debug', `[Kilo] Removed ${entry} directory from ${modeDir}`);
				} catch (err) {
					log('error', `[Kilo] Failed to remove ${modeDir}: ${err.message}`);
				}
			}
		});
		if (fs.readdirSync(kiloDir).length === 0) {
			try {
				fs.rmSync(kiloDir, { recursive: true, force: true });
				log('debug', `[Kilo] Removed empty .kilo directory from ${kiloDir}`);
			} catch (err) {
				log('error', `[Kilo] Failed to remove .kilo directory: ${err.message}`);
			}
		}
	}
}

function onPostConvertRulesProfile(targetDir, assetsDir) {
	onAddRulesProfile(targetDir, assetsDir);
}

// Create and export kilo profile using the base factory
export const kiloProfile = createProfile({
	name: 'kilo',
	displayName: 'Kilo Code',
	url: 'kilocode.com',
	docsUrl: 'docs.kilocode.com',
	toolMappings: COMMON_TOOL_MAPPINGS.ROO_STYLE,
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };