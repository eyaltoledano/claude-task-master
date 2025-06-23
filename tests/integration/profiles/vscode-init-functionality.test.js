import fs from 'fs';
import path from 'path';
import { vscodeProfile } from '../../../src/profiles/vscode.js';

describe('VSCode Profile Initialization Functionality', () => {
	let vscodeProfileContent;

	beforeAll(() => {
		const vscodeJsPath = path.join(
			process.cwd(),
			'src',
			'profiles',
			'vscode.js'
		);
		vscodeProfileContent = fs.readFileSync(vscodeJsPath, 'utf8');
	});

	test('vscode.js uses factory pattern with correct configuration', () => {
		// Check that the profile file explicitly sets name and displayName (required fields)
		expect(vscodeProfileContent).toContain("name: 'vscode'");
		expect(vscodeProfileContent).toContain("displayName: 'VS Code'");
		// Check that the profile object has the correct properties (using defaults + custom)
		expect(vscodeProfile.profileDir).toBe('.vscode');
		expect(vscodeProfile.rulesDir).toBe('.github/instructions'); // Custom rulesDir
	});

	test('vscode.js configures .mdc to .md extension mapping', () => {
		// Check that the profile object has the correct file mapping behavior (vscode converts to .md)
		expect(vscodeProfile.fileMap['rules/cursor_rules.mdc']).toBe(
			'vscode_rules.md'
		);
	});

	test('vscode.js uses standard tool mappings', () => {
		// Check that the profile uses default tool mappings (equivalent to COMMON_TOOL_MAPPINGS.STANDARD)
		// This verifies the architectural pattern: no custom toolMappings = standard tool names
		expect(vscodeProfileContent).not.toContain('toolMappings:');
		expect(vscodeProfileContent).not.toContain('apply_diff');
		expect(vscodeProfileContent).not.toContain('search_files');

		// Verify the result: default mappings means tools keep their original names
		expect(vscodeProfile.conversionConfig.toolNames.edit_file).toBe(
			'edit_file'
		);
		expect(vscodeProfile.conversionConfig.toolNames.search).toBe('search');
	});

	test('vscode.js contains correct URL configuration', () => {
		// Check that the profile file explicitly sets URL configuration
		expect(vscodeProfileContent).toContain("url: 'code.visualstudio.com'");
		expect(vscodeProfileContent).toContain(
			"docsUrl: 'code.visualstudio.com/docs'"
		);
	});

	test('vscode.js has custom rulesDir configuration', () => {
		// Check that vscode uses a custom rulesDir different from the default
		expect(vscodeProfileContent).toContain("rulesDir: '.github/instructions'");
		expect(vscodeProfile.rulesDir).toBe('.github/instructions');
	});

	test('vscode.js has custom replacements for GitHub workflow', () => {
		// Check that vscode has custom replacements for GitHub-specific naming
		expect(vscodeProfileContent).toContain('customReplacements');
		// Verify runtime behavior: customReplacements become globalReplacements in the profile object
		expect(vscodeProfile.globalReplacements).toBeDefined();
		expect(Array.isArray(vscodeProfile.globalReplacements)).toBe(true);
	});
});
