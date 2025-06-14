import fs from 'fs';
import path from 'path';

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
		expect(cursorProfileContent).toContain("name: 'cursor'");
		expect(cursorProfileContent).toContain("displayName: 'Cursor'");
		expect(cursorProfileContent).toContain("rulesDir: '.cursor/rules'");
		expect(cursorProfileContent).toContain("profileDir: '.cursor'");
	});

	test('cursor.js preserves .mdc extension in both input and output', () => {
		expect(cursorProfileContent).toContain("fileExtension: '.mdc'");
		expect(cursorProfileContent).toContain("targetExtension: '.mdc'");
		// Should preserve cursor_rules.mdc filename
		expect(cursorProfileContent).toContain(
			"'cursor_rules.mdc': 'cursor_rules.mdc'"
		);
	});

	test('cursor.js uses standard tool mappings (no tool renaming)', () => {
		expect(cursorProfileContent).toContain('COMMON_TOOL_MAPPINGS.STANDARD');
		// Should not contain custom tool mappings since cursor keeps original names
		expect(cursorProfileContent).not.toContain('edit_file');
		expect(cursorProfileContent).not.toContain('apply_diff');
	});

	test('cursor.js contains correct URL configuration', () => {
		expect(cursorProfileContent).toContain("url: 'cursor.so'");
		expect(cursorProfileContent).toContain("docsUrl: 'docs.cursor.com'");
	});
});
