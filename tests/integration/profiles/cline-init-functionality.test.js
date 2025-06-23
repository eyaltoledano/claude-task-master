import fs from 'fs';
import path from 'path';
import { clineProfile } from '../../../src/profiles/cline.js';

describe('Cline Profile Initialization Functionality', () => {
	let clineProfileContent;

	beforeAll(() => {
		const clineJsPath = path.join(process.cwd(), 'src', 'profiles', 'cline.js');
		clineProfileContent = fs.readFileSync(clineJsPath, 'utf8');
	});

	test('cline.js uses factory pattern with correct configuration', () => {
		// Check that the profile file explicitly sets required and non-default fields
		expect(clineProfileContent).toContain("name: 'cline'");
		expect(clineProfileContent).toContain("displayName: 'Cline'");
		expect(clineProfileContent).toContain("profileDir: '.clinerules'");
		expect(clineProfileContent).toContain("rulesDir: '.clinerules'");
	});

	test('cline.js configures .mdc to .md extension mapping', () => {
		// Check that the profile file explicitly sets extension configuration
		expect(clineProfileContent).toContain("fileExtension: '.mdc'");
		expect(clineProfileContent).toContain("targetExtension: '.md'");
	});

	test('cline.js uses standard tool mappings', () => {
		// Check that the profile uses standard tool mappings
		expect(clineProfileContent).toContain('COMMON_TOOL_MAPPINGS.STANDARD');
		expect(clineProfileContent).toContain('standard tool names');
	});

	test('cline.js contains correct URL configuration', () => {
		// Check that the profile file explicitly sets URL configuration
		expect(clineProfileContent).toContain("url: 'cline.bot'");
		expect(clineProfileContent).toContain("docsUrl: 'docs.cline.bot'");
	});

	test('cline.js has MCP configuration disabled', () => {
		// Check actual behavior
		expect(clineProfile.mcpConfig).toBe(false);
		expect(clineProfile.mcpConfigName).toBe(null);
		// Check that mcpConfig: false is explicitly set (since it's non-default)
		expect(clineProfileContent).toContain('mcpConfig: false');
	});

	test('cline.js has custom file mapping for cursor_rules.mdc', () => {
		// Check actual behavior - cline gets default rule files
		expect(Object.keys(clineProfile.fileMap)).toContain(
			'rules/cursor_rules.mdc'
		);
		expect(clineProfile.fileMap['rules/cursor_rules.mdc']).toBe(
			'cline_rules.md'
		);
	});

	test('cline.js uses createProfile factory function', () => {
		expect(clineProfileContent).toContain('createProfile');
		expect(clineProfileContent).toContain('export const clineProfile');
	});
});
