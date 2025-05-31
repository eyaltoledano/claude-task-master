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

	test('init.js creates Roo directories and copies files', () => {
		// Read the init.js file
		const initJsPath = path.join(process.cwd(), 'scripts', 'init.js');
		const initJsContent = fs.readFileSync(initJsPath, 'utf8');

		// Check for Roo directory creation (using more flexible pattern matching)
		const hasRooDir = initJsContent.includes(
			"ensureDirectoryExists(path.join(targetDir, '.roo'))"
		);
		expect(hasRooDir).toBe(true);

		// Check for .roomodes file copying using hardcoded path
		const hasRoomodes = initJsContent.includes(
			"path.join(targetDir, '.roomodes')"
		);
		expect(hasRoomodes).toBe(true);

		// Check for local ROO_MODES definition and usage
		const hasRooModes = initJsContent.includes('ROO_MODES');
		expect(hasRooModes).toBe(true);

		// Check for local ROO_MODES array definition
		const hasLocalRooModes = initJsContent.includes(
			"const ROO_MODES = ['architect', 'ask', 'boomerang', 'code', 'debug', 'test']"
		);
		expect(hasLocalRooModes).toBe(true);

		// Check for mode-specific patterns (these will still be present in the local array)
		const hasArchitect = initJsContent.includes('architect');
		const hasAsk = initJsContent.includes('ask');
		const hasBoomerang = initJsContent.includes('boomerang');
		const hasCode = initJsContent.includes('code');
		const hasDebug = initJsContent.includes('debug');
		const hasTest = initJsContent.includes('test');

		expect(hasArchitect).toBe(true);
		expect(hasAsk).toBe(true);
		expect(hasBoomerang).toBe(true);
		expect(hasCode).toBe(true);
		expect(hasDebug).toBe(true);
		expect(hasTest).toBe(true);
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
