import fs from 'fs';
import path from 'path';

describe('Windsurf Profile Initialization Functionality', () => {
	let windsurfProfileContent;

	beforeAll(() => {
		const windsurfJsPath = path.join(
			process.cwd(),
			'src',
			'profiles',
			'windsurf.js'
		);
		windsurfProfileContent = fs.readFileSync(windsurfJsPath, 'utf8');
	});

	test('windsurf.js uses factory pattern with correct configuration', () => {
		expect(windsurfProfileContent).toContain("name: 'windsurf'");
		expect(windsurfProfileContent).toContain("displayName: 'Windsurf'");
		expect(windsurfProfileContent).toContain("rulesDir: '.windsurf/rules'");
		expect(windsurfProfileContent).toContain("profileDir: '.windsurf'");
	});

	test('windsurf.js configures .mdc to .md extension mapping', () => {
		expect(windsurfProfileContent).toContain("fileExtension: '.mdc'");
		expect(windsurfProfileContent).toContain("targetExtension: '.md'");
	});

	test('windsurf.js uses standard tool mappings', () => {
		expect(windsurfProfileContent).toContain('COMMON_TOOL_MAPPINGS.STANDARD');
		// Should contain comment about standard tool names
		expect(windsurfProfileContent).toContain('standard tool names');
	});

	test('windsurf.js contains correct URL configuration', () => {
		expect(windsurfProfileContent).toContain("url: 'windsurf.com'");
		expect(windsurfProfileContent).toContain("docsUrl: 'docs.windsurf.com'");
	});
});
