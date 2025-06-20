import fs from 'fs';
import path from 'path';

describe('Trae Profile Initialization Functionality', () => {
	let traeProfileContent;

	beforeAll(() => {
		const traeJsPath = path.join(process.cwd(), 'src', 'profiles', 'trae.js');
		traeProfileContent = fs.readFileSync(traeJsPath, 'utf8');
	});

	test('trae.js uses factory pattern with correct configuration', () => {
		expect(traeProfileContent).toContain("name: 'trae'");
		expect(traeProfileContent).toContain("displayName: 'Trae'");
		expect(traeProfileContent).toContain("rulesDir: '.trae/rules'");
		expect(traeProfileContent).toContain("profileDir: '.trae'");
	});

	test('trae.js configures .mdc to .md extension mapping', () => {
		expect(traeProfileContent).toContain("fileExtension: '.mdc'");
		expect(traeProfileContent).toContain("targetExtension: '.md'");
	});

	test('trae.js uses standard tool mappings', () => {
		expect(traeProfileContent).toContain('COMMON_TOOL_MAPPINGS.STANDARD');
		// Should contain comment about standard tool names
		expect(traeProfileContent).toContain('standard tool names');
	});

	test('trae.js contains correct URL configuration', () => {
		expect(traeProfileContent).toContain("url: 'trae.ai'");
		expect(traeProfileContent).toContain("docsUrl: 'docs.trae.ai'");
	});

	test('trae.js has MCP configuration disabled', () => {
		expect(traeProfileContent).toContain('mcpConfig: false');
		expect(traeProfileContent).toContain(
			"mcpConfigName: 'trae_mcp_settings.json'"
		);
	});
});
