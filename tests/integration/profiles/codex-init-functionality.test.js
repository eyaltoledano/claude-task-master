import fs from 'fs';
import path from 'path';
import { codexProfile } from '../../../src/profiles/codex.js';

describe('Codex Profile Initialization Functionality', () => {
	let codexProfileContent;

	beforeAll(() => {
		const codexJsPath = path.join(process.cwd(), 'src', 'profiles', 'codex.js');
		codexProfileContent = fs.readFileSync(codexJsPath, 'utf8');
	});

	test('codex.js has correct profile configuration', () => {
		expect(codexProfileContent).toContain("name: 'codex'");
		expect(codexProfileContent).toContain("displayName: 'Codex'");
		expect(codexProfileContent).toContain("profileDir: '.'");
		expect(codexProfileContent).toContain("rulesDir: '.'");
	});

	test('codex.js has no MCP configuration', () => {
		// Check that codex disables MCP config (asset-only profile)
		expect(codexProfileContent).toContain('mcpConfig: false');
		// Verify runtime behavior: mcpConfigName should be null (handled automatically by base-profile.js)
		expect(codexProfile.mcpConfig).toBe(false);
		expect(codexProfile.mcpConfigName).toBe(null);
	});

	test('codex.js has file map for AGENTS.md -> AGENTS.md', () => {
		expect(codexProfileContent).toContain("'AGENTS.md': 'AGENTS.md'");
	});

	test('codex.js has lifecycle functions for file management', () => {
		expect(codexProfileContent).toContain('function onAddRulesProfile');
		expect(codexProfileContent).toContain('function onRemoveRulesProfile');
		expect(codexProfileContent).toContain('function onPostConvertRulesProfile');
	});

	test('codex.js has minimal lifecycle functions', () => {
		expect(codexProfileContent).toContain('Profile setup complete');
		expect(codexProfileContent).toContain('Profile cleanup complete');
	});

	test('codex.js has proper logging', () => {
		expect(codexProfileContent).toContain("log('debug'");
		expect(codexProfileContent).toContain('Profile setup complete');
		expect(codexProfileContent).toContain('Profile cleanup complete');
	});
});
