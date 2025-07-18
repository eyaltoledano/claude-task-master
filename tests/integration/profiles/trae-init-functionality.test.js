import fs from 'fs';
import path from 'path';
import { traeProfile } from '../../../src/profiles/trae.js';
import { ProfileAdapter } from '../../../src/profile/ProfileAdapter.js';

describe('Trae Profile Initialization Functionality', () => {
	let traeProfileContent;
	let adaptedProfile;

	beforeAll(() => {
		const traeJsPath = path.join(process.cwd(), 'src', 'profiles', 'trae.js');
		traeProfileContent = fs.readFileSync(traeJsPath, 'utf8');
		
		// Use ProfileAdapter to ensure compatibility with both legacy and new formats
		adaptedProfile = ProfileAdapter.adaptLegacyProfile(traeProfile);
	});

	test('trae.js uses ProfileBuilder pattern with correct configuration', () => {
		// Check for ProfileBuilder pattern in the source file
		expect(traeProfileContent).toContain("ProfileBuilder");
		expect(traeProfileContent).toContain(".minimal('trae')");
		expect(traeProfileContent).toContain(".display('Trae')");
		expect(traeProfileContent).toContain('.mcpConfig(false)'); // Trae doesn't use MCP

		// Check the final computed properties on the adapted profile object
		expect(adaptedProfile.profileName).toBe('trae');
		expect(adaptedProfile.displayName).toBe('Trae');
		expect(adaptedProfile.profileDir).toBe('.trae');
		expect(adaptedProfile.rulesDir).toBe('.trae/rules');
		expect(adaptedProfile.hasMcpConfig()).toBe(false); // Trae specific setting
	});

	test('trae.js configures .mdc to .md extension mapping', () => {
		// Check that the profile object has the correct file mapping behavior (trae converts to .md)
		expect(adaptedProfile.fileMap['rules/cursor_rules.mdc']).toBe('trae_rules.md');
	});

	test('trae.js uses standard tool mappings', () => {
		// Check that the profile uses default tool mappings (equivalent to COMMON_TOOL_MAPPINGS.STANDARD)
		// This verifies the architectural pattern: no custom toolMappings = standard tool names
		expect(traeProfileContent).not.toContain('apply_diff');
		expect(traeProfileContent).not.toContain('search_files');

		// Verify the result: default mappings means tools keep their original names
		expect(adaptedProfile.conversionConfig.toolNames.edit_file).toBe('edit_file');
		expect(adaptedProfile.conversionConfig.toolNames.search).toBe('search');
	});

	test('profile can be converted to legacy format for backward compatibility', () => {
		// Test that the Profile instance can be converted back to legacy format
		const legacyFormat = adaptedProfile.toLegacyFormat();
		
		expect(legacyFormat.profileName).toBe('trae');
		expect(legacyFormat.displayName).toBe('Trae');
		expect(legacyFormat.mcpConfig).toBe(false);
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
