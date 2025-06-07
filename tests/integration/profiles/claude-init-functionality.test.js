import fs from 'fs';
import path from 'path';

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

	test('claude.js is a simple profile with correct configuration', () => {
		expect(claudeProfileContent).toContain("profileName: 'claude'");
		expect(claudeProfileContent).toContain("displayName: 'Claude Code'");
		expect(claudeProfileContent).toContain("profileDir: '.'");
		expect(claudeProfileContent).toContain("rulesDir: '.'");
	});

	test('claude.js has no MCP configuration', () => {
		expect(claudeProfileContent).toContain('mcpConfig: false');
		expect(claudeProfileContent).toContain('mcpConfigName: null');
		expect(claudeProfileContent).toContain('mcpConfigPath: null');
	});

	test('claude.js has empty file map (simple profile)', () => {
		expect(claudeProfileContent).toContain('fileMap: {}');
		expect(claudeProfileContent).toContain('conversionConfig: {}');
		expect(claudeProfileContent).toContain('globalReplacements: []');
	});

	test('claude.js has lifecycle functions for file management', () => {
		expect(claudeProfileContent).toContain('function onAddRulesProfile');
		expect(claudeProfileContent).toContain('function onRemoveRulesProfile');
		expect(claudeProfileContent).toContain(
			'function onPostConvertRulesProfile'
		);
	});

	test('claude.js copies AGENTS.md to CLAUDE.md', () => {
		expect(claudeProfileContent).toContain("'AGENTS.md'");
		expect(claudeProfileContent).toContain("'CLAUDE.md'");
		expect(claudeProfileContent).toContain('copyFileSync');
	});

	test('claude.js has proper error handling', () => {
		expect(claudeProfileContent).toContain('try {');
		expect(claudeProfileContent).toContain('} catch (err) {');
		expect(claudeProfileContent).toContain("log('error'");
	});
});
