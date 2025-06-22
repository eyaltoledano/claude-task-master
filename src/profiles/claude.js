// Claude Code profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';

// Helper function to recursively copy directory
function copyDirectoryRecursive(src, dest) {
	if (!fs.existsSync(src)) {
		return false;
	}

	// Create destination directory if it doesn't exist
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			copyDirectoryRecursive(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}

	return true;
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

	// Copy .claude directory recursively (new functionality)
	const claudeSourceDir = path.join(assetsDir, 'claude');
	const claudeDestDir = path.join(targetDir, '.claude');

	if (fs.existsSync(claudeSourceDir)) {
		try {
			if (copyDirectoryRecursive(claudeSourceDir, claudeDestDir)) {
				log('debug', `[Claude] Copied .claude directory to ${claudeDestDir}`);
			} else {
				log('warn', `[Claude] Source .claude directory not found at ${claudeSourceDir}`);
			}
		} catch (err) {
			log('error', `[Claude] Failed to copy .claude directory: ${err.message}`);
		}
	} else {
		log('warn', `[Claude] Source .claude directory not found at ${claudeSourceDir}`);
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
	onAddRulesProfile(targetDir, assetsDir);
}

// Simple filename function
function getTargetRuleFilename(sourceFilename) {
	return sourceFilename;
}

// Simple profile configuration - bypasses base-profile system
export const claudeProfile = {
	profileName: 'claude',
	displayName: 'Claude Code',
	profileDir: '.', // Root directory
	rulesDir: '.', // No rules directory needed
	mcpConfig: false, // No MCP config needed
	mcpConfigName: null,
	mcpConfigPath: null,
	conversionConfig: {},
	fileMap: {},
	globalReplacements: [],
	getTargetRuleFilename,
	onAddRulesProfile,
	onRemoveRulesProfile,
	onPostConvertRulesProfile
};
