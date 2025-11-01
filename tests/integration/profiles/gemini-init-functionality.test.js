import fs from 'fs';
import path from 'path';
import { geminiProfile } from '../../../src/profiles/gemini.js';

describe('Gemini Profile Initialization Functionality', () => {
	let geminiProfileContent;

	beforeAll(() => {
		const geminiJsPath = path.join(
			process.cwd(),
			'src',
			'profiles',
			'gemini.js'
		);
		geminiProfileContent = fs.readFileSync(geminiJsPath, 'utf8');
	});

	test('gemini.js has correct profile configuration', () => {
		// Check for explicit, non-default values in the source file
		expect(geminiProfileContent).toContain("name: 'gemini'");
		expect(geminiProfileContent).toContain("displayName: 'Gemini'");
		expect(geminiProfileContent).toContain("url: 'codeassist.google'");
		expect(geminiProfileContent).toContain(
			"docsUrl: 'github.com/google-gemini/gemini-cli'"
		);
		expect(geminiProfileContent).toContain("profileDir: '.gemini'");
		expect(geminiProfileContent).toContain("rulesDir: '.'"); // non-default
		expect(geminiProfileContent).toContain("mcpConfigName: 'settings.json'"); // non-default
		expect(geminiProfileContent).toContain('includeDefaultRules: false'); // non-default
		expect(geminiProfileContent).toContain("'AGENT.md': 'AGENTS.md'");
		expect(geminiProfileContent).toContain("'GEMINI.md': 'GEMINI.md'");

		// Check the final computed properties on the profile object
		expect(geminiProfile.profileName).toBe('gemini');
		expect(geminiProfile.displayName).toBe('Gemini');
		expect(geminiProfile.profileDir).toBe('.gemini');
		expect(geminiProfile.rulesDir).toBe('.');
		expect(geminiProfile.mcpConfig).toBe(true); // computed from mcpConfigName
		expect(geminiProfile.mcpConfigName).toBe('settings.json');
		expect(geminiProfile.mcpConfigPath).toBe('.gemini/settings.json'); // computed
		expect(geminiProfile.includeDefaultRules).toBe(false);
		expect(geminiProfile.fileMap['AGENT.md']).toBe('AGENTS.md');
		expect(geminiProfile.fileMap['GEMINI.md']).toBe('GEMINI.md');
	});

	test('gemini.js has no lifecycle functions', () => {
		// Gemini profile should not have any lifecycle functions
		expect(geminiProfileContent).not.toContain('function onAddRulesProfile');
		expect(geminiProfileContent).not.toContain('function onRemoveRulesProfile');
		expect(geminiProfileContent).not.toContain(
			'function onPostConvertRulesProfile'
		);
		expect(geminiProfileContent).not.toContain('onAddRulesProfile:');
		expect(geminiProfileContent).not.toContain('onRemoveRulesProfile:');
		expect(geminiProfileContent).not.toContain('onPostConvertRulesProfile:');
	});

	test('gemini.js uses custom MCP config name', () => {
		// Gemini uses settings.json instead of mcp.json
		expect(geminiProfileContent).toContain("mcpConfigName: 'settings.json'");
		// Should not contain mcp.json as a config value (comments are OK)
		expect(geminiProfileContent).not.toMatch(
			/mcpConfigName:\s*['"]mcp\.json['"]/
		);
	});

	test('gemini.js has minimal implementation', () => {
		// Verify the profile is minimal (no extra functions or logic)
		const lines = geminiProfileContent.split('\n');
		const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
		// Should be around 16 lines (import, export, and profile definition)
		expect(nonEmptyLines.length).toBeLessThan(20);
	});
});
