import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Roo Files Inclusion in Package', () => {
	// This test verifies that the required Roo files are included in the final package

	test('package.json includes assets/** in the "files" array for Roo source files', () => {
		// Read the package.json file
		const packageJsonPath = path.join(process.cwd(), 'package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

		// Check if assets/** is included in the files array (which contains Roo files)
		expect(packageJson.files).toContain('assets/**');
	});

	test('roo.js profile contains logic for Roo directory creation and file copying', () => {
		// Read the roo.js profile file
		const rooJsPath = path.join(process.cwd(), 'scripts', 'profiles', 'roo.js');
		const rooJsContent = fs.readFileSync(rooJsPath, 'utf8');

		// Check for the main handler function
		expect(rooJsContent.includes('onAddBrandRules(targetDir)')).toBe(true);

		// Check for general recursive copy of assets/roocode
		expect(
			rooJsContent.includes('copyRecursiveSync(sourceDir, targetDir)')
		).toBe(true);

		// Check for .roomodes file copying logic (source and destination paths)
		expect(rooJsContent.includes("path.join(sourceDir, '.roomodes')")).toBe(
			true
		);
		expect(rooJsContent.includes("path.join(targetDir, '.roomodes')")).toBe(
			true
		);

		// Check for mode-specific rule file copying logic
		expect(rooJsContent.includes('for (const mode of rooModes)')).toBe(true);
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

		// Check for definition of rooModes array and all modes
		const rooModesArrayRegex = /const rooModes\s*=\s*\[([^\]]+)\]\s*;?/;
		const rooModesMatch = rooJsContent.match(rooModesArrayRegex);
		expect(rooModesMatch).not.toBeNull();
		if (rooModesMatch) {
			expect(rooModesMatch[1].includes('architect')).toBe(true);
			expect(rooModesMatch[1].includes('ask')).toBe(true);
			expect(rooModesMatch[1].includes('boomerang')).toBe(true);
			expect(rooModesMatch[1].includes('code')).toBe(true);
			expect(rooModesMatch[1].includes('debug')).toBe(true);
			expect(rooModesMatch[1].includes('test')).toBe(true);
		}
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
