// Trae conversion profile for rule-transformer
import { COMMON_TOOL_MAPPINGS, createProfile } from './base-profile.js';

// Create and export trae profile using the base factory
export const traeProfile = createProfile({
	name: 'trae',
	displayName: 'Trae',
	url: 'trae.ai',
	docsUrl: 'docs.trae.ai',
	mcpConfig: false
});
