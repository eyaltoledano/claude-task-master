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
		expect(cursorProfileContent).toContain("profileDir: '.cursor'");
		expect(cursorProfileContent).toContain("rulesDir: '.cursor/rules'");
	});

	test('cursor.js preserves .mdc extension in both input and output', () => {
		// Check that the profile file explicitly sets extension configuration
		expect(cursorProfileContent).toContain("fileExtension: '.mdc'");
		expect(cursorProfileContent).toContain("targetExtension: '.mdc'");
	});

	test('cursor.js uses standard tool mappings (no tool renaming)', () => {
		// Check that the profile uses standard tool mappings
		expect(cursorProfileContent).toContain('COMMON_TOOL_MAPPINGS.STANDARD');
		// Should not contain custom tool mappings since cursor keeps original names
		expect(cursorProfileContent).not.toContain('edit_file');
		expect(cursorProfileContent).not.toContain('apply_diff');
	});

	test('cursor.js contains correct URL configuration', () => {
		// Check that the profile file explicitly sets URL configuration
		expect(cursorProfileContent).toContain("url: 'cursor.so'");
		expect(cursorProfileContent).toContain("docsUrl: 'docs.cursor.com'");
	});
});
