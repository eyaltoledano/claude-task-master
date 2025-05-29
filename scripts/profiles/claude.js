// Claude Code profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../modules/utils.js';

// Lifecycle functions for Claude Code profile
function onAddRulesProfile(targetDir) {
	const sourceFile = path.join(process.cwd(), 'assets', 'AGENTS.md');
	const destFile = path.join(targetDir, 'CLAUDE.md');

	if (fs.existsSync(sourceFile)) {
		try {
			fs.copyFileSync(sourceFile, destFile);
			log('debug', `[Claude] Copied AGENTS.md to ${destFile}`);
		} catch (err) {
			log('debug', `[Claude] Failed to copy AGENTS.md: ${err.message}`);
		}
	} else {
		log('debug', `[Claude] AGENTS.md not found at ${sourceFile}`);
	}
}

function onRemoveRulesProfile(targetDir) {
	log('debug', `[Claude] onRemoveRulesProfile called for ${targetDir}`);
	const claudeFile = path.join(targetDir, 'CLAUDE.md');
	if (fs.existsSync(claudeFile)) {
		try {
			fs.rmSync(claudeFile, { force: true });
			log('debug', `[Claude] Removed CLAUDE.md from ${targetDir}`);
		} catch (err) {
			log('debug', `[Claude] Failed to remove CLAUDE.md: ${err.message}`);
		}
	}
	log('debug', `[Claude] onRemoveRulesProfile completed for ${targetDir}`);
}

function onPostConvertRulesProfile(targetDir) {
	onAddRulesProfile(targetDir);
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
