import fs from 'fs';
import path from 'path';
import { cursorProfile } from '../../../src/profiles/cursor.js';

describe('Cursor Profile Initialization Functionality', () => {
	let cursorProfileContent;

	beforeAll(() => {
		const cursorJsPath = path.join(
			process.cwd(),
			'src',
			'profiles',
			'cursor.js'
		);
		cursorProfileContent = fs.readFileSync(cursorJsPath, 'utf8');
	});

	test('cursor.js uses factory pattern with correct configuration', () => {
		// Check for ProfileBuilder syntax in the source file
		expect(cursorProfileContent).toContain("ProfileBuilder.minimal('cursor')");
		expect(cursorProfileContent).toContain(".display('Cursor')");
		expect(cursorProfileContent).toContain(".profileDir('.cursor')");
		expect(cursorProfileContent).toContain(".rulesDir('.cursor/rules')");
		expect(cursorProfileContent).toContain('.includeDefaultRules(false)'); // Cursor explicitly defines its own fileMap

		// Check the final computed properties on the profile object
		expect(cursorProfile.profileName).toBe('cursor');
		expect(cursorProfile.displayName).toBe('Cursor');
		expect(cursorProfile.profileDir).toBe('.cursor'); // default
		expect(cursorProfile.rulesDir).toBe('.cursor/rules'); // default
		expect(cursorProfile.mcpConfig).toBe(true); // default
		expect(cursorProfile.mcpConfigName).toBe('mcp.json'); // default
	});

	test('cursor.js preserves .mdc extension in both input and output', () => {
		// Check that the profile object has the correct file mapping behavior (cursor keeps .mdc)
		expect(cursorProfile.fileMap['rules/cursor_rules.mdc']).toBe(
			'taskmaster/cursor_rules.mdc' // Cursor uses taskmaster subdirectory
		);
		// Cursor maintains .mdc extension through explicit fileMap rather than targetExtension setting
		expect(cursorProfile.fileMap['rules/dev_workflow.mdc']).toBe(
			'taskmaster/dev_workflow.mdc'
		);
	});

	test('cursor.js uses standard tool mappings (no tool renaming)', () => {
		// Check that the profile uses default tool mappings (equivalent to COMMON_TOOL_MAPPINGS.STANDARD)
		// This verifies the architectural pattern: no custom toolMappings = standard tool names
		expect(cursorProfileContent).not.toContain('toolMappings:');
		expect(cursorProfileContent).not.toContain('apply_diff');
		expect(cursorProfileContent).not.toContain('search_files');

		// Verify the result: default mappings means tools keep their original names
		expect(cursorProfile.conversionConfig.toolNames.edit_file).toBe(
			'edit_file'
		);
		expect(cursorProfile.conversionConfig.toolNames.search).toBe('search');
	});
});
