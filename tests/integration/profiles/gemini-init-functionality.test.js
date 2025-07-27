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
		// Check for ProfileBuilder syntax in the source file
		expect(geminiProfileContent).toContain("ProfileBuilder.minimal('gemini')");
		expect(geminiProfileContent).toContain(".display('Gemini')");
		expect(geminiProfileContent).toContain(".profileDir('.gemini')"); // Gemini uses .gemini directory
		expect(geminiProfileContent).toContain(".rulesDir('.')");
		expect(geminiProfileContent).toContain('.includeDefaultRules(false)'); // Gemini manages its own rules

		// Check the final computed properties on the profile object
		expect(geminiProfile.profileName).toBe('gemini');
		expect(geminiProfile.displayName).toBe('Gemini');
		expect(geminiProfile.profileDir).toBe('.gemini'); // Uses .gemini directory
		expect(geminiProfile.rulesDir).toBe('.'); // Rules in root
		expect(geminiProfile.includeDefaultRules).toBe(false); // non-default

		// URL behavior test - check conversionConfig
		expect(geminiProfile.conversionConfig).toHaveProperty('profileTerms');
		expect(geminiProfile.conversionConfig.profileTerms).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					from: expect.any(RegExp),
					to: expect.stringContaining('ai.google.dev')
				})
			])
		);
	});

	test('gemini.js uses custom MCP config name', () => {
		// Gemini uses settings.json instead of mcp.json - check ProfileBuilder syntax
		expect(geminiProfileContent).toContain("configName: 'settings.json'");
		// Should not contain mcp.json as a config value (comments are OK)
		expect(geminiProfileContent).not.toMatch(
			/mcpConfigName:\s*['"]mcp\.json['"]/
		);

		// Check the final computed properties
		expect(geminiProfile.mcpConfigName).toBe('settings.json');
		expect(geminiProfile.mcpConfigPath).toBe('.gemini/settings.json'); // Uses .gemini directory
	});

	test('gemini.js has implementation with ProfileBuilder', () => {
		// Verify ProfileBuilder structure is present
		expect(geminiProfileContent).toContain('ProfileBuilder.minimal');
		expect(geminiProfileContent).toContain('.build()');

		// Check for required profile configuration
		expect(geminiProfileContent).toContain('.display(');
		expect(geminiProfileContent).toContain('.profileDir(');
		expect(geminiProfileContent).toContain('.rulesDir(');
		expect(geminiProfileContent).toContain('.includeDefaultRules(');

		// Check for proper export
		expect(geminiProfileContent).toMatch(/export\s+const\s+geminiProfile\s*=/);
	});
});
