// Kilo Code conversion profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';
import { ROO_MODES } from '../constants/profiles.js';

// Utility function to apply kilo transformations to content
function applyKiloTransformations(content) {
	const customReplacements = [
		// Replace roo-specific terms with kilo equivalents
		{
			from: /\broo\b/gi,
			to: (match) => (match.charAt(0) === 'R' ? 'Kilo' : 'kilo')
		},
		{ from: /Roo/g, to: 'Kilo' },
		{ from: /ROO/g, to: 'KILO' },
		{ from: /roocode\.com/gi, to: 'kilocode.com' },
		{ from: /docs\.roocode\.com/gi, to: 'docs.kilocode.com' },
		{ from: /https?:\/\/roocode\.com/gi, to: 'https://kilocode.com' },
		{
			from: /https?:\/\/docs\.roocode\.com/gi,
			to: 'https://docs.kilocode.com'
		},
		{ from: /\.roo\//g, to: '.kilo/' },
		{ from: /\.roomodes/g, to: '.kilocodemodes' },
		// Handle file extensions and directory references
		{ from: /roo-rules/g, to: 'kilo-rules' },
		{ from: /rules-roo/g, to: 'rules-kilo' }
	];

	let transformedContent = content;
	for (const replacement of customReplacements) {
		transformedContent = transformedContent.replace(
			replacement.from,
			replacement.to
		);
	}
	return transformedContent;
}

// Utility function to copy files recursively
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

// Lifecycle functions for Kilo profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Use the provided assets directory to find the roocode directory
	const sourceDir = path.join(assetsDir, 'roocode');

	if (!fs.existsSync(sourceDir)) {
		log('error', `[Kilo] Source directory does not exist: ${sourceDir}`);
		return;
	}

	// Copy basic roocode structure first
	copyRecursiveSync(sourceDir, targetDir);
	log('debug', `[Kilo] Copied roocode directory to ${targetDir}`);

	// Transform .roomodes to .kilocodemodes
	const roomodesSrc = path.join(sourceDir, '.roomodes');
	const kilocodemodesDest = path.join(targetDir, '.kilocodemodes');
	if (fs.existsSync(roomodesSrc)) {
		try {
			const roomodesContent = fs.readFileSync(roomodesSrc, 'utf8');
			const transformedContent = applyKiloTransformations(roomodesContent);
			fs.writeFileSync(kilocodemodesDest, transformedContent);
			log('debug', `[Kilo] Created .kilocodemodes at ${kilocodemodesDest}`);

			// Remove the original .roomodes file
			fs.unlinkSync(path.join(targetDir, '.roomodes'));
		} catch (err) {
			log('error', `[Kilo] Failed to transform .roomodes: ${err.message}`);
		}
	}

	// Transform .roo directory to .kilo and apply kilo transformations to mode-specific rules
	const rooModesDir = path.join(sourceDir, '.roo');
	const kiloModesDir = path.join(targetDir, '.kilo');

	// Remove the copied .roo directory and create .kilo
	if (fs.existsSync(path.join(targetDir, '.roo'))) {
		fs.rmSync(path.join(targetDir, '.roo'), { recursive: true, force: true });
	}

	for (const mode of ROO_MODES) {
		const src = path.join(rooModesDir, `rules-${mode}`, `${mode}-rules`);
		const dest = path.join(kiloModesDir, `rules-${mode}`, `${mode}-rules`);
		if (fs.existsSync(src)) {
			try {
				const destDir = path.dirname(dest);
				if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

				// Read, transform, and write the rule file
				const ruleContent = fs.readFileSync(src, 'utf8');
				const transformedContent = applyKiloTransformations(ruleContent);
				fs.writeFileSync(dest, transformedContent);

				log('debug', `[Kilo] Transformed and copied ${mode}-rules to ${dest}`);
			} catch (err) {
				log(
					'error',
					`[Kilo] Failed to transform ${src} to ${dest}: ${err.message}`
				);
			}
		}
	}
}

function onRemoveRulesProfile(targetDir) {
	const kilocodemodespath = path.join(targetDir, '.kilocodemodes');
	if (fs.existsSync(kilocodemodespath)) {
		try {
			fs.rmSync(kilocodemodespath, { force: true });
			log('debug', `[Kilo] Removed .kilocodemodes from ${kilocodemodespath}`);
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

// Create and export kilo profile using the base factory with roo rule reuse
export const kiloProfile = createProfile({
	name: 'kilo',
	displayName: 'Kilo Code',
	url: 'kilocode.com',
	docsUrl: 'docs.kilocode.com',
	profileDir: '.kilo',
	rulesDir: '.kilo/rules',
	toolMappings: COMMON_TOOL_MAPPINGS.ROO_STYLE,

	fileMap: {
		// Map roo rule files to kilo equivalents
		'rules/cursor_rules.mdc': 'kilo_rules.md',
		'rules/dev_workflow.mdc': 'dev_workflow.md',
		'rules/self_improve.mdc': 'self_improve.md',
		'rules/taskmaster.mdc': 'taskmaster.md'
	},
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
