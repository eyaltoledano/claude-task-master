// Codex profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';

// Lifecycle functions for Codex profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Use the provided assets directory to find the source file
	const sourceFile = path.join(assetsDir, 'AGENTS.md');
	const destFile = path.join(targetDir, 'AGENTS.md');

	if (fs.existsSync(sourceFile)) {
		try {
			fs.copyFileSync(sourceFile, destFile);
			log('debug', `[Codex] Copied AGENTS.md to ${destFile}`);
		} catch (err) {
			log('error', `[Codex] Failed to copy AGENTS.md: ${err.message}`);
		}
	}
}

function onRemoveRulesProfile(targetDir) {
	const agentsFile = path.join(targetDir, 'AGENTS.md');
	if (fs.existsSync(agentsFile)) {
		try {
			fs.rmSync(agentsFile, { force: true });
			log('debug', `[Codex] Removed AGENTS.md from ${agentsFile}`);
		} catch (err) {
			log('error', `[Codex] Failed to remove AGENTS.md: ${err.message}`);
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
export const codexProfile = {
	profileName: 'codex',
	displayName: 'Codex',
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
