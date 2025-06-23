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
		// Check that the profile object has the correct file mapping behavior (cline converts to .md)
		expect(clineProfile.fileMap['rules/cursor_rules.mdc']).toBe(
			'cline_rules.md'
		);
	});

	test('cline.js uses standard tool mappings', () => {
		// Check that the profile uses default tool mappings (equivalent to COMMON_TOOL_MAPPINGS.STANDARD)
		// This verifies the architectural pattern: no custom toolMappings = standard tool names
		expect(clineProfileContent).not.toContain('toolMappings:');
		expect(clineProfileContent).not.toContain('apply_diff');
		expect(clineProfileContent).not.toContain('search_files');

		// Verify the result: default mappings means tools keep their original names
		expect(clineProfile.conversionConfig.toolNames.edit_file).toBe('edit_file');
		expect(clineProfile.conversionConfig.toolNames.search).toBe('search');
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
