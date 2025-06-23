import fs from 'fs';
import path from 'path';
import { traeProfile } from '../../../src/profiles/trae.js';

describe('Trae Profile Initialization Functionality', () => {
	let traeProfileContent;

	beforeAll(() => {
		const traeJsPath = path.join(process.cwd(), 'src', 'profiles', 'trae.js');
		traeProfileContent = fs.readFileSync(traeJsPath, 'utf8');
	});

	test('trae.js uses factory pattern with correct configuration', () => {
		// Check actual profile configuration behavior
		expect(traeProfile.profileName).toBe('trae');
		expect(traeProfile.displayName).toBe('Trae');
		expect(traeProfile.rulesDir).toBe('.trae/rules');
		expect(traeProfile.profileDir).toBe('.trae');

		// Still check that the profile file explicitly sets name and displayName (required fields)
		expect(traeProfileContent).toContain("name: 'trae'");
		expect(traeProfileContent).toContain("displayName: 'Trae'");
	});

	test('trae.js configures .mdc to .md extension mapping', () => {
		// Check that the profile object has the correct file mapping behavior (trae converts to .md)
		expect(traeProfile.fileMap['rules/cursor_rules.mdc']).toBe('trae_rules.md');
	});

	test('trae.js uses standard tool mappings', () => {
		// Check that the profile uses default tool mappings (equivalent to COMMON_TOOL_MAPPINGS.STANDARD)
		// This verifies the architectural pattern: no custom toolMappings = standard tool names
		expect(traeProfileContent).not.toContain('toolMappings:');
		expect(traeProfileContent).not.toContain('apply_diff');
		expect(traeProfileContent).not.toContain('search_files');

		// Verify the result: default mappings means tools keep their original names
		expect(traeProfile.conversionConfig.toolNames.edit_file).toBe('edit_file');
		expect(traeProfile.conversionConfig.toolNames.search).toBe('search');
	});

	test('trae.js contains correct URL configuration', () => {
		// Check that the profile file explicitly sets URL configuration
		expect(traeProfileContent).toContain("url: 'trae.ai'");
		expect(traeProfileContent).toContain("docsUrl: 'docs.trae.ai'");
	});

	test('trae.js has MCP configuration disabled', () => {
		// Check actual behavior
		expect(traeProfile.mcpConfig).toBe(false);
		expect(traeProfile.mcpConfigName).toBe(null);
		// Check that mcpConfig: false is explicitly set (since it's non-default)
		expect(traeProfileContent).toContain('mcpConfig: false');
	});
});
