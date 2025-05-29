import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Roo Profile Initialization Functionality', () => {
	let rooProfileContent;

	beforeAll(() => {
		// Read the roo.js profile file content once for all tests
		const rooJsPath = path.join(process.cwd(), 'scripts', 'profiles', 'roo.js');
		rooProfileContent = fs.readFileSync(rooJsPath, 'utf8');
	});

	test('roo.js profile ensures Roo directory structure via onAddRulesProfile', () => {
		// Check if onAddRulesProfile function exists
		expect(rooProfileContent).toContain('onAddRulesProfile(targetDir)');

		// Check for the general copy of assets/roocode which includes .roo base structure
		expect(rooProfileContent).toContain(
			"const sourceDir = path.join(process.cwd(), 'assets', 'roocode');"
		);
		expect(rooProfileContent).toContain(
			'copyRecursiveSync(sourceDir, targetDir);'
		);

		// Check for the specific .roo modes directory handling
		expect(rooProfileContent).toContain(
			"const rooModesDir = path.join(sourceDir, '.roo');"
		);
		expect(rooProfileContent).toContain(
			"const rooModes = ['architect', 'ask', 'boomerang', 'code', 'debug', 'test'];"
		);
	});

	test('roo.js profile copies .roomodes file via onAddRulesProfile', () => {
		expect(rooProfileContent).toContain('onAddRulesProfile(targetDir)');

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
		expect(rooProfileContent).toContain('onAddRulesProfile(targetDir)');
		expect(rooProfileContent).toContain('for (const mode of rooModes)');

		// Check for the specific mode rule file copy logic
		expect(rooProfileContent).toContain(
			'const src = path.join(rooModesDir, `rules-${mode}`, `${mode}-rules`);'
		);
		expect(rooProfileContent).toContain(
			"const dest = path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`);"
		);
	});
});
