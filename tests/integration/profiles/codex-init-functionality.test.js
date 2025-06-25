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
		// Check for explicit, non-default values in the source file
		expect(codexProfileContent).toContain("name: 'codex'");
		expect(codexProfileContent).toContain("displayName: 'Codex'");
		expect(codexProfileContent).toContain("profileDir: '.'"); // non-default
		expect(codexProfileContent).toContain("rulesDir: '.'"); // non-default
		expect(codexProfileContent).toContain('mcpConfig: false'); // non-default
		expect(codexProfileContent).toContain('includeDefaultRules: false'); // non-default
		expect(codexProfileContent).toContain("'AGENTS.md': 'AGENTS.md'");

		// Check the final computed properties on the profile object
		expect(codexProfile.profileName).toBe('codex');
		expect(codexProfile.displayName).toBe('Codex');
		expect(codexProfile.profileDir).toBe('.');
		expect(codexProfile.rulesDir).toBe('.');
		expect(codexProfile.mcpConfig).toBe(false);
		expect(codexProfile.mcpConfigName).toBe(null); // computed
		expect(codexProfile.includeDefaultRules).toBe(false);
		expect(codexProfile.fileMap['AGENTS.md']).toBe('AGENTS.md');
	});

	test('codex.js has no lifecycle functions', () => {
		// Codex has been simplified - no lifecycle functions
		expect(codexProfileContent).not.toContain('function onAddRulesProfile');
		expect(codexProfileContent).not.toContain('function onRemoveRulesProfile');
		expect(codexProfileContent).not.toContain(
			'function onPostConvertRulesProfile'
		);
		expect(codexProfileContent).not.toContain('log(');
	});

	test('codex.js has minimal implementation', () => {
		// Should just use createProfile factory
		expect(codexProfileContent).toContain('createProfile({');
		expect(codexProfileContent).toContain("name: 'codex'");
		expect(codexProfileContent).toContain("'AGENTS.md': 'AGENTS.md'");
	});
});
