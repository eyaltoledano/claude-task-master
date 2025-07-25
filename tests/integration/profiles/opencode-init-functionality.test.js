import fs from 'fs';
import path from 'path';
import { opencodeProfile } from '../../../src/profiles/opencode.js';

describe('OpenCode Profile Initialization Functionality', () => {
	let opencodeProfileContent;

	beforeAll(() => {
		const opencodeJsPath = path.join(
			process.cwd(),
			'src',
			'profiles',
			'opencode.js'
		);
		opencodeProfileContent = fs.readFileSync(opencodeJsPath, 'utf8');
	});

	test('opencode.js has correct asset-only profile configuration', () => {
		// Check for ProfileBuilder.minimal('opencode')
		expect(opencodeProfileContent).toContain(
			"ProfileBuilder.minimal('opencode')"
		);
		expect(opencodeProfileContent).toContain(".display('OpenCode')");
		expect(opencodeProfileContent).toContain(".profileDir('.')"); // Root directory
		expect(opencodeProfileContent).toContain(".rulesDir('.')"); // Root directory for AGENTS.md
		expect(opencodeProfileContent).toContain('.includeDefaultRules(false)');

		// Check the final computed properties on the profile object
		expect(opencodeProfile.profileName).toBe('opencode');
		expect(opencodeProfile.displayName).toBe('OpenCode');
		expect(opencodeProfile.profileDir).toBe('.'); // non-default
		expect(opencodeProfile.rulesDir).toBe('.'); // non-default
		expect(opencodeProfile.includeDefaultRules).toBe(false); // non-default
		expect(opencodeProfile.fileMap['AGENTS.md']).toBe('AGENTS.md');
	});

	test('opencode.js has lifecycle functions for MCP config transformation', () => {
		expect(opencodeProfileContent).toContain(
			'function onPostConvertRulesProfile'
		);
		expect(opencodeProfileContent).toContain('function onRemoveRulesProfile');
		expect(opencodeProfileContent).toContain('transformToOpenCodeFormat');
	});

	test('opencode.js handles opencode.json transformation in lifecycle functions', () => {
		expect(opencodeProfileContent).toContain('opencode.json');
		expect(opencodeProfileContent).toContain('transformToOpenCodeFormat');
		expect(opencodeProfileContent).toContain('$schema');
		expect(opencodeProfileContent).toContain('mcpServers');
		expect(opencodeProfileContent).toContain('mcp');
	});

	test('opencode.js has proper error handling in lifecycle functions', () => {
		expect(opencodeProfileContent).toContain('try {');
		expect(opencodeProfileContent).toContain('} catch (error) {');
		expect(opencodeProfileContent).toContain('log(');
	});

	test('opencode.js uses custom MCP config name', () => {
		// OpenCode uses opencode.json instead of mcp.json with ProfileBuilder syntax
		expect(opencodeProfileContent).toContain("configName: 'opencode.json'");
		// Should not contain mcp.json as a config value (comments are OK)
		expect(opencodeProfileContent).not.toMatch(
			/configName:\s*['"]mcp\.json['"]/
		);
		// Check the final computed properties
		expect(opencodeProfile.mcpConfigName).toBe('opencode.json');
		expect(opencodeProfile.mcpConfigPath).toBe('opencode.json'); // Root directory doesn't need ./
	});

	test('opencode.js has transformation logic for OpenCode format', () => {
		// Check for transformation function
		expect(opencodeProfileContent).toContain('transformToOpenCodeFormat');

		// Check for specific transformation logic
		expect(opencodeProfileContent).toContain('mcpServers');
		expect(opencodeProfileContent).toContain('command');
		expect(opencodeProfileContent).toContain('args');
		expect(opencodeProfileContent).toContain('environment');
		expect(opencodeProfileContent).toContain('enabled');
		expect(opencodeProfileContent).toContain('type');
	});
});
