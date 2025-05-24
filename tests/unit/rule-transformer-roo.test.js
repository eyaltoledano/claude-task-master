import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
	convertRuleToBrandRule,
	convertAllRulesToBrandRules
} from '../../src/utils/rule-transformer.js';
import * as rooProfile from '../../scripts/profiles/roo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Roo Rule Transformer', () => {
	const testDir = path.join(__dirname, 'temp-test-dir');

	beforeAll(() => {
		// Create test directory
		if (!fs.existsSync(testDir)) {
			fs.mkdirSync(testDir, { recursive: true });
		}
	});

	afterAll(() => {
		// Clean up test directory
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	it('should correctly convert basic terms', () => {
		// Create a test Cursor rule file with basic terms
		const testCursorRule = path.join(testDir, 'basic-terms.mdc');
		const testContent = `---
description: Test Cursor rule for basic terms
globs: **/*
alwaysApply: true
---

This is a Cursor rule that references cursor.so and uses the word Cursor multiple times.
Also has references to .mdc files.`;

		fs.writeFileSync(testCursorRule, testContent);

		// Convert it
		const testRooRule = path.join(testDir, 'basic-terms.md');
		convertRuleToBrandRule(testCursorRule, testRooRule, rooProfile);

		// Read the converted file
		const convertedContent = fs.readFileSync(testRooRule, 'utf8');

		// Verify transformations
		expect(convertedContent).toContain('Roo Code');
		expect(convertedContent).toContain('roocode.com');
		expect(convertedContent).toContain('.md');
		expect(convertedContent).not.toContain('cursor.so');
		expect(convertedContent).not.toContain('Cursor rule');
	});

	it('should correctly convert tool references', () => {
		// Create a test Cursor rule file with tool references
		const testCursorRule = path.join(testDir, 'tool-refs.mdc');
		const testContent = `---
description: Test Cursor rule for tool references
globs: **/*
alwaysApply: true
---

- Use the search tool to find code
- The edit_file tool lets you modify files
- run_command executes terminal commands
- use_mcp connects to external services`;

		fs.writeFileSync(testCursorRule, testContent);

		// Convert it
		const testRooRule = path.join(testDir, 'tool-refs.md');
		convertRuleToBrandRule(testCursorRule, testRooRule, rooProfile);

		// Read the converted file
		const convertedContent = fs.readFileSync(testRooRule, 'utf8');

		// Verify transformations
		expect(convertedContent).toContain('search_files tool');
		expect(convertedContent).toContain('apply_diff tool');
		expect(convertedContent).toContain('execute_command');
		expect(convertedContent).toContain('use_mcp_tool');
	});

	it('should correctly update file references', () => {
		// Create a test Cursor rule file with file references
		const testCursorRule = path.join(testDir, 'file-refs.mdc');
		const testContent = `---
description: Test Cursor rule for file references
globs: **/*
alwaysApply: true
---

This references [dev_workflow.mdc](mdc:.cursor/rules/dev_workflow.mdc) and 
[taskmaster.mdc](mdc:.cursor/rules/taskmaster.mdc).`;

		fs.writeFileSync(testCursorRule, testContent);

		// Convert it
		const testRooRule = path.join(testDir, 'file-refs.md');
		convertRuleToBrandRule(testCursorRule, testRooRule, rooProfile);

		// Read the converted file
		const convertedContent = fs.readFileSync(testRooRule, 'utf8');

		// Verify transformations
		expect(convertedContent).toContain('(mdc:.roo/rules/dev_workflow.md)');
		expect(convertedContent).toContain('(mdc:.roo/rules/taskmaster.md)');
		expect(convertedContent).not.toContain('(mdc:.cursor/rules/');
	});

	it('should run post-processing when converting all rules for Roo', () => {
		// Simulate a rules directory with a .mdc file
		const assetsRulesDir = path.join(testDir, 'assets', 'rules');
		fs.mkdirSync(assetsRulesDir, { recursive: true });
		const assetRule = path.join(assetsRulesDir, 'dev_workflow.mdc');
		fs.writeFileSync(assetRule, 'dummy');
		// Should create .roo/rules and call post-processing
		convertAllRulesToBrandRules(testDir, rooProfile);
		// Check for post-processing artifacts, e.g., rules-* folders or extra files
		const rooDir = path.join(testDir, '.roo');
		const found = fs.readdirSync(rooDir).some((f) => f.startsWith('rules-'));
		expect(found).toBe(true); // There should be at least one rules-* folder
	});
});
