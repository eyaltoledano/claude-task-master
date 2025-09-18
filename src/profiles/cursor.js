// Cursor conversion profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { log } from '../../scripts/modules/utils.js';
import { createProfile } from './base-profile.js';

// Helper copy; use cpSync when available, fallback to manual recursion
function copyRecursiveSync(src, dest) {
	if (fs.cpSync) {
		fs.mkdirSync(dest, { recursive: true });
		fs.cpSync(src, dest, { recursive: true, force: true });
		return;
	}
	const exists = fs.existsSync(src);
	const stats = exists && fs.statSync(src);
	const isDirectory = exists && stats.isDirectory();
	if (isDirectory) {
		if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
		for (const child of fs.readdirSync(src)) {
			copyRecursiveSync(path.join(src, child), path.join(dest, child));
		}
	} else {
		// ensure parent exists for file copies
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.copyFileSync(src, dest);
	}
}

// Helper function to recursively remove directory
function removeDirectoryRecursive(dirPath) {
	if (fs.existsSync(dirPath)) {
		try {
			fs.rmSync(dirPath, { recursive: true, force: true });
			return true;
		} catch (err) {
			log('error', `Failed to remove directory ${dirPath}: ${err.message}`);
			return false;
		}
	}
	return true;
}

// Lifecycle functions for Cursor profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Copy commands directory recursively
	const commandsSourceDir = path.join(assetsDir, 'claude', 'commands');
	const commandsDestDir = path.join(targetDir, '.cursor', 'commands');

	if (!fs.existsSync(commandsSourceDir)) {
		log(
			'error',
			`[Cursor] Source commands directory does not exist: ${commandsSourceDir}`
		);
		return;
	}

	try {
		copyRecursiveSync(commandsSourceDir, commandsDestDir);
		log('debug', `[Cursor] Copied commands directory to ${commandsDestDir}`);
	} catch (err) {
		log(
			'error',
			`[Cursor] An error occurred during commands copy: ${err.message}`
		);
	}
}

function onRemoveRulesProfile(targetDir) {
	// Remove .cursor/commands directory recursively
	const commandsDir = path.join(targetDir, '.cursor', 'commands');
	if (removeDirectoryRecursive(commandsDir)) {
		log('debug', `[Cursor] Removed commands directory from ${commandsDir}`);
	}
}

// Create and export cursor profile using the base factory
export const cursorProfile = createProfile({
	name: 'cursor',
	displayName: 'Cursor',
	url: 'cursor.so',
	docsUrl: 'docs.cursor.com',
	targetExtension: '.mdc', // Cursor keeps .mdc extension
	supportsRulesSubdirectories: true,
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile };
