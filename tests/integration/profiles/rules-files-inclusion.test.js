import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Rules Files Inclusion in Package', () => {
	// This test verifies that the required rules files are included in the final package

	test('package.json includes dist/** in the "files" array for bundled files', () => {
		// Read the package.json file
		const packageJsonPath = path.join(process.cwd(), 'package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

		// Check if dist/** is included in the files array (which contains bundled output including assets)
		expect(packageJson.files).toContain('dist/**');
	});

	test('source rules files exist in assets/rules directory', () => {
		// Verify that the actual rules files exist
		const rulesDir = path.join(process.cwd(), 'assets', 'rules');
		expect(fs.existsSync(rulesDir)).toBe(true);

		// Check for the 4 files that currently exist
		const expectedFiles = [
			'dev_workflow.mdc',
			'taskmaster.mdc',
			'self_improve.mdc',
			'cursor_rules.mdc'
		];

		expectedFiles.forEach((file) => {
			const filePath = path.join(rulesDir, file);
			expect(fs.existsSync(filePath)).toBe(true);
		});
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

		// Check for import of ROO_MODES from profiles.js
		expect(
			rooJsContent.includes(
				"import { ROO_MODES } from '../constants/profiles.js'"
			)
		).toBe(true);

		// Verify mode variable is used in the template strings (this confirms modes are being processed)
		expect(rooJsContent.includes('rules-${mode}')).toBe(true);
		expect(rooJsContent.includes('${mode}-rules')).toBe(true);
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
