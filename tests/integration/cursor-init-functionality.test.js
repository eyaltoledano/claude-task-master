import fs from 'fs';
import path from 'path';

describe('Cursor Profile Initialization Functionality', () => {
	let cursorProfileContent;

	beforeAll(() => {
		const cursorJsPath = path.join(
			process.cwd(),
			'scripts',
			'profiles',
			'cursor.js'
		);
		cursorProfileContent = fs.readFileSync(cursorJsPath, 'utf8');
	});

	test('cursor.js exports correct brandName and rulesDir', () => {
		expect(cursorProfileContent).toContain("const brandName = 'Cursor'");
		expect(cursorProfileContent).toContain("const rulesDir = '.cursor/rules'");
	});

	test('cursor.js preserves .mdc filenames in fileMap', () => {
		expect(cursorProfileContent).toContain('fileMap = {');
		// Should NOT contain any .md mapping
		expect(cursorProfileContent).not.toMatch(/\.md'/);
	});

	test('cursor.js contains tool naming logic and global replacements', () => {
		expect(cursorProfileContent).toContain('edit_file');
		expect(cursorProfileContent).toContain('search tool');
		expect(cursorProfileContent).not.toContain('apply_diff');
		expect(cursorProfileContent).not.toContain('search_files tool');
	});

	test('cursor.js contains correct documentation URL logic', () => {
		expect(cursorProfileContent).toContain('docs.cursor.com');
	});
});
