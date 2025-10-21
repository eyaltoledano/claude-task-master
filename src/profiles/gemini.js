// Gemini profile for rule-transformer
import { createProfile } from './base-profile.js';

// Create and export gemini profile using the base factory
export const geminiProfile = createProfile({
	name: 'gemini',
	displayName: 'Gemini',
	url: 'codeassist.google',
	docsUrl: 'github.com/google-gemini/gemini-cli',
	profileDir: '.gemini', // Keep .gemini for settings.json
	rulesDir: '.', // Root directory for GEMINI.md
	mcpConfigName: 'settings.json', // Override default 'mcp.json'
	includeDefaultRules: false,
	fileMap: {
		'AGENT.md': 'AGENTS.md', // Generic base for all AI agents
		'GEMINI.md': 'GEMINI.md' // Gemini-specific features only
	}
});
