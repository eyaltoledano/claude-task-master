import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { rooProfile } from '../../../src/profiles/roo.js';
import { COMMON_TOOL_MAPPINGS } from '../../../src/profiles/base-profile.js';

describe('Roo Profile Initialization Functionality', () => {
	let rooProfileContent;

	beforeAll(() => {
		// Read the roo.js profile file content once for all tests
		const rooJsPath = path.join(process.cwd(), 'src', 'profiles', 'roo.js');
		rooProfileContent = fs.readFileSync(rooJsPath, 'utf8');
	});

	test('roo.js uses factory pattern with correct configuration', () => {
		// Check for explicit, non-default values in the source file
		expect(rooProfileContent).toContain("name: 'roo'");
		expect(rooProfileContent).toContain("displayName: 'Roo Code'");
		expect(rooProfileContent).toContain(
			'toolMappings: COMMON_TOOL_MAPPINGS.ROO_STYLE'
		);

		// Check the final computed properties on the profile object
		expect(rooProfile.profileName).toBe('roo');
		expect(rooProfile.displayName).toBe('Roo Code');
		expect(rooProfile.profileDir).toBe('.roo'); // default
		expect(rooProfile.rulesDir).toBe('.roo/rules'); // default
		expect(rooProfile.mcpConfig).toBe(true); // now uses standard MCP configuration with Roo enhancements
	});

	test('roo.js uses custom ROO_STYLE tool mappings', () => {
		// Check that the profile uses the correct, non-standard tool mappings
		expect(rooProfileContent).toContain(
			'toolMappings: COMMON_TOOL_MAPPINGS.ROO_STYLE'
		);

		// Verify the result: roo uses custom tool names
		expect(rooProfile.conversionConfig.toolNames.edit_file).toBe('apply_diff');
		expect(rooProfile.conversionConfig.toolNames.search).toBe('search_files');
	});

	test('roo.js profile ensures Roo directory structure via onAddRulesProfile', () => {
		// Check if onAddRulesProfile function exists
		expect(rooProfileContent).toContain(
			'onAddRulesProfile(targetDir, assetsDir)'
		);

		// Check for the general copy of assets/roocode which includes .roo base structure
		expect(rooProfileContent).toContain(
			"const sourceDir = path.join(assetsDir, 'roocode');"
		);
		expect(rooProfileContent).toContain(
			'copyRecursiveSync(sourceDir, targetDir);'
		);

		// Check for the specific .roo modes directory handling
		expect(rooProfileContent).toContain(
			"const rooModesDir = path.join(sourceDir, '.roo');"
		);

		// Check for import of ROO_MODES from profiles.js instead of local definition
		expect(rooProfileContent).toContain(
			"import { ROO_MODES } from '../constants/profiles.js';"
		);
	});

	test('roo.js profile copies .roomodes file via onAddRulesProfile', () => {
		expect(rooProfileContent).toContain(
			'onAddRulesProfile(targetDir, assetsDir)'
		);

		// Check for the specific .roomodes copy logic
		expect(rooProfileContent).toContain(
			"const roomodesSrc = path.join(sourceDir, '.roomodes');"
		);
		expect(rooProfileContent).toContain(
			"const roomodesDest = path.join(targetDir, '.roomodes');"
		);
		expect(rooProfileContent).toContain(
			'fs.copyFileSync(roomodesSrc, roomodesDest);'
		);
	});

	test('roo.js profile copies mode-specific rule files via onAddRulesProfile', () => {
		expect(rooProfileContent).toContain(
			'onAddRulesProfile(targetDir, assetsDir)'
		);
		expect(rooProfileContent).toContain('for (const mode of ROO_MODES)');

		// Check for the specific mode rule file copy logic
		expect(rooProfileContent).toContain(
			'const src = path.join(rooModesDir, `rules-${mode}`, `${mode}-rules`);'
		);
		expect(rooProfileContent).toContain(
			"const dest = path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`);"
		);
	});
});
