// Codex profile for rule-transformer
import { createProfile } from './base-profile.js';

// Create and export codex profile using the base factory
export const codexProfile = createProfile({
	name: 'codex',
	displayName: 'Codex',
	url: 'codex.ai',
	docsUrl: 'platform.openai.com/docs/codex',
	profileDir: '.', // Root directory
	rulesDir: '.', // No specific rules directory needed
	mcpConfig: false,
	mcpConfigName: null,
	includeDefaultRules: false,
	fileMap: {
		'AGENTS.md': 'AGENTS.md'
	}
});
