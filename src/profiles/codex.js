// Codex profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { createProfile } from './base-profile.js';

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
	// For Codex, post-convert is the same as add since we don't transform rules
	onAddRulesProfile(targetDir, assetsDir);
}

// Create and export codex profile using the base factory
export const codexProfile = createProfile({
	name: 'codex',
	displayName: 'Codex',
	url: 'codex.ai',
	docsUrl: 'docs.codex.ai',
	profileDir: '.', // Root directory
	rulesDir: '.', // No specific rules directory needed
	mcpConfig: false, // No MCP config needed
	mcpConfigName: null,
	fileExtension: '.mdc',
	targetExtension: '.md',
	customFileMap: {}, // Empty - Codex doesn't transform rules, just copies files
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
