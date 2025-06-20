// Windsurf conversion profile for rule-transformer
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';

// Create and export windsurf profile using the base factory
export const windsurfProfile = createProfile({
	name: 'windsurf',
	displayName: 'Windsurf',
	url: 'windsurf.com',
	docsUrl: 'docs.windsurf.com',
	profileDir: '.windsurf',
	rulesDir: '.windsurf/rules',
	mcpConfig: true,
	mcpConfigName: 'mcp.json',
	fileExtension: '.mdc',
	targetExtension: '.md',
	toolMappings: COMMON_TOOL_MAPPINGS.STANDARD // Windsurf uses standard tool names
});
