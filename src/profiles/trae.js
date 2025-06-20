// Trae conversion profile for rule-transformer
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';

// Create and export trae profile using the base factory
export const traeProfile = createProfile({
	name: 'trae',
	displayName: 'Trae',
	url: 'trae.ai',
	docsUrl: 'docs.trae.ai',
	profileDir: '.trae',
	rulesDir: '.trae/rules',
	mcpConfig: false,
	mcpConfigName: 'trae_mcp_settings.json',
	fileExtension: '.mdc',
	targetExtension: '.md',
	toolMappings: COMMON_TOOL_MAPPINGS.STANDARD // Trae uses standard tool names
});
