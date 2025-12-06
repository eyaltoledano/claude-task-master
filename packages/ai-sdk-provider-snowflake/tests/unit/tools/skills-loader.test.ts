/**
 * Unit Tests for Skills Loader Tool
 *
 * Tests both unit functionality and integration with the filesystem
 * to ensure skills can be found in .claude/skills and .cortex/skills directories.
 */

import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach,
	beforeAll,
	afterAll
} from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
	listSkillsInputSchema,
	listSkillsTool,
	parseFrontMatter
} from '../../../src/tools/skills-loader.js';

describe('Skills Loader Tool', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('listSkillsInputSchema', () => {
		it('should accept optional skillName', () => {
			const result = listSkillsInputSchema.parse({});
			expect(result.skillName).toBeUndefined();
		});

		it('should accept skillName filter', () => {
			const result = listSkillsInputSchema.parse({
				skillName: 'test-skill'
			});
			expect(result.skillName).toBe('test-skill');
		});
	});

	describe('parseFrontMatter', () => {
		it('should parse valid YAML front-matter', () => {
			const content = `---
name: test-skill
description: A test skill for unit testing
---
# Test Skill

Instructions here...
`;
			const result = parseFrontMatter(content);
			expect(result).toEqual({
				name: 'test-skill',
				description: 'A test skill for unit testing'
			});
		});

		it('should return empty object for missing front-matter', () => {
			const content = `# No Front Matter

Just regular markdown content.
`;
			const result = parseFrontMatter(content);
			expect(result).toEqual({});
		});

		it('should return empty object for front-matter without name/description', () => {
			const content = `---
invalid: yaml
missing: required fields
---
# Content
`;
			const result = parseFrontMatter(content);
			expect(result.name).toBeUndefined();
			expect(result.description).toBeUndefined();
		});

		it('should handle front-matter with extra fields', () => {
			const content = `---
name: extended-skill
description: Skill with extra metadata
version: 1.0.0
author: Test Author
tags:
  - test
  - example
---
# Extended Skill
`;
			const result = parseFrontMatter(content);
			expect(result.name).toBe('extended-skill');
			expect(result.description).toBe('Skill with extra metadata');
		});

		it('should handle front-matter with empty description', () => {
			const content = `---
name: minimal-skill
description: ""
---
# Minimal
`;
			const result = parseFrontMatter(content);
			expect(result.name).toBe('minimal-skill');
			expect(result.description).toBe('');
		});
	});

	describe('listSkillsTool', () => {
		it('should have correct description', () => {
			expect(listSkillsTool.description).toContain('skills');
			expect(listSkillsTool.description).toContain('front-matter');
			expect(listSkillsTool.description).toContain('file_read');
		});

		it('should have execute function', () => {
			expect(typeof listSkillsTool.execute).toBe('function');
		});

		it('should have parameters schema', () => {
			expect(listSkillsTool.parameters).toBeDefined();
		});
	});
});

/**
 * Integration Tests for Skills Loader
 *
 * These tests create actual skill directories in both .claude/skills and .cortex/skills
 * to verify the loader can find and parse skills from both locations.
 */
