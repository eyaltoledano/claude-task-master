import fs from 'fs';
import path from 'path';

describe('Windsurf Profile Initialization Functionality', () => {
	let windsurfProfileContent;

	beforeAll(() => {
		const windsurfJsPath = path.join(
			process.cwd(),
			'scripts',
			'profiles',
			'windsurf.js'
		);
		windsurfProfileContent = fs.readFileSync(windsurfJsPath, 'utf8');
	});

	test('windsurf.js exports correct brandName and rulesDir', () => {
		expect(windsurfProfileContent).toContain("const brandName = 'Windsurf'");
		expect(windsurfProfileContent).toContain(
			"const rulesDir = '.windsurf/rules'"
		);
	});

	test('windsurf.js contains fileMap for .mdc to .md mapping', () => {
		expect(windsurfProfileContent).toContain('fileMap = {');
		expect(windsurfProfileContent).toContain(".mdc'");
		expect(windsurfProfileContent).toContain(".md'");
	});

	test('windsurf.js contains tool renaming and extension logic', () => {
		expect(windsurfProfileContent).toContain('edit_file');
		expect(windsurfProfileContent).toContain('apply_diff');
		expect(windsurfProfileContent).toContain('search tool');
		expect(windsurfProfileContent).toContain('search_files tool');
		expect(windsurfProfileContent).toContain('.mdc');
		expect(windsurfProfileContent).toContain('.md');
	});

	test('windsurf.js contains correct documentation URL transformation', () => {
		expect(windsurfProfileContent).toContain('docs.cursor.com');
		expect(windsurfProfileContent).toContain('docs.windsurf.com');
	});
});
