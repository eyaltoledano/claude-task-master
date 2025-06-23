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
		// Check that the profile file explicitly sets name and displayName (required fields)
		expect(cursorProfileContent).toContain("name: 'cursor'");
		expect(cursorProfileContent).toContain("displayName: 'Cursor'");
		// Check that the profile object has the correct properties (using defaults)
		expect(cursorProfile.profileDir).toBe('.cursor');
		expect(cursorProfile.rulesDir).toBe('.cursor/rules');
	});

	test('cursor.js preserves .mdc extension in both input and output', () => {
		// Check that the profile object has the correct file mapping behavior (cursor keeps .mdc)
		expect(cursorProfile.fileMap['rules/cursor_rules.mdc']).toBe(
			'cursor_rules.mdc'
		);
		// Also check that targetExtension is explicitly set in the file
		expect(cursorProfileContent).toContain("targetExtension: '.mdc'");
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

	test('cursor.js contains correct URL configuration', () => {
		// Check that the profile file explicitly sets URL configuration
		expect(cursorProfileContent).toContain("url: 'cursor.so'");
		expect(cursorProfileContent).toContain("docsUrl: 'docs.cursor.com'");
	});
});
