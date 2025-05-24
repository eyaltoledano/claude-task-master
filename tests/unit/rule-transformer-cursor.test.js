import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
	convertRuleToBrandRule,
	convertAllRulesToBrandRules
} from '../../src/utils/rule-transformer.js';
import * as cursorProfile from '../../scripts/profiles/cursor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Cursor Rule Transformer', () => {
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
		const testCursorOut = path.join(testDir, 'basic-terms.mdc');
		convertRuleToBrandRule(testCursorRule, testCursorOut, cursorProfile);

		// Read the converted file
		const convertedContent = fs.readFileSync(testCursorOut, 'utf8');

		// Verify transformations (should preserve Cursor branding and references)
		expect(convertedContent).toContain('Cursor rule');
		expect(convertedContent).toContain('cursor.so');
		expect(convertedContent).toContain('.mdc');
		expect(convertedContent).not.toContain('roocode.com');
		expect(convertedContent).not.toContain('windsurf.com');
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
		const testCursorOut = path.join(testDir, 'tool-refs.mdc');
		convertRuleToBrandRule(testCursorRule, testCursorOut, cursorProfile);

		// Read the converted file
		const convertedContent = fs.readFileSync(testCursorOut, 'utf8');

		// Verify transformations (should preserve Cursor tool references)
		expect(convertedContent).toContain('search tool');
		expect(convertedContent).toContain('edit_file tool');
		expect(convertedContent).toContain('run_command');
		expect(convertedContent).toContain('use_mcp');
		expect(convertedContent).not.toContain('apply_diff');
		expect(convertedContent).not.toContain('search_files');
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
		const testCursorOut = path.join(testDir, 'file-refs.mdc');
		convertRuleToBrandRule(testCursorRule, testCursorOut, cursorProfile);

		// Read the converted file
		const convertedContent = fs.readFileSync(testCursorOut, 'utf8');

		// Verify transformations (should preserve Cursor file references)
		expect(convertedContent).toContain('(mdc:.cursor/rules/dev_workflow.mdc)');
		expect(convertedContent).toContain('(mdc:.cursor/rules/taskmaster.mdc)');
		expect(convertedContent).not.toContain('(mdc:.roo/rules/');
		expect(convertedContent).not.toContain('(mdc:.windsurf/rules/');
	});
});
