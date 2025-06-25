// Claude Code profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';

// Lifecycle functions for Claude Code profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Use the provided assets directory to find the source file
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
}

function onRemoveRulesProfile(targetDir) {
	const claudeFile = path.join(targetDir, 'CLAUDE.md');
	if (fs.existsSync(claudeFile)) {
		try {
			fs.rmSync(claudeFile, { force: true });
			log('debug', `[Claude] Removed CLAUDE.md from ${claudeFile}`);
		} catch (err) {
			log('error', `[Claude] Failed to remove CLAUDE.md: ${err.message}`);
		}
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
