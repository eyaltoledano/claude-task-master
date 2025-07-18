import fs from 'fs';
import path from 'path';
import { windsurfProfile } from '../../../src/profiles/windsurf.js';
import { ProfileAdapter } from '../../../src/profile/ProfileAdapter.js';

describe('Windsurf Profile Initialization Functionality', () => {
	let windsurfProfileContent;
	let adaptedProfile;

	beforeAll(() => {
		const windsurfJsPath = path.join(
			process.cwd(),
			'src',
			'profiles',
			'windsurf.js'
		);
		windsurfProfileContent = fs.readFileSync(windsurfJsPath, 'utf8');
		
		// Use ProfileAdapter to ensure compatibility with both legacy and new formats
		adaptedProfile = ProfileAdapter.adaptLegacyProfile(windsurfProfile);
	});

	test('windsurf.js uses ProfileBuilder pattern with correct configuration', () => {
		// Check for ProfileBuilder pattern in the source file
		expect(windsurfProfileContent).toContain("ProfileBuilder");
		expect(windsurfProfileContent).toContain(".minimal('windsurf')");
		expect(windsurfProfileContent).toContain(".display('Windsurf')");

		// Check the final computed properties on the adapted profile object
		expect(adaptedProfile.profileName).toBe('windsurf');
		expect(adaptedProfile.displayName).toBe('Windsurf');
		expect(adaptedProfile.profileDir).toBe('.windsurf');
		expect(adaptedProfile.rulesDir).toBe('.windsurf/rules');
		expect(adaptedProfile.hasMcpConfig()).toBe(true);
	});

	test('windsurf.js configures .mdc to .md extension mapping', () => {
		// Check that the profile object has the correct file mapping behavior (windsurf converts to .md)
		expect(adaptedProfile.fileMap['rules/cursor_rules.mdc']).toBe(
			'windsurf_rules.md'
		);
	});

	test('windsurf.js uses standard tool mappings', () => {
		// Check that the profile uses default tool mappings (equivalent to COMMON_TOOL_MAPPINGS.STANDARD)
		// This verifies the architectural pattern: no custom toolMappings = standard tool names
		expect(windsurfProfileContent).not.toContain('apply_diff');
		expect(windsurfProfileContent).not.toContain('search_files');

		// Verify the result: default mappings means tools keep their original names
		expect(adaptedProfile.conversionConfig.toolNames.edit_file).toBe(
			'edit_file'
		);
		expect(adaptedProfile.conversionConfig.toolNames.search).toBe('search');
	});

	test('profile can be converted to legacy format for backward compatibility', () => {
		// Test that the Profile instance can be converted back to legacy format
		const legacyFormat = adaptedProfile.toLegacyFormat();
		
		expect(legacyFormat.profileName).toBe('windsurf');
		expect(legacyFormat.displayName).toBe('Windsurf');
		expect(legacyFormat.fileMap).toBeDefined();
		expect(legacyFormat.conversionConfig).toBeDefined();
		expect(legacyFormat.globalReplacements).toBeDefined();
	});

	test('profile is immutable when using new system', () => {
		// Test that the new Profile instances are immutable
		if (adaptedProfile.constructor.name === 'Profile') {
			expect(Object.isFrozen(adaptedProfile)).toBe(true);
		}
	});
});
