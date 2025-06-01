import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Roo Initialization Functionality', () => {
	let initJsContent;

	beforeAll(() => {
		// Read the init.js file content once for all tests
		const initJsPath = path.join(process.cwd(), 'scripts', 'init.js');
		initJsContent = fs.readFileSync(initJsPath, 'utf8');
	});

	test('init.js creates Roo directories in createProjectStructure function', () => {
		// Check if createProjectStructure function exists
		expect(initJsContent).toContain('function createProjectStructure');

		// Check for the line that creates the .roo directory
		const hasRooDir = initJsContent.includes(
			"ensureDirectoryExists(path.join(targetDir, '.roo'))"
		);
		expect(hasRooDir).toBe(true);

		// Check for the line that creates .roo/rules directory
		const hasRooRulesDir = initJsContent.includes(
			"ensureDirectoryExists(path.join(targetDir, '.roo/rules'))"
		);
		expect(hasRooRulesDir).toBe(true);

		// Check for the for loop that creates mode-specific directories using local ROO_MODES array
		const hasRooModeLoop = initJsContent.includes(
			'for (const mode of ROO_MODES)'
		);
		expect(hasRooModeLoop).toBe(true);

		// Check for local ROO_MODES definition
		const hasLocalRooModes = initJsContent.includes(
			"const ROO_MODES = ['architect', 'ask', 'boomerang', 'code', 'debug', 'test']"
		);
		expect(hasLocalRooModes).toBe(true);
	});

	test('init.js copies Roo files from assets/roocode directory', () => {
		// Check for the .roomodes case in the copyTemplateFile function
		const casesRoomodes = initJsContent.includes("case '.roomodes':");
		expect(casesRoomodes).toBe(true);

		// Check that assets/roocode appears somewhere in the file
		const hasRoocodePath = initJsContent.includes("'assets', 'roocode'");
		expect(hasRoocodePath).toBe(true);

		// Check that roomodes file is copied
		const copiesRoomodes = initJsContent.includes(
			"copyTemplateFile('.roomodes'"
		);
		expect(copiesRoomodes).toBe(true);
	});

	test('init.js has code to copy rule files for each mode', () => {
		// Look for template copying for rule files
		const hasModeRulesCopying =
			initJsContent.includes('copyTemplateFile(') &&
			initJsContent.includes('rules-') &&
			initJsContent.includes('-rules');
		expect(hasModeRulesCopying).toBe(true);
	});
});
