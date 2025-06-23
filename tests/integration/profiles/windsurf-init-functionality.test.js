import fs from 'fs';
import path from 'path';
import { windsurfProfile } from '../../../src/profiles/windsurf.js';

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
		// Check that the profile file explicitly sets name and displayName (required fields)
		expect(windsurfProfileContent).toContain("name: 'windsurf'");
		expect(windsurfProfileContent).toContain("displayName: 'Windsurf'");
		expect(windsurfProfileContent).toContain("profileDir: '.windsurf'");
		expect(windsurfProfileContent).toContain("rulesDir: '.windsurf/rules'");
	});

	test('windsurf.js configures .mdc to .md extension mapping', () => {
		// Check that the profile file explicitly sets extension configuration
		expect(windsurfProfileContent).toContain("fileExtension: '.mdc'");
		expect(windsurfProfileContent).toContain("targetExtension: '.md'");
	});

	test('windsurf.js uses standard tool mappings', () => {
		// Check that the profile uses standard tool mappings
		expect(windsurfProfileContent).toContain('COMMON_TOOL_MAPPINGS.STANDARD');
	});

	test('windsurf.js contains correct URL configuration', () => {
		// Check that the profile file explicitly sets URL configuration
		expect(windsurfProfileContent).toContain("url: 'windsurf.com'");
		expect(windsurfProfileContent).toContain("docsUrl: 'docs.windsurf.com'");
	});
});
