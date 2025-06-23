// Claude Code profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { createProfile } from './base-profile.js';

// Helper function to recursively copy directory (adopted from Roo profile)
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

// Lifecycle functions for Claude Code profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Copy CLAUDE.md file (existing functionality)
	const sourceFile = path.join(assetsDir, 'AGENTS.md');
	const destFile = path.join(targetDir, 'CLAUDE.md');

	if (fs.existsSync(sourceFile)) {
		try {
			fs.copyFileSync(sourceFile, destFile);
			log('debug', `[Claude] Copied AGENTS.md to ${destFile}`);
		} catch (err) {
			log('error', `[Claude] Failed to copy AGENTS.md: ${err.message}`);
		}
	}

	// Copy .claude directory recursively (fixed approach)
	const claudeSourceDir = path.join(assetsDir, 'claude');
	const claudeDestDir = path.join(targetDir, '.claude');

	if (!fs.existsSync(claudeSourceDir)) {
		log('error', `[Claude] Source directory does not exist: ${claudeSourceDir}`);
		return;
	}

	try {
		copyRecursiveSync(claudeSourceDir, claudeDestDir);
		log('debug', `[Claude] Copied .claude directory to ${claudeDestDir}`);
	} catch (err) {
		log('error', `[Claude] An error occurred during directory copy: ${err.message}`);
	}
}

function onRemoveRulesProfile(targetDir) {
	// Remove CLAUDE.md file (existing functionality)
	const claudeFile = path.join(targetDir, 'CLAUDE.md');
	if (fs.existsSync(claudeFile)) {
		try {
			fs.rmSync(claudeFile, { force: true });
			log('debug', `[Claude] Removed CLAUDE.md from ${claudeFile}`);
		} catch (err) {
			log('error', `[Claude] Failed to remove CLAUDE.md: ${err.message}`);
		}
	}

	// Remove .claude directory recursively (new functionality)
	const claudeDir = path.join(targetDir, '.claude');
	if (removeDirectoryRecursive(claudeDir)) {
		log('debug', `[Claude] Removed .claude directory from ${claudeDir}`);
	}
}

function onPostConvertRulesProfile(targetDir, assetsDir) {
	// For Claude, post-convert is the same as add since we don't transform rules
	onAddRulesProfile(targetDir, assetsDir);
}

// Create and export claude profile using the base factory
export const claudeProfile = createProfile({
	name: 'claude',
	displayName: 'Claude Code',
	url: 'claude.ai',
	docsUrl: 'docs.anthropic.com',
	profileDir: '.', // Root directory
	rulesDir: '.', // No specific rules directory needed
	mcpConfig: false, // No MCP config needed
	mcpConfigName: null,
	fileExtension: '.mdc',
	targetExtension: '.md',
	customFileMap: {}, // Empty - Claude doesn't transform rules, just copies files
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
