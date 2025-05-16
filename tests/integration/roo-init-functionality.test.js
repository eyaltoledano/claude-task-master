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

	test('roo.js profile ensures Roo directory structure via onAddBrandRules', () => {
		// Check if onAddBrandRules function exists
		expect(rooProfileContent).toContain('onAddBrandRules(targetDir)');

		// Check for the general copy of assets/roocode which includes .roo base structure
		expect(rooProfileContent).toContain(
			'copyRecursiveSync(sourceDir, targetDir)'
		);
		expect(rooProfileContent).toContain(
			"path.resolve(__dirname, '../../assets/roocode')"
		); // Verifies sourceDir definition

		// Check for the loop that processes rooModes
		expect(rooProfileContent).toContain('for (const mode of rooModes)');

		// Check for creation of mode-specific rule directories (e.g., .roo/rules-architect)
		// This is the line: if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
		expect(rooProfileContent).toContain(
			'fs.mkdirSync(destDir, { recursive: true });'
		);
		expect(rooProfileContent).toContain('const destDir = path.dirname(dest);'); // part of the same logic block
	});

	test('roo.js profile copies .roomodes file via onAddBrandRules', () => {
		expect(rooProfileContent).toContain('onAddBrandRules(targetDir)');

		// Check for the specific .roomodes copy logic
		expect(rooProfileContent).toContain(
			'fs.copyFileSync(roomodesSrc, roomodesDest);'
		);
		expect(rooProfileContent).toContain(
			"const roomodesSrc = path.join(sourceDir, '.roomodes');"
		);
		expect(rooProfileContent).toContain(
			"const roomodesDest = path.join(targetDir, '.roomodes');"
		);
		expect(rooProfileContent).toContain(
			"path.resolve(__dirname, '../../assets/roocode')"
		); // sourceDir for roomodesSrc
	});

	test('roo.js profile copies mode-specific rule files via onAddBrandRules', () => {
		expect(rooProfileContent).toContain('onAddBrandRules(targetDir)');
		expect(rooProfileContent).toContain('for (const mode of rooModes)');

		// Check for the specific mode rule file copy logic
		expect(rooProfileContent).toContain('fs.copyFileSync(src, dest);');

		// Check source path construction for mode rules
		expect(rooProfileContent).toContain(
			'const src = path.join(rooModesDir, `rules-${mode}`, `${mode}-rules`);'
		);
		// Check destination path construction for mode rules
		expect(rooProfileContent).toContain(
			"const dest = path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`);"
		);
		expect(rooProfileContent).toContain(
			"const rooModesDir = path.join(sourceDir, '.roo');"
		); // part of src path
	});
});
