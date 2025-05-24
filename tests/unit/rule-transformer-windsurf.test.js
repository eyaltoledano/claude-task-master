import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { convertRuleToBrandRule } from '../../src/utils/rule-transformer.js';
import * as windsurfProfile from '../../scripts/profiles/windsurf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Windsurf Rule Transformer', () => {
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
		const testWindsurfRule = path.join(testDir, 'basic-terms.md');
		convertRuleToBrandRule(testCursorRule, testWindsurfRule, windsurfProfile);

		// Read the converted file
		const convertedContent = fs.readFileSync(testWindsurfRule, 'utf8');

		// Verify transformations
		expect(convertedContent).toContain('Windsurf');
		expect(convertedContent).toContain('windsurf.com');
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
		const testWindsurfRule = path.join(testDir, 'tool-refs.md');
		convertRuleToBrandRule(testCursorRule, testWindsurfRule, windsurfProfile);

		// Read the converted file
		const convertedContent = fs.readFileSync(testWindsurfRule, 'utf8');

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
		const testWindsurfRule = path.join(testDir, 'file-refs.md');
		convertRuleToBrandRule(testCursorRule, testWindsurfRule, windsurfProfile);

		// Read the converted file
		const convertedContent = fs.readFileSync(testWindsurfRule, 'utf8');

		// Verify transformations
		expect(convertedContent).toContain('(mdc:.windsurf/rules/dev_workflow.md)');
		expect(convertedContent).toContain('(mdc:.windsurf/rules/taskmaster.md)');
		expect(convertedContent).not.toContain('(mdc:.cursor/rules/');
	});
});
