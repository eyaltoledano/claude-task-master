import fs from 'fs';
import path from 'path';

describe('Codex Profile Initialization Functionality', () => {
	let codexProfileContent;

	beforeAll(() => {
		const codexJsPath = path.join(process.cwd(), 'src', 'profiles', 'codex.js');
		codexProfileContent = fs.readFileSync(codexJsPath, 'utf8');
	});

	test('codex.js is a simple profile with correct configuration', () => {
		expect(codexProfileContent).toContain("profileName: 'codex'");
		expect(codexProfileContent).toContain("displayName: 'Codex'");
		expect(codexProfileContent).toContain("profileDir: '.'");
		expect(codexProfileContent).toContain("rulesDir: '.'");
	});

	test('codex.js has no MCP configuration', () => {
		expect(codexProfileContent).toContain('mcpConfig: false');
		expect(codexProfileContent).toContain('mcpConfigName: null');
		expect(codexProfileContent).toContain('mcpConfigPath: null');
	});

	test('codex.js has empty file map (simple profile)', () => {
		expect(codexProfileContent).toContain('fileMap: {}');
		expect(codexProfileContent).toContain('conversionConfig: {}');
		expect(codexProfileContent).toContain('globalReplacements: []');
	});

	test('codex.js has lifecycle functions for file management', () => {
		expect(codexProfileContent).toContain('function onAddRulesProfile');
		expect(codexProfileContent).toContain('function onRemoveRulesProfile');
		expect(codexProfileContent).toContain('function onPostConvertRulesProfile');
	});

	test('codex.js copies AGENTS.md to AGENTS.md (same filename)', () => {
		expect(codexProfileContent).toContain("'AGENTS.md'");
		expect(codexProfileContent).toContain('copyFileSync');
		// Should copy to the same filename (AGENTS.md)
		expect(codexProfileContent).toMatch(/destFile.*AGENTS\.md/);
	});

	test('codex.js has proper error handling', () => {
		expect(codexProfileContent).toContain('try {');
		expect(codexProfileContent).toContain('} catch (err) {');
		expect(codexProfileContent).toContain("log('error'");
	});

	test('codex.js removes AGENTS.md on profile removal', () => {
		expect(codexProfileContent).toContain('rmSync');
		expect(codexProfileContent).toContain('force: true');
	});
});
