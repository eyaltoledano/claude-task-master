// Cursor conversion profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { log } from '../../scripts/modules/utils.js';
import { createProfile } from './base-profile.js';

// Helper copy; use cpSync when available, fallback to manual recursion
function copyRecursiveSync(src, dest) {
	if (fs.cpSync) {
		try {
			fs.cpSync(src, dest, { recursive: true, force: true });
			return;
		} catch (err) {
			throw new Error(`Failed to copy ${src} to ${dest}: ${err.message}`);
		}
	}
	const exists = fs.existsSync(src);
	let stats = null;
	let isDirectory = false;

	if (exists) {
		try {
			stats = fs.statSync(src);
			isDirectory = stats.isDirectory();
		} catch (err) {
			// Handle TOCTOU race condition - treat as non-existent/not-a-directory
			isDirectory = false;
		}
	}

	if (isDirectory) {
		try {
			if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
			for (const child of fs.readdirSync(src)) {
				copyRecursiveSync(path.join(src, child), path.join(dest, child));
			}
		} catch (err) {
			throw new Error(
				`Failed to copy directory ${src} to ${dest}: ${err.message}`
			);
		}
	} else {
		try {
			// ensure parent exists for file copies
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			fs.copyFileSync(src, dest);
		} catch (err) {
			throw new Error(`Failed to copy file ${src} to ${dest}: ${err.message}`);
		}
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

// Resolve the Cursor profile directory from either project root, profile root, or rules dir
function resolveCursorProfileDir(baseDir) {
	const base = path.basename(baseDir);
	// If called with .../.cursor/rules -> return .../.cursor
	if (base === 'rules' && path.basename(path.dirname(baseDir)) === '.cursor') {
		return path.dirname(baseDir);
	}
	// If called with .../.cursor -> return as-is
	if (base === '.cursor') return baseDir;
	// Otherwise assume project root and append .cursor
	return path.join(baseDir, '.cursor');
}

// Lifecycle functions for Cursor profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Copy commands directory recursively
	const commandsSourceDir = path.join(assetsDir, 'claude', 'commands');
	const profileDir = resolveCursorProfileDir(targetDir);
	const commandsDestDir = path.join(profileDir, 'commands');

	if (!fs.existsSync(commandsSourceDir)) {
		log(
			'warn',
			`[Cursor] Source commands directory does not exist: ${commandsSourceDir}`
		);
		return;
	}

	try {
		// Ensure fresh state to avoid stale command files
		try {
			fs.rmSync(commandsDestDir, { recursive: true, force: true });
			log(
				'debug',
				`[Cursor] Removed existing commands directory: ${commandsDestDir}`
			);
		} catch (deleteErr) {
			// Directory might not exist, which is fine
			log(
				'debug',
				`[Cursor] Commands directory did not exist or could not be removed: ${deleteErr.message}`
			);
		}

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
	const profileDir = resolveCursorProfileDir(targetDir);
	const commandsDir = path.join(profileDir, 'commands');
	if (removeDirectoryRecursive(commandsDir)) {
		log(
			'debug',
			`[Cursor] Ensured commands directory removed at ${commandsDir}`
		);
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
