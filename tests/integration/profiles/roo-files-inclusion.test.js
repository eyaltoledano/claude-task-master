import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Roo Files Inclusion in Package', () => {
	// This test verifies that the required Roo files are included in the final package

	test('package.json includes dist/** in the "files" array for bundled files', () => {
		// Read the package.json file
		const packageJsonPath = path.join(process.cwd(), 'package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

		// Check if dist/** is included in the files array (which contains bundled output including Roo files)
		expect(packageJson.files).toContain('dist/**');
	});

	test('roo.js profile contains logic for Roo directory creation and file copying', () => {
		// Read the roo.js profile file
		const rooJsPath = path.join(process.cwd(), 'src', 'profiles', 'roo.js');
		const rooJsContent = fs.readFileSync(rooJsPath, 'utf8');

		// Check for the main handler function
		expect(
			rooJsContent.includes('onAddRulesProfile(targetDir, assetsDir)')
		).toBe(true);

		// Check for general recursive copy of assets/roocode
		expect(
			rooJsContent.includes('copyRecursiveSync(sourceDir, targetDir)')
		).toBe(true);

		// Check for updated path handling
		expect(rooJsContent.includes("path.join(assetsDir, 'roocode')")).toBe(true);

		// Check for .roomodes file copying logic (source and destination paths)
		expect(rooJsContent.includes("path.join(sourceDir, '.roomodes')")).toBe(
			true
		);
		expect(rooJsContent.includes("path.join(targetDir, '.roomodes')")).toBe(
			true
		);

		// Check for mode-specific rule file copying logic
		expect(rooJsContent.includes('for (const mode of ROO_MODES)')).toBe(true);
		expect(
			rooJsContent.includes(
				'path.join(rooModesDir, `rules-${mode}`, `${mode}-rules`)'
			)
		).toBe(true);
		expect(
			rooJsContent.includes(
				"path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`)"
			)
		).toBe(true);

		// Check for import of ROO_MODES from profiles.js instead of local definition
		expect(
			rooJsContent.includes(
				"import { ROO_MODES } from '../constants/profiles.js'"
			)
		).toBe(true);

		// Verify ROO_MODES is used in the for loop
		expect(rooJsContent.includes('for (const mode of ROO_MODES)')).toBe(true);

		// Verify mode variable is used in the template strings (this confirms modes are being processed)
		expect(rooJsContent.includes('rules-${mode}')).toBe(true);
		expect(rooJsContent.includes('${mode}-rules')).toBe(true);

		// Verify that the ROO_MODES constant is properly imported and used
		// We should be able to find the template literals that use the mode variable
		expect(rooJsContent.includes('`rules-${mode}`')).toBe(true);
		expect(rooJsContent.includes('`${mode}-rules`')).toBe(true);
		expect(rooJsContent.includes('Copied ${mode}-rules to ${dest}')).toBe(true);

		// Also verify that the expected mode names are defined in the imported constant
		// by checking that the import is from the correct file that contains all 6 modes
		const profilesConstantsPath = path.join(
			process.cwd(),
			'src',
			'constants',
			'profiles.js'
		);
		const profilesContent = fs.readFileSync(profilesConstantsPath, 'utf8');

		// Check that ROO_MODES is exported and contains all expected modes
		expect(profilesContent.includes('export const ROO_MODES')).toBe(true);
		const expectedModes = [
			'architect',
			'ask',
			'orchestrator',
			'code',
			'debug',
			'test'
		];
		expectedModes.forEach((mode) => {
			expect(profilesContent.includes(`'${mode}'`)).toBe(true);
		});
	});

	test('source Roo files exist in assets directory', () => {
		// Verify that the source files for Roo integration exist
		expect(
			fs.existsSync(path.join(process.cwd(), 'assets', 'roocode', '.roo'))
		).toBe(true);
		expect(
			fs.existsSync(path.join(process.cwd(), 'assets', 'roocode', '.roomodes'))
		).toBe(true);
	});
});
