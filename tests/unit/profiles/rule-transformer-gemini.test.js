import { jest } from '@jest/globals';
import { getRulesProfile } from '../../../src/utils/rule-transformer.js';
import { geminiProfile } from '../../../src/profiles/gemini.js';

describe('Rule Transformer - Gemini Profile', () => {
	test('should have correct profile configuration', () => {
		const geminiProfile = getRulesProfile('gemini');

		expect(geminiProfile).toBeDefined();
		expect(geminiProfile.profileName).toBe('gemini');
		expect(geminiProfile.displayName).toBe('Gemini');
		expect(geminiProfile.profileDir).toBe('.gemini');
		expect(geminiProfile.rulesDir).toBe('.');
		expect(geminiProfile.mcpConfig).toBe(true);
		expect(geminiProfile.mcpConfigName).toBe('settings.json');
		expect(geminiProfile.mcpConfigPath).toBe('.gemini/settings.json');
		expect(geminiProfile.includeDefaultRules).toBe(false);
		expect(geminiProfile.fileMap).toEqual({
			'AGENT.md': 'AGENTS.md',
			'GEMINI.md': 'GEMINI.md'
		});
	});

	test('should have minimal profile implementation', () => {
		// Verify that gemini.js is minimal (no lifecycle functions)
		expect(geminiProfile.onAddRulesProfile).toBeUndefined();
		expect(geminiProfile.onRemoveRulesProfile).toBeUndefined();
		expect(geminiProfile.onPostConvertRulesProfile).toBeUndefined();
	});

	test('should use settings.json instead of mcp.json', () => {
		const geminiProfile = getRulesProfile('gemini');
		expect(geminiProfile.mcpConfigName).toBe('settings.json');
		expect(geminiProfile.mcpConfigPath).toBe('.gemini/settings.json');
	});

	test('should not include default rules', () => {
		const geminiProfile = getRulesProfile('gemini');
		expect(geminiProfile.includeDefaultRules).toBe(false);
	});

	test('should have correct file mapping', () => {
		const geminiProfile = getRulesProfile('gemini');
		expect(geminiProfile.fileMap).toEqual({
			'AGENT.md': 'AGENTS.md',
			'GEMINI.md': 'GEMINI.md'
		});
	});

	test('should place AGENTS.md and GEMINI.md in root directory', () => {
		const geminiProfile = getRulesProfile('gemini');
		// rulesDir determines where fileMap files go
		expect(geminiProfile.rulesDir).toBe('.');
		// This means both AGENTS.md and GEMINI.md will be placed in the root
		// Both files are auto-loaded by Gemini CLI
	});

	test('should place settings.json in .gemini directory', () => {
		const geminiProfile = getRulesProfile('gemini');
		// profileDir + mcpConfigName determines MCP config location
		expect(geminiProfile.profileDir).toBe('.gemini');
		expect(geminiProfile.mcpConfigName).toBe('settings.json');
		expect(geminiProfile.mcpConfigPath).toBe('.gemini/settings.json');
	});

	test('should have proper conversion config', () => {
		const geminiProfile = getRulesProfile('gemini');
		// Gemini should have the standard conversion config
		expect(geminiProfile.conversionConfig).toBeDefined();
		expect(geminiProfile.globalReplacements).toBeDefined();
		expect(Array.isArray(geminiProfile.globalReplacements)).toBe(true);
	});
});
