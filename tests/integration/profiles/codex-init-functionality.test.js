import fs from 'fs';
import path from 'path';
import { codexProfile } from '../../../src/profiles/codex.js';

describe('Codex Profile Initialization Functionality', () => {
	let codexProfileContent;

	beforeAll(() => {
		const codexJsPath = path.join(process.cwd(), 'src', 'profiles', 'codex.js');
		codexProfileContent = fs.readFileSync(codexJsPath, 'utf8');
	});

	test('codex.js has correct asset-only profile configuration', () => {
		// Check for ProfileBuilder syntax in the source file
		expect(codexProfileContent).toContain("ProfileBuilder.minimal('codex')");
		expect(codexProfileContent).toContain(".display('Codex')");
		expect(codexProfileContent).toContain(".profileDir('.')"); // Root directory
		expect(codexProfileContent).toContain(".rulesDir('.')");
		expect(codexProfileContent).toContain('.mcpConfig(false)'); // No MCP configuration for Codex
		expect(codexProfileContent).toContain('.includeDefaultRules(false)'); // Codex manages its own simple setup

		// Check the final computed properties on the profile object
		expect(codexProfile.profileName).toBe('codex');
		expect(codexProfile.displayName).toBe('Codex');
		expect(codexProfile.profileDir).toBe('.'); // non-default
		expect(codexProfile.rulesDir).toBe('.'); // non-default
		expect(codexProfile.mcpConfig).toBe(false); // non-default
		expect(codexProfile.includeDefaultRules).toBe(false); // non-default
	});

	test('codex.js has no lifecycle hooks (simple profile)', () => {
		// Codex should not have lifecycle functions
		expect(codexProfileContent).not.toContain('onAddRulesProfile');
		expect(codexProfileContent).not.toContain('onRemoveRulesProfile');
		expect(codexProfileContent).not.toContain('onPostConvertRulesProfile');
	});

	test('codex.js has ProfileBuilder implementation', () => {
		// Should use ProfileBuilder pattern
		expect(codexProfileContent).toContain('ProfileBuilder.minimal');
		expect(codexProfileContent).toContain('.build()');
		expect(codexProfileContent).toContain('export { codexProfile }');
	});
});
