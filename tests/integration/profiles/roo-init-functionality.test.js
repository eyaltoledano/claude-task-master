import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Roo Profile Initialization Functionality', () => {
	let rooProfileContent;

	beforeAll(() => {
		// Read the roo.js profile file content once for all tests
		const rooJsPath = path.join(process.cwd(), 'src', 'profiles', 'roo.js');
		rooProfileContent = fs.readFileSync(rooJsPath, 'utf8');
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
