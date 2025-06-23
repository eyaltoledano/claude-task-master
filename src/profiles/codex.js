// Codex profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { log } from '../../scripts/modules/utils.js';
import { createProfile } from './base-profile.js';

// Lifecycle functions for Codex profile (minimal since it just copies AGENTS.md)
function onAddRulesProfile(targetDir, assetsDir) {
	// No additional setup needed - fileMap handles AGENTS.md copy
	log('debug', `[Codex] Profile setup complete`);
}

function onRemoveRulesProfile(targetDir) {
	// No additional cleanup needed - rule transformer handles AGENTS.md removal
	log('debug', `[Codex] Profile cleanup complete`);
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
	docsUrl: 'platform.openai.com/docs/codex',
	profileDir: '.', // Root directory
	rulesDir: '.', // No specific rules directory needed
	mcpConfig: false, // No MCP config needed
	mcpConfigName: null,
	fileExtension: '.mdc',
	targetExtension: '.md',
	fileMap: {
		'AGENTS.md': 'AGENTS.md' // Only copy AGENTS.md for Codex
	},
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
