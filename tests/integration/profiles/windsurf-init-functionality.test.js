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
		// Check that the profile object has the correct properties (using defaults)
		expect(windsurfProfile.profileDir).toBe('.windsurf');
		expect(windsurfProfile.rulesDir).toBe('.windsurf/rules');
	});

	test('windsurf.js configures .mdc to .md extension mapping', () => {
		// Check that the profile object has the correct file mapping behavior (windsurf converts to .md)
		expect(windsurfProfile.fileMap['rules/cursor_rules.mdc']).toBe(
			'windsurf_rules.md'
		);
	});

	test('windsurf.js uses standard tool mappings', () => {
		// Check that the profile uses default tool mappings (equivalent to COMMON_TOOL_MAPPINGS.STANDARD)
		// This verifies the architectural pattern: no custom toolMappings = standard tool names
		expect(windsurfProfileContent).not.toContain('toolMappings:');
		expect(windsurfProfileContent).not.toContain('apply_diff');
		expect(windsurfProfileContent).not.toContain('search_files');

		// Verify the result: default mappings means tools keep their original names
		expect(windsurfProfile.conversionConfig.toolNames.edit_file).toBe(
			'edit_file'
		);
		expect(windsurfProfile.conversionConfig.toolNames.search).toBe('search');
	});

	test('windsurf.js contains correct URL configuration', () => {
		// Check that the profile file explicitly sets URL configuration
		expect(windsurfProfileContent).toContain("url: 'windsurf.com'");
		expect(windsurfProfileContent).toContain("docsUrl: 'docs.windsurf.com'");
	});
});