describe('Skills Loader Integration', () => {
	let testDir: string;
	const originalEnv = process.env;

	// Skill content fixtures
	const claudeSkillContent = `---
name: claude-code-review
description: A skill for reviewing code quality and best practices
---
# Code Review Skill

Use this skill to perform thorough code reviews.

## Guidelines
- Check for security vulnerabilities
- Verify code follows best practices
- Suggest improvements
`;

	const cortexSkillContent = `---
name: cortex-data-analysis
description: A skill for analyzing data and generating insights
---
# Data Analysis Skill

Use this skill to analyze datasets and generate insights.

## Capabilities
- Statistical analysis
- Pattern detection
- Visualization suggestions
`;

	const cortexSkillWithScripts = `---
name: cortex-automation
description: A skill with executable scripts for automation tasks
---
# Automation Skill

This skill includes scripts for common automation tasks.
`;

	beforeAll(async () => {
		// Create a temporary directory for test fixtures
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));

		// Create .claude/skills directory with a skill
		const claudeSkillsDir = path.join(
			testDir,
			'.claude',
			'skills',
			'code-review'
		);
		await fs.mkdir(claudeSkillsDir, { recursive: true });
		await fs.writeFile(
			path.join(claudeSkillsDir, 'SKILL.md'),
			claudeSkillContent
		);
		await fs.mkdir(path.join(claudeSkillsDir, 'references'), {
			recursive: true
		});
		await fs.writeFile(
			path.join(claudeSkillsDir, 'references', 'style-guide.md'),
			'# Style Guide\n\nCode style guidelines...'
		);

		// Create .cortex/skills directory with skills
		const cortexSkillsDir1 = path.join(
			testDir,
			'.cortex',
			'skills',
			'data-analysis'
		);
		await fs.mkdir(cortexSkillsDir1, { recursive: true });
		await fs.writeFile(
			path.join(cortexSkillsDir1, 'SKILL.md'),
			cortexSkillContent
		);

		// Create another cortex skill with scripts and assets
		const cortexSkillsDir2 = path.join(
			testDir,
			'.cortex',
			'skills',
			'automation'
		);
		await fs.mkdir(cortexSkillsDir2, { recursive: true });
		await fs.writeFile(
			path.join(cortexSkillsDir2, 'SKILL.md'),
			cortexSkillWithScripts
		);

		// Add scripts subdirectory
		await fs.mkdir(path.join(cortexSkillsDir2, 'scripts'), { recursive: true });
		await fs.writeFile(
			path.join(cortexSkillsDir2, 'scripts', 'deploy.sh'),
			'#!/bin/bash\necho "Deploying..."'
		);
		await fs.writeFile(
			path.join(cortexSkillsDir2, 'scripts', 'cleanup.py'),
			'#!/usr/bin/env python3\nprint("Cleaning up...")'
		);

		// Add assets subdirectory
		await fs.mkdir(path.join(cortexSkillsDir2, 'assets'), { recursive: true });
		await fs.writeFile(
			path.join(cortexSkillsDir2, 'assets', 'template.json'),
			'{ "name": "template" }'
		);
	});

	afterAll(async () => {
		// Clean up test directory
		if (testDir) {
			await fs.rm(testDir, { recursive: true, force: true });
		}
	});

	beforeEach(() => {
		// Set PROJECT_ROOT to our test directory
		process.env = { ...originalEnv, PROJECT_ROOT: testDir };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('Finding skills', () => {
		it('should find all skills in allowed directories', async () => {
			const result = await listSkillsTool.execute({});

			expect(result.totalSkills).toBe(3);
			expect(result.searchedDirectories.length).toBe(5); // 3 project + 2 home

			// Should find claude skill
			const claudeSkill = result.skills.find(s => s.name === 'claude-code-review');
			expect(claudeSkill).toBeDefined();
			expect(claudeSkill?.description).toBe('A skill for reviewing code quality and best practices');

			// Should find cortex skills
			expect(result.skills.some(s => s.name === 'cortex-data-analysis')).toBe(true);
			expect(result.skills.some(s => s.name === 'cortex-automation')).toBe(true);
		});

		it('should include complete file inventory for each skill', async () => {
			const result = await listSkillsTool.execute({});

			for (const skill of result.skills) {
				expect(skill.files).toBeDefined();
				expect(skill.files.length).toBeGreaterThan(0);
				
				// All skills should have SKILL.md
				const skillMd = skill.files.find(f => f.path.endsWith('SKILL.md'));
				expect(skillMd).toBeDefined();
				expect(skillMd?.size).toBeGreaterThan(0);
			}
		});
	});

	describe('Filtering skills by name', () => {
		it('should filter skills by exact name match', async () => {
			const result = await listSkillsTool.execute({
				skillName: 'cortex-automation'
			});

			expect(result.totalSkills).toBe(1);
			expect(result.skills[0].name).toBe('cortex-automation');
		});

		it('should filter skills by partial name (case insensitive)', async () => {
			const result = await listSkillsTool.execute({
				skillName: 'CORTEX'
			});

			expect(result.totalSkills).toBe(2);
			expect(
				result.skills.every((s) => s.name.toLowerCase().includes('cortex'))
			).toBe(true);
		});

		it('should return empty results for non-existent skill name', async () => {
			const result = await listSkillsTool.execute({
				skillName: 'non-existent-skill'
			});

			expect(result.totalSkills).toBe(0);
			expect(result.skills).toEqual([]);
		});

		it('should handle undefined skillName', async () => {
			const result = await listSkillsTool.execute({
				skillName: undefined
			});

			// Should return all skills when skillName is undefined
			expect(result.totalSkills).toBe(3);
		});
	});

	describe('Edge cases', () => {
		it('should handle skills with minimal file structure', async () => {
			// Create a skill directory with only SKILL.md
			const emptySkillDir = path.join(testDir, '.claude', 'skills', 'minimal-skill');
			await fs.mkdir(emptySkillDir, { recursive: true });
			await fs.writeFile(
				path.join(emptySkillDir, 'SKILL.md'),
				'---\nname: minimal-skill\ndescription: Minimal skill\n---\n'
			);

			const result = await listSkillsTool.execute({});

			const minimalSkill = result.skills.find(s => s.name === 'minimal-skill');
			expect(minimalSkill).toBeDefined();
			expect(minimalSkill?.files.length).toBe(1); // Only SKILL.md
			expect(minimalSkill?.files[0].path).toBe('SKILL.md');
		});
	});


	describe('Skills as Tools', () => {
		it('should provide skill metadata suitable for tool registration', async () => {
			const result = await listSkillsTool.execute({});

			for (const skill of result.skills) {
				// Each skill should have the required fields for tool registration
				expect(skill.name).toBeDefined();
				expect(typeof skill.name).toBe('string');
				expect(skill.name.length).toBeGreaterThan(0);

				expect(skill.description).toBeDefined();
				expect(typeof skill.description).toBe('string');

				expect(skill.path).toBeDefined();
				expect(typeof skill.path).toBe('string');

				expect(skill.files).toBeDefined();
				expect(Array.isArray(skill.files)).toBe(true);
			}
		});

		it('should provide file paths for progressive loading', async () => {
			const result = await listSkillsTool.execute({
				skillName: 'cortex-automation'
			});

			const skill = result.skills[0];
			expect(skill).toBeDefined();

			// Each file should have the required metadata (FileInfo: path, size)
			for (const file of skill.files) {
				expect(file.path).toBeDefined();
				expect(typeof file.path).toBe('string');
				expect(file.size).toBeDefined();
				expect(typeof file.size).toBe('number');

				// Path should be relative and usable with file_read
				// Note: In tests, paths may start with temp dir path
				expect(file.path.length).toBeGreaterThan(0);
			}
		});
	});
});
