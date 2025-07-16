import { jest } from '@jest/globals';
import { getRulesProfile } from '../../../src/utils/rule-transformer.js';
import { opencodeProfile } from '../../../src/profiles/opencode.js';

describe('Rule Transformer - OpenCode Profile', () => {
	test('should have correct profile configuration', () => {
		const opencodeProfile = getRulesProfile('opencode');

		expect(opencodeProfile).toBeDefined();
		expect(opencodeProfile.profileName).toBe('opencode');
		expect(opencodeProfile.displayName).toBe('OpenCode');
		expect(opencodeProfile.profileDir).toBe('.');
		expect(opencodeProfile.rulesDir).toBe('.');
		expect(opencodeProfile.mcpConfig).toBe(true);
		expect(opencodeProfile.mcpConfigName).toBe('opencode.json');
		expect(opencodeProfile.mcpConfigPath).toBe('opencode.json');
		expect(opencodeProfile.includeDefaultRules).toBe(false);
		expect(opencodeProfile.fileMap).toEqual({
			'AGENTS.md': 'AGENTS.md'
		});
	});

	test('should have lifecycle functions for MCP config transformation', () => {
		// Verify that opencode.js has lifecycle functions
		expect(opencodeProfile.onPostConvertRulesProfile).toBeDefined();
		expect(typeof opencodeProfile.onPostConvertRulesProfile).toBe('function');
		expect(opencodeProfile.onRemoveRulesProfile).toBeDefined();
		expect(typeof opencodeProfile.onRemoveRulesProfile).toBe('function');
	});

	test('should use opencode.json instead of mcp.json', () => {
		const opencodeProfile = getRulesProfile('opencode');
		expect(opencodeProfile.mcpConfigName).toBe('opencode.json');
		expect(opencodeProfile.mcpConfigPath).toBe('opencode.json');
	});

	test('should not include default rules', () => {
		const opencodeProfile = getRulesProfile('opencode');
		expect(opencodeProfile.includeDefaultRules).toBe(false);
	});

	test('should have correct file mapping', () => {
		const opencodeProfile = getRulesProfile('opencode');
		expect(opencodeProfile.fileMap).toEqual({
			'AGENTS.md': 'AGENTS.md'
		});
	});

	test('should use root directory for both profile and rules', () => {
		const opencodeProfile = getRulesProfile('opencode');
		expect(opencodeProfile.profileDir).toBe('.');
		expect(opencodeProfile.rulesDir).toBe('.');
	});

	test('should have MCP configuration enabled', () => {
		const opencodeProfile = getRulesProfile('opencode');
		expect(opencodeProfile.mcpConfig).toBe(true);
	});
});
