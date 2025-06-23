import fs from 'fs';
import path from 'path';
import { claudeProfile } from '../../../src/profiles/claude.js';

describe('Claude Profile Initialization Functionality', () => {
	let claudeProfileContent;

	beforeAll(() => {
		const claudeJsPath = path.join(
			process.cwd(),
			'src',
			'profiles',
			'claude.js'
		);
		claudeProfileContent = fs.readFileSync(claudeJsPath, 'utf8');
	});

	test('claude.js has correct profile configuration', () => {
		expect(claudeProfileContent).toContain("name: 'claude'");
		expect(claudeProfileContent).toContain("displayName: 'Claude Code'");
		expect(claudeProfileContent).toContain("profileDir: '.'");
		expect(claudeProfileContent).toContain("rulesDir: '.'");
	});

	test('claude.js has no MCP configuration', () => {
		// Check that claude disables MCP config (asset-only profile)
		expect(claudeProfileContent).toContain('mcpConfig: false');
		// Verify runtime behavior: mcpConfigName should be null (handled automatically by base-profile.js)
		expect(claudeProfile.mcpConfig).toBe(false);
		expect(claudeProfile.mcpConfigName).toBe(null);
	});

	test('claude.js has file map for AGENTS.md -> CLAUDE.md', () => {
		expect(claudeProfileContent).toContain("'AGENTS.md': 'CLAUDE.md'");
	});

	test('claude.js has lifecycle functions for file management', () => {
		expect(claudeProfileContent).toContain('function onAddRulesProfile');
		expect(claudeProfileContent).toContain('function onRemoveRulesProfile');
		expect(claudeProfileContent).toContain(
			'function onPostConvertRulesProfile'
		);
	});

	test('claude.js handles .claude directory in lifecycle functions', () => {
		expect(claudeProfileContent).toContain('.claude');
		expect(claudeProfileContent).toContain('copyRecursiveSync');
	});

	test('claude.js has proper error handling', () => {
		expect(claudeProfileContent).toContain('try {');
		expect(claudeProfileContent).toContain('} catch (err) {');
		expect(claudeProfileContent).toContain("log('error'");
	});
});
