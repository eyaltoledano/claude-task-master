import fs from 'fs';
import path from 'path';

describe('Cline Profile Initialization Functionality', () => {
	let clineProfileContent;

	beforeAll(() => {
		const clineJsPath = path.join(process.cwd(), 'src', 'profiles', 'cline.js');
		clineProfileContent = fs.readFileSync(clineJsPath, 'utf8');
	});

	test('cline.js uses factory pattern with correct configuration', () => {
		expect(clineProfileContent).toContain("name: 'cline'");
		expect(clineProfileContent).toContain("displayName: 'Cline'");
		expect(clineProfileContent).toContain("rulesDir: '.clinerules'");
		expect(clineProfileContent).toContain("profileDir: '.clinerules'");
	});

	test('cline.js configures .mdc to .md extension mapping', () => {
		expect(clineProfileContent).toContain("fileExtension: '.mdc'");
		expect(clineProfileContent).toContain("targetExtension: '.md'");
	});

	test('cline.js uses standard tool mappings', () => {
		expect(clineProfileContent).toContain('COMMON_TOOL_MAPPINGS.STANDARD');
		// Should contain comment about standard tool names
		expect(clineProfileContent).toContain('standard tool names');
	});

	test('cline.js contains correct URL configuration', () => {
		expect(clineProfileContent).toContain("url: 'cline.bot'");
		expect(clineProfileContent).toContain("docsUrl: 'docs.cline.bot'");
	});

	test('cline.js has MCP configuration disabled', () => {
		expect(clineProfileContent).toContain('mcpConfig: false');
		expect(clineProfileContent).toContain(
			"mcpConfigName: 'cline_mcp_settings.json'"
		);
	});

	test('cline.js has custom file mapping for cursor_rules.mdc', () => {
		expect(clineProfileContent).toContain('customFileMap:');
		expect(clineProfileContent).toContain(
			"'cursor_rules.mdc': 'cline_rules.md'"
		);
	});

	test('cline.js uses createProfile factory function', () => {
		expect(clineProfileContent).toContain('createProfile');
		expect(clineProfileContent).toContain('export const clineProfile');
	});
});
