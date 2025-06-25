// Gemini profile for rule-transformer
import { createProfile } from './base-profile.js';

// Create and export gemini profile using the base factory
export const geminiProfile = createProfile({
	name: 'gemini',
	displayName: 'Gemini',
	url: 'codeassist.google',
	docsUrl: 'github.com/google-gemini/gemini-cli',
	mcpConfigName: 'settings.json', // Override default 'mcp.json'
	includeDefaultRules: false,
	fileMap: {
		'AGENTS.md': 'GEMINI.md'
	}
});
