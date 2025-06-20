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
	mcpConfig: false,
	mcpConfigName: 'cline_mcp_settings.json',
	fileExtension: '.mdc',
	targetExtension: '.md',
	toolMappings: COMMON_TOOL_MAPPINGS.STANDARD, // Cline uses standard tool names
	customFileMap: {
		'cursor_rules.mdc': 'cline_rules.md'
	}
});
