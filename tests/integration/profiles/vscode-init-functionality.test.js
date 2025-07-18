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
		// Check for ProfileBuilder syntax in the source file
		expect(vscodeProfileContent).toContain("ProfileBuilder.minimal('vscode')");
		expect(vscodeProfileContent).toContain(".display('VS Code')");
		expect(vscodeProfileContent).toContain(".profileDir('.vscode')"); // MCP config in .vscode
		expect(vscodeProfileContent).toContain(".rulesDir('.github/instructions')"); // Rules in .github/instructions
		expect(vscodeProfileContent).toContain('.mcpConfig(true)');
		expect(vscodeProfileContent).toContain('.includeDefaultRules(true)');

		// Check the final computed properties on the profile object
		expect(vscodeProfile.profileName).toBe('vscode');
		expect(vscodeProfile.displayName).toBe('VS Code');
		expect(vscodeProfile.profileDir).toBe('.vscode'); // non-default
		expect(vscodeProfile.rulesDir).toBe('.github/instructions'); // non-default
		expect(vscodeProfile.mcpConfig).toBe(true); // default
		expect(vscodeProfile.mcpConfigName).toBe('mcp.json'); // default
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
});
