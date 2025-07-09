// Cline conversion profile for rule-transformer
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';

// Create and export cline profile using the base factory
export const clineProfile = createProfile({
	name: 'cline',
	displayName: 'Cline',
	url: 'cline.bot',
	docsUrl: 'docs.cline.bot',
	profileDir: '.clinerules',
	rulesDir: '.clinerules',
	mcpConfig: false
});
