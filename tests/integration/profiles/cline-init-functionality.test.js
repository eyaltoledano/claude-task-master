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
		// Check for ProfileBuilder syntax in the source file
		expect(clineProfileContent).toContain("ProfileBuilder.minimal('cline')");
		expect(clineProfileContent).toContain(".display('Cline')");
		expect(clineProfileContent).toContain(".profileDir('.clinerules')"); // non-default
		expect(clineProfileContent).toContain(".rulesDir('.clinerules')"); // non-default
		expect(clineProfileContent).toContain('.mcpConfig(false)');
		expect(clineProfileContent).toContain('.includeDefaultRules(true)');

		// Check the final computed properties on the profile object
		expect(clineProfile.profileName).toBe('cline');
		expect(clineProfile.displayName).toBe('Cline');
		expect(clineProfile.profileDir).toBe('.clinerules'); // non-default
		expect(clineProfile.rulesDir).toBe('.clinerules'); // non-default
		expect(clineProfile.mcpConfig).toBe(false); // no MCP
		expect(clineProfile.mcpConfigName).toBe(null); // no MCP config
		expect(clineProfile.includeDefaultRules).toBe(true); // includes default rules
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

	test('cline.js has custom file mapping for cursor_rules.mdc', () => {
		// Check actual behavior - cline gets default rule files
		expect(Object.keys(clineProfile.fileMap)).toContain(
			'rules/cursor_rules.mdc'
		);
		expect(clineProfile.fileMap['rules/cursor_rules.mdc']).toBe(
			'cline_rules.md'
		);
	});

	test('cline.js uses ProfileBuilder factory function', () => {
		expect(clineProfileContent).toContain('ProfileBuilder.minimal');
		expect(clineProfileContent).toContain('.build()');
		expect(clineProfileContent).toContain('export { clineProfile }');
	});
});
