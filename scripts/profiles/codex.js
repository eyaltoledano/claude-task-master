// Codex profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../modules/utils.js';

// Lifecycle functions for Codex profile
function onAddRulesProfile(targetDir) {
	const sourceFile = path.join(process.cwd(), 'assets', 'AGENTS.md');
	const destFile = path.join(targetDir, 'AGENTS.md');

	if (fs.existsSync(sourceFile)) {
		try {
			fs.copyFileSync(sourceFile, destFile);
			log('debug', `[Codex] Copied AGENTS.md to ${destFile}`);
		} catch (err) {
			log('debug', `[Codex] Failed to copy AGENTS.md: ${err.message}`);
		}
	} else {
		log('debug', `[Codex] AGENTS.md not found at ${sourceFile}`);
	}
}

function onRemoveRulesProfile(targetDir) {
	log('debug', `[Codex] onRemoveRulesProfile called for ${targetDir}`);
	const agentsFile = path.join(targetDir, 'AGENTS.md');
	if (fs.existsSync(agentsFile)) {
		try {
			fs.rmSync(agentsFile, { force: true });
			log('debug', `[Codex] Removed AGENTS.md from ${targetDir}`);
		} catch (err) {
			log('debug', `[Codex] Failed to remove AGENTS.md: ${err.message}`);
		}
	}
	log('debug', `[Codex] onRemoveRulesProfile completed for ${targetDir}`);
}

function onPostConvertRulesProfile(targetDir) {
	onAddRulesProfile(targetDir);
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
