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
		// Check for explicit, non-default values in the source file
		expect(opencodeProfileContent).toContain("name: 'opencode'");
		expect(opencodeProfileContent).toContain("displayName: 'OpenCode'");
		expect(opencodeProfileContent).toContain("url: 'opencode.ai'");
		expect(opencodeProfileContent).toContain("docsUrl: 'opencode.ai/docs/'");
		expect(opencodeProfileContent).toContain("profileDir: '.'"); // non-default
		expect(opencodeProfileContent).toContain("rulesDir: '.'"); // non-default
		expect(opencodeProfileContent).toContain("mcpConfigName: 'opencode.json'"); // non-default
		expect(opencodeProfileContent).toContain('includeDefaultRules: false'); // non-default
		expect(opencodeProfileContent).toContain("'AGENTS.md': 'AGENTS.md'");

		// Check the final computed properties on the profile object
		expect(opencodeProfile.profileName).toBe('opencode');
		expect(opencodeProfile.displayName).toBe('OpenCode');
		expect(opencodeProfile.profileDir).toBe('.');
		expect(opencodeProfile.rulesDir).toBe('.');
		expect(opencodeProfile.mcpConfig).toBe(true); // computed from mcpConfigName
		expect(opencodeProfile.mcpConfigName).toBe('opencode.json');
		expect(opencodeProfile.mcpConfigPath).toBe('opencode.json'); // computed
		expect(opencodeProfile.includeDefaultRules).toBe(false);
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
		// OpenCode uses opencode.json instead of mcp.json
		expect(opencodeProfileContent).toContain("mcpConfigName: 'opencode.json'");
		// Should not contain mcp.json as a config value (comments are OK)
		expect(opencodeProfileContent).not.toMatch(
			/mcpConfigName:\s*['"]mcp\.json['"]/
		);
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
